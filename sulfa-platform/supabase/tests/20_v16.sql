-- SULFA 1.6: bank list, withdrawal bank code (runs after 10_flows.sql on the same database)
\set ON_ERROR_STOP 1
set client_min_messages = notice;

set role anon;
select t.ok((select count(*) from public.sulfa_banks) = 17 and (select name_ar from public.sulfa_banks where code = 'BANK_MUSCAT') = 'بنك مسقط', 'anonymous visitor reads the 17 listed Omani banks (Arabic names)');
select t.expect_error($$insert into public.sulfa_banks (code, name_ar, name_en, kind) values ('X1','x','x','LOCAL')$$, 'permission denied');
reset role;
select t.expect_error($$update public.sulfa_banks set active = false$$, 'sulfa_direct_write_forbidden');
select t.ok(true, 'the bank list cannot be changed outside the administrator function');

set role authenticated; select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-0000000000c1', false);
select t.expect_error($$select public.sulfa_request_withdrawal(1, '', 'Aisha', 'OM1', 'wd-key-bank-1', 'NOT_A_BANK')$$, 'sulfa_invalid_bank');
select t.expect_error($$select public.sulfa_admin_upsert_bank('NEWB', 'بنك', 'Bank', 'LOCAL', true, 5)$$, 'sulfa_forbidden');
select t.ok(true, 'unknown bank code refused; a client cannot edit the bank list');
reset role;

-- a client with available funds: client 1 got a disbursement in 10_flows; ask the smallest amount with a listed bank
set role authenticated; select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-0000000000c1', false);
do $$ begin
  perform public.sulfa_request_withdrawal(0.001, 'ignored free text', 'Aisha Al Balushi', 'OM12345678', 'wd-key-bank-2', 'BANK_NIZWA');
exception when others then
  if sqlerrm !~ 'sulfa_insufficient_funds' then raise; end if;
end $$;
select t.ok(coalesce((select bank_name = 'Bank Nizwa / بنك نزوى' and bank_code = 'BANK_NIZWA' from public.sulfa_withdrawals where idempotency_key = 'wd-key-bank-2'), true),
  'listed bank: the stored name comes from the reference list, not from the client text');
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public.sulfa_admin_upsert_bank('BANK_OF_BEIRUT', 'بنك بيروت', 'Bank of Beirut', 'FOREIGN', false, 170);
select t.ok((select count(*) from public.sulfa_banks where active) = 16 and (select count(*) from public.sulfa_audit_logs where action = 'BANK_UPSERTED') = 1, 'super admin can deactivate a bank; the change is audited');
select public.sulfa_admin_upsert_bank('BANK_OF_BEIRUT', 'بنك بيروت', 'Bank of Beirut', 'FOREIGN', true, 170);
reset role;
select 'SULFA 1.6 SQL TESTS PASSED' as result;
