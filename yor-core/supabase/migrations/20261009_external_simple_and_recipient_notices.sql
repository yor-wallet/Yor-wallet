-- YOR WALLET 12.3.0 : envoi externe simplifié + messages au destinataire (SMS / e-mail).
-- Appliqué sur le projet gebjmguoauvutiqvoswl. Aucune donnée existante n'est modifiée ni rejouée.

----------------------------------------------------------------------------------------------------
-- A. Aides téléphone (indicatifs repris de COUNTRY_TRANSFER_CONFIG de l'application)
----------------------------------------------------------------------------------------------------
create or replace function public._notice_dial(p_iso text) returns text
language sql immutable set search_path = '' as $$
  select case upper(coalesce(p_iso, ''))
    when 'OM' then '968' when 'AE' then '971' when 'SA' then '966' when 'US' then '1'
    when 'CI' then '225' when 'ML' then '223' when 'BF' then '226' when 'GN' then '224'
    when 'EG' then '20'  when 'SD' then '249' else null end $$;

-- Numéro international (chiffres seuls) ou NULL si ce n'est pas un numéro de téléphone plausible du pays choisi.
-- IBAN, "routage / compte", identifiants avec lettres => NULL (rien à notifier par SMS).
create or replace function public._phone_e164(p_raw text, p_iso text) returns text
language plpgsql immutable set search_path = '' as $$
declare r text := btrim(coalesce(p_raw, '')); d text; dial text := public._notice_dial(p_iso);
begin
  if r = '' or r ~ '[A-Za-z/]' or dial is null then return null; end if;
  d := regexp_replace(r, '\D', '', 'g');
  if d = '' then return null; end if;
  if left(r, 1) = '+' then
    null;                                                    -- indicatif déjà présent
  elsif left(d, 2) = '00' then
    d := substr(d, 3);
  elsif left(d, length(dial)) = dial and length(d) >= length(dial) + 8 then
    null;                                                    -- indicatif saisi sans '+'
  else
    d := dial || d;                                          -- format national : on ajoute l'indicatif du pays choisi
  end if;
  if left(d, length(dial)) <> dial then return null; end if;
  if upper(p_iso) = 'AE' and substr(d, length(dial) + 1, 1) = '0' then   -- zéro de tronc des Émirats
    d := dial || substr(d, length(dial) + 2);
  end if;
  if length(d) < 8 or length(d) > 15 then return null; end if;
  return d;
end $$;

----------------------------------------------------------------------------------------------------
-- B. Envoi externe : nationalité retirée, noms obligatoires seulement pour une banque (IBAN / compte)
----------------------------------------------------------------------------------------------------
create or replace function public._fiat_send_external_impl(p_amount numeric, p_dest_currency text, p_provider text, p_beneficiary jsonb, p_idempotency_key text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_u uuid := (select auth.uid()); v_cur text := upper(btrim(coalesce(p_dest_currency,'OMR')));
  v_amt numeric; v_fee numeric := 1.000; v_vat numeric; v_total numeric; v_per numeric; v_dest numeric; v_today numeric;
  v_yor text; v_cached jsonb; v_tx uuid; v_ref text; v_res jsonb; v_name text; v_b jsonb := coalesce(p_beneficiary,'{}'::jsonb);
  v_first text := btrim(coalesce(v_b->>'firstName', v_b->>'first_name',''));
  v_last  text := btrim(coalesce(v_b->>'lastName',  v_b->>'last_name',''));
  v_phone text := btrim(coalesce(v_b->>'phone',''));
  v_country text := upper(btrim(coalesce(v_b->>'country','')));
  v_idt text := upper(btrim(coalesce(v_b->>'identifierType', v_b->>'identifier_type','')));
  v_bank boolean;
begin
  if v_u is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select yor_id into v_yor from public.profiles where id = v_u and status = 'ACTIVE';
  if v_yor is null then raise exception 'sender_inactive' using errcode = '42501'; end if;
  v_bank := v_idt in ('IBAN','ROUTING_ACCOUNT','ACCOUNT_NUMBER');
  -- Mobile money / téléphone : le numéro suffit. Banque : le titulaire du compte reste obligatoire.
  if v_bank and v_first = '' then raise exception 'missing_field:first_name' using errcode = '22023'; end if;
  if v_bank and v_last  = '' then raise exception 'missing_field:last_name' using errcode = '22023'; end if;
  if v_phone = '' then raise exception 'missing_field:phone' using errcode = '22023'; end if;
  if v_country !~ '^[A-Z]{2}$' then raise exception 'missing_field:country' using errcode = '22023'; end if;
  if btrim(coalesce(p_provider,'')) = '' then raise exception 'missing_field:service' using errcode = '22023'; end if;
  if p_amount is null or p_amount < 0.1 then raise exception 'invalid_amount' using errcode = '22023'; end if;
  v_amt := round(p_amount, 3);
  if v_amt > 3000 then raise exception 'limit_per_transaction' using errcode = '22023'; end if;
  select per_omr into v_per from public.fx_rates where currency = v_cur;
  if v_per is null then raise exception 'unsupported_currency' using errcode = '22023'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'idempotency_key_required' using errcode = '22023'; end if;
  v_cached := public._idem_check(v_u, p_idempotency_key); if v_cached is not null then return v_cached; end if;
  select coalesce(sum(amount), 0) into v_today from public.transactions
    where sender_id = v_u and kind in ('FIAT_TRANSFER','FIAT_EXTERNAL') and asset = 'OMR'
      and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_today + v_amt > 5000 then raise exception 'limit_daily' using errcode = '22023'; end if;
  v_vat := round(v_fee * 0.05, 3); v_total := v_amt + v_fee + v_vat; v_dest := round(v_amt * v_per, 8);
  v_name := left(coalesce(nullif(btrim(v_first || ' ' || v_last), ''), v_phone), 80);
  v_ref := public.new_tx_reference();
  insert into public.transactions (reference, kind, sender_id, sender_yor_id, asset, amount, fee, total, status, meta)
    values (v_ref, 'FIAT_EXTERNAL', v_u, v_yor, 'OMR', v_amt, v_fee, v_total, 'CONFIRMED',
            jsonb_build_object('vat', v_vat, 'provider', left(p_provider, 80), 'destinationCurrency', v_cur,
              'destinationAmount', v_dest, 'rate', v_per, 'rateSource', 'fx_rates table (configured, not a bank rate)',
              'rateTimestamp', now(),
              'beneficiary', jsonb_strip_nulls(jsonb_build_object('name', v_name, 'firstName', nullif(v_first,''), 'lastName', nullif(v_last,''),
                 'phone', left(v_phone, 32), 'country', left(v_country, 2), 'identifierType', nullif(v_idt,''),
                 'nationality', nullif(left(btrim(coalesce(v_b->>'nationality','')), 60), '')))))
  returning id into v_tx;
  perform public._debit_account(v_u, 'OMR', v_total, v_tx);
  insert into public.notifications (user_id, type, title, message, transaction_id, data) values
    (v_u, 'TRANSFER_SENT', 'Transfer sent', v_amt::text || ' OMR to ' || v_name, v_tx,
     jsonb_build_object('amount', v_amt, 'currency', 'OMR', 'to', v_name, 'reference', v_ref));
  v_res := jsonb_build_object('ok', true, 'transaction_id', v_tx, 'reference', v_ref, 'status', 'CONFIRMED',
    'amount', v_amt, 'fee', v_fee, 'vat', v_vat, 'total', v_total, 'exchange_rate', v_per,
    'destination_amount', v_dest, 'destination_currency', v_cur);
  update public.idempotency_keys set result = v_res where user_id = v_u and key = p_idempotency_key;
  return v_res;
end $function$;

----------------------------------------------------------------------------------------------------
-- C. File des messages au destinataire (accès réservé au serveur : RLS activée, aucune politique)
----------------------------------------------------------------------------------------------------
create table if not exists public.recipient_notices (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  channel text not null check (channel in ('SMS','EMAIL')),
  audience text not null check (audience in ('EXTERNAL','INTERNAL')),
  user_id uuid references public.profiles(id) on delete set null,
  to_phone text, to_email text, country text, language text,
  status text not null default 'PENDING' check (status in ('PENDING','SENDING','SENT','FAILED','SKIPPED')),
  attempts integer not null default 0,
  provider_message_id text, error_message text,
  next_attempt_at timestamptz not null default now(), locked_at timestamptz,
  created_at timestamptz not null default now(), sent_at timestamptz,
  idempotency_key text not null unique
);
alter table public.recipient_notices enable row level security;
revoke all on public.recipient_notices from anon, authenticated;
create index if not exists recipient_notices_due   on public.recipient_notices (status, next_attempt_at);
create index if not exists recipient_notices_phone on public.recipient_notices (to_phone, created_at);
create index if not exists recipient_notices_tx    on public.recipient_notices (transaction_id);

-- Remplit la file pour une transaction confirmée. Ne casse JAMAIS la transaction (toute erreur est avalée).
create or replace function public.enqueue_recipient_notices(p_tx uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  t public.transactions; b jsonb; v_iso text; v_e text; v_rp public.profiles; v_n int; v_status text; v_err text;
  v_enabled text[] := array['OM','AE','ML','CI','BF'];          -- pays pour lesquels l'envoi de SMS est autorisé
begin
  select * into t from public.transactions where id = p_tx;
  if t.id is null or t.status not in ('CONFIRMED','SUCCESS','COMPLETED') then return; end if;

  if t.kind = 'FIAT_EXTERNAL' then
    b := coalesce(t.meta -> 'beneficiary', '{}'::jsonb);
    v_iso := upper(btrim(coalesce(b ->> 'country', '')));
    v_e := public._phone_e164(b ->> 'phone', v_iso);
    if v_e is null then return; end if;                          -- virement bancaire : pas de numéro à prévenir

    v_status := 'PENDING'; v_err := null;
    if not (v_iso = any (v_enabled)) then v_status := 'SKIPPED'; v_err := 'country_not_enabled';
    else
      select count(*) into v_n from public.recipient_notices
        where to_phone = v_e and channel = 'SMS' and status <> 'SKIPPED' and created_at > now() - interval '24 hours';
      if v_n >= 5 then v_status := 'SKIPPED'; v_err := 'rate_limited_recipient';
      else
        select count(*) into v_n from public.recipient_notices n join public.transactions x on x.id = n.transaction_id
          where x.sender_id = t.sender_id and n.channel = 'SMS' and n.status <> 'SKIPPED' and n.created_at > now() - interval '24 hours';
        if v_n >= 20 then v_status := 'SKIPPED'; v_err := 'rate_limited_sender'; end if;
      end if;
    end if;
    insert into public.recipient_notices (transaction_id, channel, audience, to_phone, country, status, error_message, idempotency_key)
      values (t.id, 'SMS', 'EXTERNAL', v_e, v_iso, v_status, v_err, 'tx:' || t.id || ':sms:ext')
      on conflict (idempotency_key) do nothing;

    -- Même message par e-mail quand ce numéro appartient à un compte actif qui a une adresse e-mail.
    -- L'e-mail ne dépend PAS de la liste des pays SMS (un compte égyptien reçoit l'e-mail même sans SMS) ;
    -- seules les limites anti-abus (par numéro, par expéditeur) s'appliquent aussi à lui.
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

-- Branchement dans le trigger existant : comportement e-mail inchangé, notification en plus, jamais bloquante.
create or replace function public.trg_tx_email() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status in ('CONFIRMED','SUCCESS','COMPLETED')
     and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.enqueue_tx_emails(new.id);
    begin
      perform public.enqueue_recipient_notices(new.id);
    exception when others then null;
    end;
  end if;
  return new;
end $$;

----------------------------------------------------------------------------------------------------
-- D. File : réservation et statut
-- (Version finale appliquée.) Un premier projet prévoyait que la base appelle elle-même la fonction send-notice
-- (pg_net + secret partagé + cron toutes les 5 minutes). Cette partie n'a PAS été appliquée et a été retirée :
-- c'est l'application, connectée avec le jeton de l'utilisateur, qui demande l'envoi juste après le transfert et à
-- l'ouverture du reçu (supabase/functions/send-notice, verify_jwt = true). Aucun secret n'est lu ni transmis par la base.
----------------------------------------------------------------------------------------------------
create or replace function public.claim_recipient_notices(p_id uuid default null, p_limit integer default 20)
returns setof public.recipient_notices
language plpgsql security definer set search_path = '' as $$
begin
  -- un message de plus de 24 h n'a plus de sens (ex. crédits SMS ajoutés après coup) : on ne l'envoie pas
  update public.recipient_notices set status = 'SKIPPED', locked_at = null, error_message = 'expired'
    where status in ('PENDING','FAILED') and created_at < now() - interval '24 hours';
  return query
  with c as (
    select id from public.recipient_notices
    where attempts < 5
      and ((status in ('PENDING','FAILED') and next_attempt_at <= now())
           or (status = 'SENDING' and locked_at < now() - interval '10 minutes'))
      and (p_id is null or id = p_id)
    order by created_at limit greatest(p_limit, 1)
    for update skip locked)
  update public.recipient_notices l set status = 'SENDING', locked_at = now()
  from c where l.id = c.id returning l.*;
end $$;

-- Statut visible par l'expéditeur de la transaction (aucun numéro ni e-mail n'est renvoyé).
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
      when error_message in ('country_not_enabled','rate_limited_recipient','rate_limited_sender','expired','invalid_phone') then error_message
      else 'provider_error' end) order by channel), '[]'::jsonb)
  into r from public.recipient_notices where transaction_id = p_tx;
  return r;
end $$;

revoke all on function public._notice_dial(text), public._phone_e164(text, text),
  public.enqueue_recipient_notices(uuid),
  public.claim_recipient_notices(uuid, integer), public.get_recipient_notice_status(uuid)
  from public, anon, authenticated;
grant execute on function public.claim_recipient_notices(uuid, integer) to service_role;
grant execute on function public.get_recipient_notice_status(uuid) to authenticated;
