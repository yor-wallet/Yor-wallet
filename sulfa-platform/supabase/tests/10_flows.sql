-- SULFA — end-to-end SQL tests on a local PostgreSQL (Supabase stub). Each block raises an exception on failure.
\set ON_ERROR_STOP 1
set client_min_messages = notice;

create schema if not exists t;
grant usage on schema t to anon, authenticated;
create or replace function t.expect_error(p_sql text, p_pattern text) returns void language plpgsql as $$
begin
  begin execute p_sql; exception when others then
    if sqlerrm !~* p_pattern then raise exception 'expected error /%/ for [%], got: %', p_pattern, p_sql, sqlerrm; end if;
    return;
  end;
  raise exception 'expected error /%/ but [%] succeeded', p_pattern, p_sql;
end $$;
create or replace function t.ok(cond boolean, label text) returns void language plpgsql as $$
begin if cond is not true then raise exception 'FAILED: %', label; end if; raise notice 'PASS %', label; end $$;
grant execute on all functions in schema t to anon, authenticated;

-- people
insert into auth.users (id, email, raw_user_meta_data) values
 ('a0000000-0000-0000-0000-00000000000a', 'admin@sulfa.test', '{}'),
 ('b0000000-0000-0000-0000-00000000000b', 'reviewer@sulfa.test', '{}'),
 ('c1000000-0000-0000-0000-0000000000c1', 'client1@sulfa.test', '{"first_name":"Aisha","last_name":"Al Balushi","nationality":"OM","gender":"F","date_of_birth":"1995-04-12","phone":"+96891234567","language":"fr","terms_accepted":"true"}'),
 ('c2000000-0000-0000-0000-0000000000c2', 'client2@sulfa.test', '{"first_name":"Salim","last_name":"Al Harthy","phone":"+96899887766"}')
on conflict do nothing;
select public.sulfa_bootstrap_admin('admin@sulfa.test');
select t.ok((select role from public.sulfa_admins where email = 'admin@sulfa.test') = 'SUPER_ADMIN', 'bootstrap admin from the SQL editor');

-- ---------- 1. direct writes are impossible, even for the database owner ----------
select t.expect_error($$insert into public.sulfa_transactions (reference, transaction_type, amount, source, validated_by, idempotency_key) values ('X','CAPITAL_DEPOSIT',1,'ADMIN','a0000000-0000-0000-0000-00000000000a','x12345678')$$, 'sulfa_direct_write_forbidden');
select t.expect_error($$update public.sulfa_settings set reference_capital = 5$$, 'sulfa_direct_write_forbidden');
select t.ok(true, 'owner / service role cannot write money tables outside the server functions');

set role anon;
select t.expect_error($$select * from public.sulfa_applications$$, 'permission denied');
select t.expect_error($$select public.sulfa_ensure_profile()$$, 'permission denied');
select t.ok((public.sulfa_quote(1000, 6)->>'total')::numeric = 1000, 'anonymous visitor can use the simulator (quote)');
reset role;

-- ---------- 2. client 1: profile from sign-up metadata ----------
set role authenticated; select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-0000000000c1', false);
select public.sulfa_ensure_profile();
select t.ok((select first_name || '|' || preferred_language || '|' || identity_status from public.sulfa_profiles) = 'Aisha|fr|NOT_SUBMITTED', 'profile created from sign-up data, identity not submitted');
select t.ok((select count(*) from public.sulfa_notifications where template_key = 'WELCOME') = 1, 'welcome notification');
select t.expect_error($$insert into public.sulfa_applications (reference, user_id, requested_amount, requested_term, quote, terms_accepted_at, idempotency_key) values ('x', auth.uid(), 1000, 6, '{}', now(), 'k1234567')$$, 'permission denied');
select t.expect_error($$update public.sulfa_profiles set identity_status = 'VERIFIED'$$, 'permission denied');
select t.ok(true, 'a client cannot write any table directly (not even to mark himself verified)');

