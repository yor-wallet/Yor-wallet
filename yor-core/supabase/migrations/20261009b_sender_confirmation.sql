-- 12.3.2 : confirmation du débit envoyée à l'EXPÉDITEUR (SMS + e-mail), en plus du message au bénéficiaire.
--  * nouvelle audience 'SENDER' ;
--  * le numéro de l'expéditeur vient de ses réglages (user_docs « preferences » → confirmPhone), à défaut de profiles.phone ;
--  * l'e-mail va à l'adresse du compte ;
--  * seuls les transferts FIAT_EXTERNAL (Orange Money, services d'Oman, banques…) en créent : les achats / envois crypto n'envoient aucun message ;
--  * aucun numéro enregistré → une ligne « SKIPPED / no_sender_phone » (le reçu l'explique) ; jamais de message vers un numéro inventé ;
--  * limites : 10 SMS par 24 h vers un même numéro d'expéditeur ; ces SMS ne comptent pas dans la limite de 20 de l'expéditeur côté bénéficiaires.

alter table public.recipient_notices drop constraint if exists recipient_notices_audience_check;
alter table public.recipient_notices add constraint recipient_notices_audience_check check (audience in ('EXTERNAL', 'INTERNAL', 'SENDER'));

create or replace function public.enqueue_recipient_notices(p_tx uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.transactions; b jsonb; v_iso text; v_e text; v_rp public.profiles; v_n int; v_status text; v_err text;
  v_sp public.profiles; v_raw text; v_sphone text; v_sst text; v_serr text; v_siso text;
  v_enabled text[] := array['OM','AE','ML','CI','BF'];          -- pays pour lesquels l'envoi de SMS est autorisé
begin
  select * into t from public.transactions where id = p_tx;
  if t.id is null or t.status not in ('CONFIRMED','SUCCESS','COMPLETED') then return; end if;

  if t.kind = 'FIAT_EXTERNAL' then
    b := coalesce(t.meta -> 'beneficiary', '{}'::jsonb);
    v_iso := upper(btrim(coalesce(b ->> 'country', '')));
    v_e := public._phone_e164(b ->> 'phone', v_iso);

    -- 1. message au bénéficiaire (virement bancaire : pas de numéro à prévenir)
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

      -- Même message par e-mail quand ce numéro appartient à un compte actif qui a une adresse e-mail (indépendant de la liste des pays SMS).
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

    -- 2. confirmation du débit à l'expéditeur (SMS + e-mail). La langue suit le service (pays du bénéficiaire) : colonne country = pays du service.
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

  elsif t.kind = 'FIAT_TRANSFER' and t.receiver_id is not null and t.receiver_id is distinct from t.sender_id then
    -- Transfert entre deux comptes de l'application : l'argent est réellement arrivé (l'e-mail existe déjà côté send-email).
    select * into v_rp from public.profiles where id = t.receiver_id;
    if v_rp.id is null then return; end if;
    v_iso := upper(btrim(coalesce(v_rp.country, '')));
    v_e := public._phone_e164(v_rp.phone, v_iso);
    if v_e is null then return; end if;
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
exception when others then
  raise warning 'enqueue_recipient_notices failed: %', sqlerrm;
end $$;

-- le reçu explique pourquoi aucun SMS n'est parti quand l'expéditeur n'a pas enregistré son numéro
create or replace function public.get_recipient_notice_status(p_tx uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_u uuid := (select auth.uid()); r jsonb;
begin
  if v_u is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.transactions where id = p_tx and sender_id = v_u) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'audience', audience, 'status', status,
    'reason', case
      when status = 'SENT' then null
      when error_message is null then null
      when error_message ilike '%credit%' then 'sms_credits_missing'
      when error_message ilike '%not configured%' then 'provider_not_configured'
      when error_message in ('country_not_enabled','rate_limited_recipient','rate_limited_sender','expired','invalid_phone','no_sender_phone') then error_message
      else 'provider_error' end) order by audience desc, channel), '[]'::jsonb)
  into r from public.recipient_notices where transaction_id = p_tx;
  return r;
end $$;

revoke all on function public.enqueue_recipient_notices(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_recipient_notices(uuid) to service_role;
revoke all on function public.get_recipient_notice_status(uuid) from public, anon;
grant execute on function public.get_recipient_notice_status(uuid) to authenticated;
