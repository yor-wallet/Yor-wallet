-- 20261010 — Envoi AUTOMATIQUE et IMMÉDIAT des SMS d'un transfert (expéditeur + destinataire), sans bouton ni validation.
--
-- Avant : la base mettait les messages en file (recipient_notices) et c'était l'application qui appelait send-notice, après avoir rechargé les
-- soldes. Si l'application était fermée ou hors ligne, rien ne partait. Maintenant :
--   1. dès que le transfert est enregistré (même transaction que l'écriture de la file), la base APPELLE ELLE-MÊME send-notice (pg_net) ;
--   2. toutes les minutes, pg_cron relance les envois échoués des 2 dernières heures ;
--   3. les transferts INTERNES (compte à compte) reçoivent aussi la confirmation de l'expéditeur (avant : seulement le destinataire).
-- L'appel interne est authentifié par un jeton qui n'existe que dans la table privée notice_dispatch_cfg (RLS activée, aucun droit public).

create table if not exists public.notice_dispatch_cfg (
  id boolean primary key default true check (id),
  token text not null,
  anon_key text not null,
  fn_url text not null
);
alter table public.notice_dispatch_cfg enable row level security;
revoke all on public.notice_dispatch_cfg from public, anon, authenticated;
comment on table public.notice_dispatch_cfg is 'Jeton interne du déclenchement automatique de send-notice. Aucun accès public (RLS sans politique). Ne jamais exposer.';

insert into public.notice_dispatch_cfg (id, token, anon_key, fn_url)
values (true, encode(extensions.gen_random_bytes(32), 'hex'),
        -- clé « anon » du projet : publique (elle est dans l'application) ; la plateforme l'exige pour laisser passer l'appel (verify_jwt)
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYmptZ3VvYXV2dXRpcXZvc3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwOTExMzAsImV4cCI6MjEwNjY2NzEzMH0.2EvBOXWsrpm-vZfnoBnzrEoYeJ6-L6NorkNBiYGsYiU',
        'https://gebjmguoauvutiqvoswl.supabase.co/functions/v1/send-notice')
on conflict (id) do nothing;

-- Appel de send-notice. p_tx = une transaction précise ; null = balayage des envois en attente.
-- Une erreur ici ne fait JAMAIS échouer le transfert (le message reste en file, le balayage le reprendra).
create or replace function public._dispatch_notices(p_tx uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.notice_dispatch_cfg;
begin
  select * into c from public.notice_dispatch_cfg where id;
  if c.token is null then return; end if;
  perform net.http_post(
    url := c.fn_url,
    body := jsonb_build_object('tx_id', p_tx),
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || c.anon_key, 'apikey', c.anon_key, 'x-notice-token', c.token),
    timeout_milliseconds := 20000);
exception when others then
  raise warning '_dispatch_notices failed: %', sqlerrm;
end $$;
revoke all on function public._dispatch_notices(uuid) from public, anon, authenticated;

create or replace function public._dispatch_sweep() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.recipient_notices
             where status in ('PENDING', 'FAILED') and attempts < 5 and next_attempt_at <= now() and created_at > now() - interval '2 hours') then
    perform public._dispatch_notices(null);
  end if;
exception when others then
  raise warning '_dispatch_sweep failed: %', sqlerrm;
end $$;
revoke all on function public._dispatch_sweep() from public, anon, authenticated;

select cron.schedule('notice-sweep', '* * * * *', 'select public._dispatch_sweep()');

-- File des messages : mêmes règles qu'avant, plus (a) la confirmation de l'expéditeur pour un transfert INTERNE, (b) l'appel immédiat de send-notice.
create or replace function public.enqueue_recipient_notices(p_tx uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.transactions; b jsonb; v_iso text; v_e text; v_rp public.profiles; v_n int; v_status text; v_err text;
  v_sp public.profiles; v_raw text; v_sphone text; v_sst text; v_serr text; v_siso text;
  v_enabled text[] := array['OM','AE','ML','CI','BF'];
begin
  select * into t from public.transactions where id = p_tx;
  if t.id is null or t.status not in ('CONFIRMED','SUCCESS','COMPLETED') then return; end if;

  if t.kind = 'FIAT_EXTERNAL' then
    b := coalesce(t.meta -> 'beneficiary', '{}'::jsonb);
    v_iso := upper(btrim(coalesce(b ->> 'country', '')));
    v_e := public._phone_e164(b ->> 'phone', v_iso);

    if v_e is not null then
      v_status := 'PENDING'; v_err := null;
      if not (v_iso = any (v_enabled)) then v_status := 'SKIPPED'; v_err := 'country_not_enabled';
      else
        select count(*) into v_n from public.recipient_notices
          where to_phone = v_e and channel = 'SMS' and status <> 'SKIPPED' and created_at > now() - interval '24 hours';
        if v_n >= 5 then v_status := 'SKIPPED'; v_err := 'rate_limited_recipient';
        else
          select count(*) into v_n from public.recipient_notices n join public.transactions x on x.id = n.transaction_id
            where x.sender_id = t.sender_id and n.channel = 'SMS' and n.audience <> 'SENDER' and n.status <> 'SKIPPED' and n.created_at > now() - interval '24 hours';
          if v_n >= 20 then v_status := 'SKIPPED'; v_err := 'rate_limited_sender'; end if;
        end if;
      end if;
      insert into public.recipient_notices (transaction_id, channel, audience, to_phone, country, status, error_message, idempotency_key)
        values (t.id, 'SMS', 'EXTERNAL', v_e, v_iso, v_status, v_err, 'tx:' || t.id || ':sms:ext')
        on conflict (idempotency_key) do nothing;

      select p.* into v_rp from public.profiles p
        where p.status = 'ACTIVE' and p.email is not null and p.id is distinct from t.sender_id
          and public._phone_e164(p.phone, p.country) = v_e
        order by p.created_at limit 1;
      if v_rp.id is not null then
        insert into public.recipient_notices (transaction_id, channel, audience, user_id, to_email, country, status, error_message, idempotency_key)
          values (t.id, 'EMAIL', 'EXTERNAL', v_rp.id, v_rp.email, v_iso,
                  case when v_err in ('rate_limited_recipient','rate_limited_sender') then 'SKIPPED' else 'PENDING' end,
                  case when v_err in ('rate_limited_recipient','rate_limited_sender') then v_err else null end,
                  'tx:' || t.id || ':email:ext')
          on conflict (idempotency_key) do nothing;
      end if;
    end if;

  elsif t.kind = 'FIAT_TRANSFER' and t.receiver_id is not null and t.receiver_id is distinct from t.sender_id then
    select * into v_rp from public.profiles where id = t.receiver_id;
    if v_rp.id is not null then
      v_iso := upper(btrim(coalesce(v_rp.country, '')));
      v_e := public._phone_e164(v_rp.phone, v_iso);
      if v_e is not null then
        v_status := 'PENDING'; v_err := null;
        if not (v_iso = any (v_enabled)) then v_status := 'SKIPPED'; v_err := 'country_not_enabled';
        else
          select count(*) into v_n from public.recipient_notices
            where to_phone = v_e and channel = 'SMS' and status <> 'SKIPPED' and created_at > now() - interval '24 hours';
          if v_n >= 5 then v_status := 'SKIPPED'; v_err := 'rate_limited_recipient'; end if;
        end if;
        insert into public.recipient_notices (transaction_id, channel, audience, user_id, to_phone, country, status, error_message, idempotency_key)
          values (t.id, 'SMS', 'INTERNAL', v_rp.id, v_e, v_iso, v_status, v_err, 'tx:' || t.id || ':sms:int')
          on conflict (idempotency_key) do nothing;
      end if;
    end if;
  end if;

  -- Confirmation envoyée à l'EXPÉDITEUR lui-même (transfert externe ET transfert interne), au numéro des « Réglages → confirmations SMS »,
  -- à défaut au numéro de son profil ; e-mail vers l'adresse du compte.
  if t.sender_id is not null
     and (t.kind = 'FIAT_EXTERNAL' or (t.kind = 'FIAT_TRANSFER' and t.receiver_id is not null and t.receiver_id is distinct from t.sender_id)) then
    select * into v_sp from public.profiles where id = t.sender_id;
    if v_sp.id is not null then
      select nullif(btrim(d.data ->> 'confirmPhone'), '') into v_raw
        from public.user_docs d where d.user_id = t.sender_id and d.doc_name = 'preferences';
      v_raw := coalesce(v_raw, nullif(btrim(v_sp.phone), ''));
      v_siso := upper(btrim(coalesce(v_sp.country, '')));
      v_sphone := public._phone_e164(v_raw, v_siso);
      v_sst := 'PENDING'; v_serr := null;
      if v_raw is null then v_sst := 'SKIPPED'; v_serr := 'no_sender_phone';
      elsif v_sphone is null then v_sst := 'SKIPPED'; v_serr := 'invalid_phone';
      elsif not (v_siso = any (v_enabled)) then v_sst := 'SKIPPED'; v_serr := 'country_not_enabled';
      else
        select count(*) into v_n from public.recipient_notices
          where to_phone = v_sphone and channel = 'SMS' and audience = 'SENDER' and status <> 'SKIPPED' and created_at > now() - interval '24 hours';
        if v_n >= 10 then v_sst := 'SKIPPED'; v_serr := 'rate_limited_sender'; end if;
      end if;
      insert into public.recipient_notices (transaction_id, channel, audience, user_id, to_phone, country, status, error_message, idempotency_key)
        values (t.id, 'SMS', 'SENDER', v_sp.id, v_sphone, nullif(v_iso, ''), v_sst, v_serr, 'tx:' || t.id || ':sms:snd')
        on conflict (idempotency_key) do nothing;
      if v_sp.status = 'ACTIVE' and nullif(btrim(coalesce(v_sp.email, '')), '') is not null then
        insert into public.recipient_notices (transaction_id, channel, audience, user_id, to_email, country, status, idempotency_key)
          values (t.id, 'EMAIL', 'SENDER', v_sp.id, btrim(v_sp.email), nullif(v_iso, ''), 'PENDING', 'tx:' || t.id || ':email:snd')
          on conflict (idempotency_key) do nothing;
      end if;
    end if;
  end if;

  -- Envoi immédiat : la requête part dès que la transaction est validée (pg_net), sans attendre l'application.
  if t.kind in ('FIAT_EXTERNAL', 'FIAT_TRANSFER') then perform public._dispatch_notices(t.id); end if;
exception when others then
  raise warning 'enqueue_recipient_notices failed: %', sqlerrm;
end $$;