-- quote rules
select t.ok((select q->>'monthly' = '166.667' and q->>'last' = '166.665' from (select public.sulfa_quote(1000, 6) q) x), 'quote: 1000 OMR / 6 months, no fees configured');
select t.expect_error($$select public.sulfa_quote(499, 6)$$, 'sulfa_amount_out_of_range');
select t.expect_error($$select public.sulfa_quote(10001, 6)$$, 'sulfa_amount_out_of_range');
select t.expect_error($$select public.sulfa_quote(1000, 2)$$, 'sulfa_term_out_of_range');
select t.expect_error($$select public.sulfa_quote(1000, 10)$$, 'sulfa_term_out_of_range');
select t.ok(true, 'amount 500..10 000 and term 3..9 enforced by the server');

-- application
select t.expect_error($$select public.sulfa_submit_application(2000, 6, false, 'app-key-0001')$$, 'sulfa_terms_not_accepted');
select public.sulfa_submit_application(2000, 6, true, 'app-key-0001');
select t.ok((select count(*) from public.sulfa_applications) = 1 and (select status from public.sulfa_applications) = 'SUBMITTED', 'application submitted (status SUBMITTED, reference SLF-…)');
select public.sulfa_submit_application(2000, 6, true, 'app-key-0001');
select t.ok((select count(*) from public.sulfa_applications) = 1, 'same request twice (idempotency key) = one application');
select t.expect_error($$select public.sulfa_submit_application(800, 3, true, 'app-key-0002')$$, 'sulfa_open_application_exists');
select t.expect_error($$select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'APPROVE', null)$$, 'sulfa_forbidden');
select t.expect_error($$select public.sulfa_admin_overview()$$, 'sulfa_forbidden');
select t.expect_error($$select public.sulfa_admin_record_capital(1000, 'X', 'x', 'cap-key-0001')$$, 'sulfa_forbidden');
select t.ok(true, 'a client cannot call any administrator function (server-side check)');

-- documents
select t.expect_error($$select public.sulfa_register_document('id_front', 'c2000000-0000-0000-0000-0000000000c2/front.jpg')$$, 'sulfa_invalid_path');
select public.sulfa_register_document('id_front', 'c1000000-0000-0000-0000-0000000000c1/front.jpg');
select public.sulfa_register_document('id_back', 'c1000000-0000-0000-0000-0000000000c1/back.jpg');
select public.sulfa_register_document('selfie', 'c1000000-0000-0000-0000-0000000000c1/selfie.jpg');
select t.ok((select identity_status from public.sulfa_profiles) = 'PENDING', 'documents received: identity PENDING (never verified by the client)');
select t.expect_error($$insert into storage.objects (bucket_id, name) values ('sulfa-identity', 'c2000000-0000-0000-0000-0000000000c2/x.jpg')$$, 'row-level security');
select t.ok(true, 'storage: a client cannot upload into another client''s folder');
reset role;

-- ---------- 3. client 2 sees nothing of client 1 ----------
set role authenticated; select set_config('request.jwt.claim.sub', 'c2000000-0000-0000-0000-0000000000c2', false);
select public.sulfa_ensure_profile();
select t.ok((select count(*) from public.sulfa_applications) = 0 and (select count(*) from public.sulfa_documents) = 0 and (select count(*) from public.sulfa_profiles) = 1
  and (select count(*) from public.sulfa_notifications) = 1, 'client 2 sees only his own rows (RLS)');
reset role;

