-- 12.12.0 (17 octobre 2026) — AUCUN FRAIS sur les transferts d'argent (décision du propriétaire : « enlève le système de frais, il n'y a pas de frais »).
-- Avant : _fiat_send_external_impl débitait montant + 1.000 OMR de frais + 0.050 OMR de TVA (5 %).
-- Maintenant : frais = 0, TVA = 0, total débité = montant envoyé.
-- Seule la valeur v_fee change (1.000 -> 0.000) ; le reste de la fonction est identique à la version en production (limites, idempotence, journal, notifications).
-- Les anciennes transactions gardent leurs frais réels (colonnes transactions.fee / total) : l'historique et les reçus restent exacts.
-- Non touché volontairement : les fonctions bancaires et crypto (_bank_send_impl, _crypto_*), masquées dans l'application depuis 12.12.0.
CREATE OR REPLACE FUNCTION public._fiat_send_external_impl(p_amount numeric, p_dest_currency text, p_provider text, p_beneficiary jsonb, p_idempotency_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_u uuid := (select auth.uid()); v_cur text := upper(btrim(coalesce(p_dest_currency,'OMR')));
  v_amt numeric; v_fee numeric := 0.000; v_vat numeric; v_total numeric; v_per numeric; v_dest numeric; v_today numeric;
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
