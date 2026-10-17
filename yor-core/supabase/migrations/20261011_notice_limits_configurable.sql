-- 20261011 — Plus de SMS : limites relevées et réglables sans redéploiement, pays SMS élargis.
--
-- Avant : limites écrites en dur dans enqueue_recipient_notices (5 SMS / numéro destinataire / 24 h, 20 / expéditeur / 24 h,
-- 10 confirmations / numéro expéditeur / 24 h) et 5 pays SMS (OM, AE, ML, CI, BF). Un SMS au-delà d'une limite passait en
-- SKIPPED (rate_limited_*), sans être envoyé.
-- Maintenant : les valeurs vivent dans la table privée notice_dispatch_cfg (une seule ligne) et se changent par une requête :
--   update public.notice_dispatch_cfg set limit_recipient_24h = 50;
-- Valeurs par défaut : 30 / 100 / 100 par 24 h ; pays SMS : OM, AE, ML, CI, BF + SA, GN, EG. Les États-Unis restent exclus
-- (l'opérateur y exige un enregistrement des expéditeurs : le message serait refusé).
-- Les limites restent un garde-fou (coût d'un SMS, abus) ; elles ne sont pas supprimées.

alter table public.notice_dispatch_cfg
  add column if not exists limit_recipient_24h int not null default 30 check (limit_recipient_24h between 1 and 10000),
  add column if not exists limit_sender_24h int not null default 100 check (limit_sender_24h between 1 and 10000),
  add column if not exists limit_confirm_24h int not null default 100 check (limit_confirm_24h between 1 and 10000),
  add column if not exists sms_countries text[] not null default array['OM','AE','ML','CI','BF','SA','GN','EG'];

create or replace function public.enqueue_recipient_notices(p_tx uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.transactions; b jsonb; v_iso text; v_e text; v_rp public.profiles; v_n int; v_status text; v_err text;
  v_sp public.profiles; v_raw text; v_sphone text; v_sst text; v_serr text; v_siso text;
  c public.notice_dispatch_cfg; v_enabled text[]; v_lim_r int; v_lim_s int; v_lim_c int;
begin
  select * into t from public.transactions where id = p_tx;
  if t.id is null or t.status not in ('CONFIRMED','SUCCESS','COMPLETED') then return; end if;

  select * into c from public.notice_dispatch_cfg where id;
  v_enabled := coalesce(c.sms_countries, array['OM','AE','ML','CI','BF']);
  v_lim_r := coalesce(c.limit_recipient_24h, 30);
  v_lim_s := coalesce(c.limit_sender_24h, 100);
  v_lim_c := coalesce(c.limit_confirm_24h, 100);

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
        if v_n >= v_lim_r then v_status := 'SKIPPED'; v_err := 'rate_limited_recipient';
        else
          select count(*) into v_n from public.recipient_notices n join public.transactions x on x.id = n.transaction_id
            where x.sender_id = t.sender_id and n.channel = 'SMS' and n.audience <> 'SENDER' and n.status <> 'SKIPPED' and n.created_at > now() - interval '24 hours';
          if v_n >= v_lim_s then v_status := 'SKIPPED'; v_err := 'rate_limited_sender'; end if;
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
          if v_n >= v_lim_r then v_status := 'SKIPPED'; v_err := 'rate_limited_recipient'; end if;
        end if;
        insert into public.recipient_notices (transaction_id, channel, audience, user_id, to_phone, country, status, error_message, idempotency_key)
          values (t.id, 'SMS', 'INTERNAL', v_rp.id, v_e, v_iso, v_status, v_err, 'tx:' || t.id || ':sms:int')
          on conflict (idempotency_key) do nothing;
      end if;
    end if;
  end if;

  -- Confirmation envoyée à l'EXPÉDITEUR lui-même (transfert externe ET interne).
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
        if v_n >= v_lim_c then v_sst := 'SKIPPED'; v_serr := 'rate_limited_sender'; end if;
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