-- ---------- 4. administrator: settings, documents, decision ----------
set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select public.sulfa_admin_set_admin('b0000000-0000-0000-0000-00000000000b', 'REVIEWER', true);
select public.sulfa_admin_update_settings('{"fee_percent": 2, "monthly_rate_percent": 1}');
select t.ok((select fee_percent = 2 and monthly_rate_percent = 1 and reference_capital = 1000000 from public.sulfa_settings), 'settings: fees / rate configured by the SUPER_ADMIN; reference capital 1 000 000,000 OMR');
select t.expect_error($$select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'APPROVE', null)$$, 'sulfa_identity_not_verified');
select t.ok(true, 'no approval while the identity is not verified by an administrator');
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-00000000000b', false);
select t.expect_error($$select public.sulfa_admin_update_settings('{"fee_percent": 0}')$$, 'sulfa_forbidden');
select t.expect_error($$select public.sulfa_admin_review_document((select id from public.sulfa_documents where document_type = 'id_front'), 'REJECTED', '')$$, 'sulfa_reason_required');
select public.sulfa_admin_review_document(id, 'IN_REVIEW', null) from public.sulfa_documents where document_type in ('id_front','id_back','selfie');
select public.sulfa_admin_review_document(id, 'VERIFIED', null) from public.sulfa_documents where document_type in ('id_front','id_back');
select t.ok((select identity_status from public.sulfa_profiles where user_id = 'c1000000-0000-0000-0000-0000000000c1') = 'IN_REVIEW', 'both sides of the ID verified but the selfie not yet: identity is NOT verified');
select public.sulfa_admin_review_document(id, 'VERIFIED', null) from public.sulfa_documents where document_type = 'selfie';
select t.ok((select identity_status from public.sulfa_profiles where user_id = 'c1000000-0000-0000-0000-0000000000c1') = 'VERIFIED', 'identity VERIFIED only after the reviewer validated both sides and the selfie');
select t.ok((select count(*) from public.sulfa_notifications where user_id = 'c1000000-0000-0000-0000-0000000000c1' and template_key = 'IDENTITY_VERIFIED') = 1
  and (select language || '|' || status from public.sulfa_email_log where user_id = 'c1000000-0000-0000-0000-0000000000c1' and template_key = 'IDENTITY_VERIFIED') = 'ar|NO_PROVIDER',
  'validation: one IDENTITY_VERIFIED notification, its e-mail queued in Arabic (client language fr) and marked NO_PROVIDER until a provider is configured');
select t.ok((select count(*) from public.sulfa_documents where reviewed_by = 'b0000000-0000-0000-0000-00000000000b' and reviewed_at is not null and status = 'VERIFIED') = 3, 'each document decision keeps its author and date');
select t.expect_error($$select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'APPROVE', null)$$, 'sulfa_forbidden');
select t.ok(true, 'a REVIEWER validates documents but cannot approve financing');
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select t.expect_error($$select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'REJECT', '  ')$$, 'sulfa_reason_required');
select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'IN_REVIEW', null);
select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'APPROVE', 'Dossier complet', 2000, 6);
select t.ok((select status = 'APPROVED' and approved_amount = 2000 and approved_term = 6 and decided_by = 'a0000000-0000-0000-0000-00000000000a' and decided_at is not null
  and (approved_quote->>'fee')::numeric = 40 and (approved_quote->>'interest')::numeric = 120 and (approved_quote->>'total')::numeric = 2160 and (approved_quote->>'monthly')::numeric = 360
  from public.sulfa_applications), 'approved by the admin: 2000 OMR / 6 months, fee 40, interest 120, total 2160, monthly 360 (server-computed)');
select t.ok((select string_agg(coalesce(from_status, '-') || '>' || to_status || ':' || actor_role, ',' order by id) from public.sulfa_application_events)
  = '->SUBMITTED:CLIENT,SUBMITTED>IN_REVIEW:ADMIN,IN_REVIEW>APPROVED:ADMIN', 'status history: each transition with its actor');
select t.expect_error($$select public.sulfa_admin_decide_application((select id from public.sulfa_applications limit 1), 'REJECT', 'x')$$, 'sulfa_invalid_transition');

