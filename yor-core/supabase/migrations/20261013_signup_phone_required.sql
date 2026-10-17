-- 20261013_signup_phone_required.sql
-- 12.6.0: a phone number is mandatory to open an account. The client sends user metadata
-- phone ("+<8-15 digits>") and country (ISO-2); the trigger refuses the sign-up when the phone is missing or malformed.
create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_yor text; v_try int := 0; v_lang text := lower(left(coalesce(meta->>'language',''), 2));
  v_phone text := btrim(coalesce(meta->>'phone',''));
  v_prefs jsonb := '{"theme":"dark","primaryCurrency":"OMR","notifications":true,"vibration":true,"hideBalances":false}'::jsonb;
begin
  if v_phone !~ '^\+[0-9]{8,15}$' then
    raise exception 'phone number required' using errcode = 'P0001', hint = 'PHONE_REQUIRED';
  end if;
  loop
    v_yor := public.gen_yor_id();
    begin
      insert into public.profiles (id, user_id, yor_id, email, first_name, last_name, phone, country)
      values (new.id, 'usr_' || upper(substr(replace(new.id::text, '-', ''), 1, 8)), v_yor, new.email,
        left(coalesce(meta->>'first_name', ''), 80), left(coalesce(meta->>'last_name', ''), 80),
        left(v_phone, 32), coalesce(nullif(left(meta->>'country', 2), ''), 'OM'));
      exit;
    exception when unique_violation then
      v_try := v_try + 1; if v_try > 5 then raise; end if;
    end;
  end loop;

  insert into public.accounts (user_id, type, name, currency, country) values
    (new.id, 'MAIN', 'Main OMR', 'OMR', 'OM'), (new.id, 'WEST_AFRICA', 'West Africa', 'XOF', 'CI');
  insert into public.crypto_wallets (user_id, asset, network) values
    (new.id, 'BTC', 'bitcoin'), (new.id, 'ETH', 'ethereum'), (new.id, 'USDT', 'tron'), (new.id, 'USDC', 'ethereum'),
    (new.id, 'BNB', 'bsc'), (new.id, 'SOL', 'solana'), (new.id, 'XRP', 'xrp'), (new.id, 'LTC', 'litecoin');

  if v_lang in ('fr','en','ar') then v_prefs := v_prefs || jsonb_build_object('language', v_lang); end if;
  insert into public.user_docs (user_id, doc_name, data) values
    (new.id, 'preferences', v_prefs),
    (new.id, 'security', '{"failedAttempts":0,"lockUntil":0}'::jsonb);
  return new;
end $function$;
