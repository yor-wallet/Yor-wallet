-- 12.5.0 : le reçu dit POURQUOI un SMS accepté par le fournisseur n'a pas été remis (ex. plus de crédit SMS),
-- au lieu d'une phrase générique. Seul le motif est ajouté ; aucune autre colonne, aucune règle de transaction.
-- Le motif brut du fournisseur n'est jamais renvoyé : seulement un code court connu du reçu.
create or replace function public.get_recipient_notice_status(p_tx uuid)
returns jsonb language plpgsql stable security definer set search_path to '' as $$
declare v_u uuid := (select auth.uid()); r jsonb;
begin
  if v_u is null then raise exception 'unauthenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.transactions where id = p_tx and sender_id = v_u) then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('channel', channel, 'audience', audience, 'status', status,
    'delivery', case when channel = 'SMS' and status = 'SENT' then delivery_status else null end,
    'reason', case
      when status = 'SENT' then
        case when channel = 'SMS' and delivery_status = 'UNDELIVERABLE' and delivery_error ilike '%credit%' then 'sms_credits_missing' else null end
      when error_message is null then null
      when error_message ilike '%credit%' then 'sms_credits_missing'
      when error_message ilike '%not configured%' then 'provider_not_configured'
      when error_message in ('country_not_enabled','rate_limited_recipient','rate_limited_sender','expired','invalid_phone','no_sender_phone') then error_message
      else 'provider_error' end) order by audience desc, channel), '[]'::jsonb)
  into r from public.recipient_notices where transaction_id = p_tx;
  return r;
end $$;

revoke all on function public.get_recipient_notice_status(uuid) from public, anon;
grant execute on function public.get_recipient_notice_status(uuid) to authenticated;