-- disbursement: approved and disbursed are two distinct states
select t.expect_error($$select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'CONFIRM', 'INT-1', 'disb-key-0001')$$, 'sulfa_invalid_transition');
select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'PREPARE', null, null);
select t.expect_error($$select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'CONFIRM', '', 'disb-key-0001')$$, 'sulfa_internal_reference_required');
select t.expect_error($$select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'CONFIRM', 'INT-1', 'disb-key-0001')$$, 'sulfa_platform_funds_insufficient');
select t.ok(true, 'no disbursement without funds really recorded (the reference capital creates no money)');
select public.sulfa_admin_record_capital(50000, 'DEP-2026-001', 'Apport initial', 'cap-key-0001');
select public.sulfa_admin_record_capital(50000, 'DEP-2026-001', 'Apport initial', 'cap-key-0001');
select t.ok((select count(*) from public.sulfa_transactions where transaction_type = 'CAPITAL_DEPOSIT') = 1, 'capital deposit recorded once (idempotency)');
select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'CONFIRM', 'INT-DISB-001', 'disb-key-0001');
select public.sulfa_admin_disbursement((select id from public.sulfa_applications limit 1), 'CONFIRM', 'INT-DISB-001', 'disb-key-0001');
select t.ok((select count(*) from public.sulfa_transactions where transaction_type = 'DISBURSEMENT') = 1, 'disbursement confirmed once, repeated confirmation creates nothing');
select t.ok((select status = 'DISBURSED' and disbursed_by = 'a0000000-0000-0000-0000-00000000000a' and disbursed_at is not null from public.sulfa_applications), 'DISBURSED with administrator and date');
select t.ok((select count(*) = 6 and sum(amount_due) = 2160 from public.sulfa_installments), '6 installments, sum = 2160 OMR');
select t.ok((select balance from public.sulfa_admin_account_balances() where code = 'LOANS_RECEIVABLE') = 2160
        and (select balance from public.sulfa_admin_account_balances() where code = 'FEE_INCOME') = 160
        and (select balance from public.sulfa_admin_account_balances() where code = 'PLATFORM_CASH') = 50000
        and (select balance from public.sulfa_admin_account_balances() where code like 'CLIENT:c1%') = 2000, 'ledger: receivable 2160, fees 160, cash 50000, client balance 2000');
reset role;

-- ---------- 5. withdrawal ----------
set role authenticated; select set_config('request.jwt.claim.sub', 'c1000000-0000-0000-0000-0000000000c1', false);
select t.ok((public.sulfa_my_summary()->>'available')::numeric = 2000 and (public.sulfa_my_summary()->>'outstanding')::numeric = 2160, 'client dashboard: available 2000, outstanding 2160 (from the ledger)');
select t.expect_error($$select public.sulfa_request_withdrawal(2500, 'Bank', 'Aisha', 'OM12345678', 'wd-key-0001')$$, 'sulfa_insufficient_funds');
select t.expect_error($$select public.sulfa_request_withdrawal(-5, 'Bank', 'Aisha', 'OM12345678', 'wd-key-0001')$$, 'sulfa_invalid_amount');
select public.sulfa_request_withdrawal(1500, 'Bank', 'Aisha Al Balushi', 'OM12345678', 'wd-key-0001');
select public.sulfa_request_withdrawal(1500, 'Bank', 'Aisha Al Balushi', 'OM12345678', 'wd-key-0001');
select t.ok((select count(*) from public.sulfa_withdrawals) = 1, 'withdrawal requested once (idempotency)');
select t.expect_error($$select public.sulfa_request_withdrawal(600, 'Bank', 'Aisha', 'OM12345678', 'wd-key-0002')$$, 'sulfa_insufficient_funds');
select t.ok((public.sulfa_my_summary()->>'reserved')::numeric = 1500 and (public.sulfa_my_summary()->>'available')::numeric = 500, 'reserved 1500 / available 500 while the withdrawal is open');
reset role;

set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select t.expect_error($$select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'PAY', null, 'PAY-1')$$, 'sulfa_invalid_transition');
select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'VERIFY', null, null);
select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'CONFIRM', null, null);
select t.expect_error($$select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'PAY', null, '')$$, 'sulfa_internal_reference_required');
select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'PAY', null, 'VIR-INT-0001');
select public.sulfa_admin_withdrawal_action((select id from public.sulfa_withdrawals limit 1), 'PAY', null, 'VIR-INT-0001');
select t.ok((select count(*) from public.sulfa_transactions where transaction_type = 'WITHDRAWAL') = 1, 'withdrawal paid once');
select t.ok((select status = 'PAID' and paid_by = 'a0000000-0000-0000-0000-00000000000a' and internal_reference = 'VIR-INT-0001' and operator_id is null and external_reference is null from public.sulfa_withdrawals),
  'PAID by the administrator with an internal reference; operator fields stay empty');
