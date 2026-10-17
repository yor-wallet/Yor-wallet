-- 12.5.0 : suivi de la remise des SMS + solde disponible lisible par le reçu.
-- Ne modifie AUCUNE règle de transaction : colonnes d'information sur la file de messages, une fonction de lecture du solde déjà écrit au registre.
-- À appliquer AVANT de redéployer l'Edge Function send-notice 12.5.0 (elle écrit ces colonnes).

-- 1. Suivi de la remise (rapport du fournisseur). NULL = e-mail ou ligne antérieure à cette migration.
alter table public.recipient_notices
  add column if not exists delivery_status text,
  add column if not exists delivery_checked_at timestamptz,
  add column if not exists delivered_at timestamptz,
  add column if not exists delivery_error text;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'recipient_notices_delivery_status_check' and conrelid = 'public.recipient_notices'::regclass) then
    alter table public.recipient_notices
      add constraint recipient_notices_delivery_status_check
      check (delivery_status is null or delivery_status in ('PENDING', 'DELIVERED', 'UNDELIVERABLE', 'UNKNOWN', 'UNSUPPORTED'));
  end if;
end $$;

-- Index partiel : seulement les SMS dont la remise reste à lire.
create index if not exists recipient_notices_delivery_pending_idx
  on public.recipient_notices (sent_at)
  where channel = 'SMS' and status = 'SENT' and delivery_status = 'PENDING';

-- 2. Le balayage (chaque minute) relance aussi la lecture des rapports de remise (SMS envoyés dans les 24 h, rapport pas encore connu).
create or replace function public._dispatch_sweep()
returns void language plpgsql security definer set search_path to '' as $$
begin
  if exists (select 1 from public.recipient_notices
             where status in ('PENDING', 'FAILED') and attempts < 5 and next_attempt_at <= now() and created_at > now() - interval '2 hours')
     or exists (select 1 from public.recipient_notices
                where channel = 'SMS' and status = 'SENT' and delivery_status = 'PENDING'
                  and sent_at > now() - interval '24 hours'
                  and (delivery_checked_at is null or delivery_checked_at < now() - interval '90 seconds')) then
    perform public._dispatch_notices(null);
  end if;
exception when others then
  raise warning '_dispatch_sweep failed: %', sqlerrm;
end $$;

-- 3. Le reçu lit l'état de remise (jamais le motif brut du fournisseur).
create or replace function public.get_recipient_notice_status(p_tx uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_u uuid := (select auth.uid()); r jsonb;
begin
  if v_u is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.transactions where id = p_tx and sender_id = v_u) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'audience', audience, 'status', status,
    'delivery', case when channel = 'SMS' and status = 'SENT' then delivery_status else null end,
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

-- 4. Solde disponible APRÈS la transaction, tel que le registre l'a écrit au moment du débit / du crédit (jamais recalculé).
--    Réservé à la personne concernée : son propre mouvement de registre pour cette transaction.
create or replace function public.get_tx_balance_after(p_tx uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_u uuid := (select auth.uid()); r jsonb;
begin
  if v_u is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  select jsonb_build_object('amount', le.balance_after, 'asset', le.asset, 'at', le.created_at) into r
  from public.ledger_entries le
  where le.transaction_id = p_tx and le.user_id = v_u
  order by le.id desc limit 1;
  return r;   -- NULL si la personne n'a aucun mouvement pour cette transaction
end $$;

revoke all on function public.get_tx_balance_after(uuid) from public, anon;
grant execute on function public.get_tx_balance_after(uuid) to authenticated;
revoke all on function public.get_recipient_notice_status(uuid) from public, anon;
grant execute on function public.get_recipient_notice_status(uuid) to authenticated;