select t.ok((select balance from public.sulfa_admin_account_balances() where code like 'CLIENT:c1%') = 500 and (select balance from public.sulfa_admin_account_balances() where code = 'PLATFORM_CASH') = 48500, 'ledger after withdrawal: client 500, cash 48500');

-- ---------- 6. repayments ----------
select t.expect_error($$select public.sulfa_admin_record_repayment((select id from public.sulfa_applications limit 1), 3000, 'R-1', 'rep-key-0000')$$, 'sulfa_overpayment');
select public.sulfa_admin_record_repayment((select id from public.sulfa_applications limit 1), 360, 'ESP-0001', 'rep-key-0001');
select public.sulfa_admin_record_repayment((select id from public.sulfa_applications limit 1), 360, 'ESP-0001', 'rep-key-0001');
select t.ok((select count(*) from public.sulfa_repayments) = 1 and (select status from public.sulfa_installments where seq = 1) = 'PAID', 'repayment recorded once; installment 1 PAID');
select public.sulfa_admin_record_repayment((select id from public.sulfa_applications limit 1), 1800, 'VIR-0002', 'rep-key-0002');
select t.ok((select status from public.sulfa_applications) = 'COMPLETED' and (select count(*) from public.sulfa_installments where status = 'PAID') = 6, 'fully repaid: application COMPLETED');
select t.ok((select balance from public.sulfa_admin_account_balances() where code = 'LOANS_RECEIVABLE') = 0 and (select balance from public.sulfa_admin_account_balances() where code = 'PLATFORM_CASH') = 50660, 'receivable 0, cash 50660');

-- ---------- 7. correction (reversal) and immutability ----------
select t.expect_error($$select public.sulfa_admin_reverse_transaction((select id from public.sulfa_transactions where transaction_type = 'CAPITAL_DEPOSIT'), '', 'rev-key-0001')$$, 'sulfa_reason_required');
select public.sulfa_admin_reverse_transaction((select id from public.sulfa_transactions where transaction_type = 'CAPITAL_DEPOSIT'), 'Erreur de saisie', 'rev-key-0001');
select t.ok((select status from public.sulfa_transactions where transaction_type = 'CAPITAL_DEPOSIT') = 'REVERSED' and (select count(*) from public.sulfa_transactions where transaction_type = 'REVERSAL') = 1
  and (select balance from public.sulfa_admin_account_balances() where code = 'PLATFORM_CASH') = 660, 'correction = new traceable REVERSAL; original kept and marked REVERSED');
select t.expect_error($$select public.sulfa_admin_reverse_transaction((select id from public.sulfa_transactions where transaction_type = 'CAPITAL_DEPOSIT'), 'again', 'rev-key-0002')$$, 'sulfa_invalid_transition');
reset role;
-- outside a server function the rpc-only guard fires first; inside one, immutability still refuses
select t.expect_error($$update public.sulfa_ledger_entries set amount = 1$$, 'sulfa_immutable|sulfa_direct_write_forbidden');
select t.expect_error($$delete from public.sulfa_ledger_entries$$, 'sulfa_immutable|sulfa_direct_write_forbidden');
select t.expect_error($$delete from public.sulfa_audit_logs$$, 'sulfa_immutable|sulfa_direct_write_forbidden');
select t.expect_error($q$do $x$ begin perform set_config('sulfa.rpc','on',true); update public.sulfa_ledger_entries set amount = 1; end $x$$q$, 'sulfa_immutable');
select t.expect_error($q$do $x$ begin perform set_config('sulfa.rpc','on',true); delete from public.sulfa_ledger_entries; end $x$$q$, 'sulfa_immutable');
select t.expect_error($q$do $x$ begin perform set_config('sulfa.rpc','on',true); delete from public.sulfa_audit_logs; end $x$$q$, 'sulfa_immutable');
select t.expect_error($q$do $x$ begin perform set_config('sulfa.rpc','on',true); update public.sulfa_transactions set amount = 1; end $x$$q$, 'sulfa_immutable');
select t.ok(true, 'ledger entries, audit and recorded amounts cannot be changed, even by the database owner');
select t.expect_error($q$do $x$ declare tx uuid; begin perform set_config('sulfa.rpc','on',true);
  insert into public.sulfa_transactions (reference, transaction_type, amount, source, validated_by, idempotency_key) values ('BAD','CAPITAL_DEPOSIT',10,'ADMIN','a0000000-0000-0000-0000-00000000000a','bad-key-0001') returning id into tx;
  insert into public.sulfa_ledger_entries (transaction_id, account_id, side, amount) values (tx, (select id from public.sulfa_accounts where code='PLATFORM_CASH'), 'DEBIT', 10);
  set constraints all immediate; end $x$$q$, 'sulfa_unbalanced_transaction');
select t.ok(true, 'an unbalanced transaction is refused');
select t.ok((select sum(amount) filter (where side = 'DEBIT') = sum(amount) filter (where side = 'CREDIT') from public.sulfa_ledger_entries), 'whole ledger balanced (debits = credits)');

-- ---------- 8. audit, notifications, overview ----------
select t.ok((select count(*) from public.sulfa_audit_logs where actor_role = 'ADMIN' and actor_id is not null and action in
  ('APPLICATION_IN_REVIEW','APPLICATION_APPROVED','DISBURSEMENT_PREPARED','DISBURSEMENT_CONFIRMED','CAPITAL_RECORDED','WITHDRAWAL_IN_VERIFICATION','WITHDRAWAL_CONFIRMED',
   'WITHDRAWAL_PAID','REPAYMENT_RECORDED','TRANSACTION_REVERSED','SETTINGS_UPDATED','ADMIN_SET','DOCUMENT_VERIFIED','DOCUMENT_IN_REVIEW')) >= 15, 'every administrator action is in the audit log with its author');
select t.ok((select reason from public.sulfa_audit_logs where action = 'TRANSACTION_REVERSED') = 'Erreur de saisie', 'audit keeps the reason');
select t.ok((select string_agg(template_key, ',' order by created_at, template_key) from public.sulfa_notifications where user_id = 'c1000000-0000-0000-0000-0000000000c1') ~
  'APPLICATION_SUBMITTED.*APPLICATION_APPROVED.*DISBURSEMENT_PREPARING.*DISBURSEMENT_CONFIRMED.*WITHDRAWAL_REQUESTED.*WITHDRAWAL_CONFIRMED.*WITHDRAWAL_PAID.*REPAYMENT_RECEIVED', 'client notified at each real step');
select t.ok((select params->>'reference' from public.sulfa_notifications where template_key = 'APPLICATION_APPROVED') = (select reference from public.sulfa_applications)
  and (select (params->>'amount')::numeric from public.sulfa_notifications where template_key = 'WITHDRAWAL_PAID') = 1500, 'notifications carry the recorded reference and amount');
select t.ok((select count(*) from public.sulfa_email_log where status = 'NO_PROVIDER') = (select count(*) from public.sulfa_notifications), 'e-mail log records the real state: no provider connected');

set role authenticated; select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-00000000000a', false);
select t.ok((select o->>'reference_capital' = '1000000.000' and (o->>'cash_available')::numeric = 660 and (o->>'disbursed_amount')::numeric = 2000
  and (o->>'repaid_amount')::numeric = 2160 and (o->>'withdrawn_amount')::numeric = 1500 and (o->>'operators_enabled')::int = 0 from (select public.sulfa_admin_overview() o) x),
  'admin overview: reference capital 1 000 000,000 shown apart from real cash (660,000); no operator enabled');
select t.ok(public.sulfa_admin_send_due_reminders(400) = 0, 'no reminder for paid installments');
reset role;
select 'ALL SULFA SQL TESTS PASSED' as result;
