-- =====================================================================================================================
-- SULFA — سلفه · core schema (additive). Creates ONLY objects prefixed sulfa_ in the public schema, plus one private
-- storage bucket. It never renames, truncates, deletes or alters existing (Friendly Pay) tables, rows or triggers.
-- Run AFTER a database backup. Idempotent: safe to run twice.
--
-- Principles
--   * 100 % local: no external financial operator is connected. Every confirmation, validation and decision is an
--     explicit action of an ADMINISTRATOR through a server function (security definer) that checks the role, writes the
--     change atomically and records an audit line (who, when, what, why).
--   * Clients never write tables directly: RLS gives them read access to THEIR rows only; every write is an RPC.
--   * Money = double-entry ledger. Balances are computed from recorded entries. Entries are immutable (no UPDATE / DELETE,
--     even with the service role); a correction is a new, traceable reversal transaction validated by an administrator.
--   * The "reference capital" (1 000 000,000 OMR) is a configuration value. It is shown separately and never creates funds.
-- =====================================================================================================================

create extension if not exists pgcrypto;
-- the migration itself may write the first rows (settings, platform accounts) even when re-run after the guards exist
select set_config('sulfa.rpc', 'on', false);

-- ---------------------------------------------------------------------------------------------------------------------
-- 0. internal helpers
-- ---------------------------------------------------------------------------------------------------------------------
-- RPCs set sulfa.rpc=on (transaction-local) before writing; guard triggers refuse writes made any other way.
create or replace function public.sulfa__enter() returns void language sql as $$ select set_config('sulfa.rpc', 'on', true) $$;
create or replace function public.sulfa__in_rpc() returns boolean language sql stable as $$ select coalesce(current_setting('sulfa.rpc', true), '') = 'on' $$;
create or replace function public.sulfa__ref(prefix text) returns text language sql volatile as $$
  select prefix || '-' || to_char(now() at time zone 'Asia/Muscat', 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. tables
-- ---------------------------------------------------------------------------------------------------------------------
create table if not exists public.sulfa_settings (
  id boolean primary key default true check (id),
  reference_capital numeric(16,3) not null default 1000000.000 check (reference_capital >= 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  min_amount numeric(14,3) not null default 500 check (min_amount > 0),
  max_amount numeric(14,3) not null default 10000 check (max_amount >= min_amount),
  min_term integer not null default 3 check (min_term >= 1),
  max_term integer not null default 9 check (max_term >= min_term),
  fee_fixed numeric(14,3) not null default 0 check (fee_fixed >= 0),
  fee_percent numeric(7,4) not null default 0 check (fee_percent >= 0 and fee_percent <= 100),
  monthly_rate_percent numeric(7,4) not null default 0 check (monthly_rate_percent >= 0 and monthly_rate_percent <= 100),
  default_language text not null default 'ar' check (default_language in ('ar','fr','en')),
  max_open_applications integer not null default 1 check (max_open_applications >= 1),
  notifications_enabled boolean not null default true,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.sulfa_settings (id) values (true) on conflict (id) do nothing;

create table if not exists public.sulfa_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'ADMIN' check (role in ('SUPER_ADMIN','ADMIN','REVIEWER')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  nationality text not null default 'OM',
  gender text check (gender in ('M','F') or gender is null),
  date_of_birth date,
  email text,
  phone text,
  preferred_language text not null default 'ar' check (preferred_language in ('ar','fr','en')),
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE','SUSPENDED','CLOSED')),
  identity_status text not null default 'NOT_SUBMITTED' check (identity_status in ('NOT_SUBMITTED','PENDING','IN_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED')),
  terms_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sulfa_operators (                       -- future operators: table ready, EMPTY, disabled
  id text primary key,
  name text not null,
  country text,
  currencies text[] not null default '{}',
  operation_types text[] not null default '{}' check (operation_types <@ array['DEPOSIT','DISBURSEMENT','REPAYMENT','WITHDRAWAL']),
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,                               -- NON-secret settings only; secrets live server-side
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_applications (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  requested_amount numeric(14,3) not null check (requested_amount > 0),
  requested_term integer not null check (requested_term > 0),
  quote jsonb not null,                                                    -- server-computed snapshot (fee, rate, total, monthly)
  approved_amount numeric(14,3) check (approved_amount is null or approved_amount > 0),
  approved_term integer check (approved_term is null or approved_term > 0),
  approved_quote jsonb,
  currency text not null default 'OMR' check (currency = 'OMR'),
  status text not null default 'SUBMITTED' check (status in ('DRAFT','SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED','APPROVED','REJECTED','CANCELLED','DISBURSEMENT_PENDING','DISBURSED','COMPLETED')),
  decision_reason text,
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  disbursed_by uuid references auth.users(id),
  disbursed_at timestamptz,
  disbursement_tx_id uuid,
  terms_accepted_at timestamptz not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.sulfa_application_events (
  id bigserial primary key,
  application_id uuid not null references public.sulfa_applications(id) on delete restrict,
  from_status text,
  to_status text not null,
  actor_id uuid references auth.users(id),
  actor_role text not null check (actor_role in ('CLIENT','ADMIN','SYSTEM')),
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('id_front','id_back','address_proof','other')),
  storage_path text not null,
  status text not null default 'PENDING' check (status in ('PENDING','IN_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED','REPLACED')),
  review_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                                               -- PLATFORM_CASH, EQUITY_CAPITAL, LOANS_RECEIVABLE, FEE_INCOME, CLIENT:<uid>
  owner_user_id uuid references auth.users(id) on delete restrict,
  account_type text not null check (account_type in ('PLATFORM_CASH','EQUITY_CAPITAL','LOANS_RECEIVABLE','FEE_INCOME','CLIENT_WALLET')),
  normal_side text not null check (normal_side in ('DEBIT','CREDIT')),
  currency text not null default 'OMR' check (currency = 'OMR'),
  label text not null default '',
  created_at timestamptz not null default now()
);
insert into public.sulfa_accounts (code, account_type, normal_side, label) values
  ('PLATFORM_CASH', 'PLATFORM_CASH', 'DEBIT', 'Fonds effectivement détenus par la plateforme'),
  ('EQUITY_CAPITAL', 'EQUITY_CAPITAL', 'CREDIT', 'Apports de capital enregistrés'),
  ('LOANS_RECEIVABLE', 'LOANS_RECEIVABLE', 'DEBIT', 'Financements à recevoir (encours)'),
  ('FEE_INCOME', 'FEE_INCOME', 'CREDIT', 'Frais et intérêts constatés')
on conflict (code) do nothing;

create table if not exists public.sulfa_transactions (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  transaction_type text not null check (transaction_type in ('CAPITAL_DEPOSIT','DISBURSEMENT','WITHDRAWAL','REPAYMENT','REVERSAL')),
  user_id uuid references auth.users(id) on delete restrict,
  application_id uuid references public.sulfa_applications(id) on delete restrict,
  withdrawal_id uuid,
  amount numeric(14,3) not null check (amount > 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  status text not null default 'RECORDED' check (status in ('RECORDED','REVERSED')),
  source text not null check (source in ('CLIENT','ADMIN')),
  created_by uuid references auth.users(id),
  validated_by uuid not null references auth.users(id),                   -- every money movement is validated by an administrator
  validated_at timestamptz not null default now(),
  internal_reference text,
  external_reference text,
  operator_id text references public.sulfa_operators(id),
  reverses_tx_id uuid references public.sulfa_transactions(id),
  reversed_by_tx_id uuid references public.sulfa_transactions(id),
  note text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sulfa_ledger_entries (
  id bigserial primary key,
  transaction_id uuid not null references public.sulfa_transactions(id) on delete restrict,
  account_id uuid not null references public.sulfa_accounts(id) on delete restrict,
  side text not null check (side in ('DEBIT','CREDIT')),
  amount numeric(14,3) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_installments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.sulfa_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  seq integer not null check (seq >= 1),
  due_date date not null,
  amount_due numeric(14,3) not null check (amount_due > 0),
  amount_paid numeric(14,3) not null default 0 check (amount_paid >= 0),
  status text not null default 'DUE' check (status in ('DUE','PARTIAL','PAID')),
  paid_at timestamptz,
  unique (application_id, seq),
  check (amount_paid <= amount_due)
);

create table if not exists public.sulfa_repayments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  application_id uuid not null references public.sulfa_applications(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(14,3) not null check (amount > 0),
  tx_id uuid not null references public.sulfa_transactions(id),
  internal_reference text not null,
  recorded_by uuid not null references auth.users(id),
  recorded_at timestamptz not null default now(),
  idempotency_key text not null unique
);

create table if not exists public.sulfa_withdrawals (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(14,3) not null check (amount > 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  bank_name text not null,
  account_holder text not null,
  bank_account text not null,
  status text not null default 'RECEIVED' check (status in ('RECEIVED','IN_VERIFICATION','PROCESSING','CONFIRMED','PAID','REJECTED','FAILED','CANCELLED')),
  decision_reason text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  paid_by uuid references auth.users(id),
  paid_at timestamptz,
  internal_reference text,
  tx_id uuid references public.sulfa_transactions(id),
  -- future operator fields: stay EMPTY while no operator is connected
  operator_id text references public.sulfa_operators(id),
  operator_operation_id text,
  external_reference text,
  submitted_at timestamptz,
  confirmed_at timestamptz,
  provider_response jsonb,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create table if not exists public.sulfa_payment_attempts (               -- future operators: request / response journal (empty today)
  id bigserial primary key,
  operator_id text not null references public.sulfa_operators(id),
  operation_type text not null check (operation_type in ('DEPOSIT','DISBURSEMENT','REPAYMENT','WITHDRAWAL')),
  related_id uuid,
  idempotency_key text not null,
  request jsonb,
  response jsonb,
  status text not null check (status in ('SENT','SUCCEEDED','FAILED','TIMEOUT')),
  attempt integer not null default 1,
  created_at timestamptz not null default now(),
  unique (operator_id, idempotency_key, attempt)
);

create table if not exists public.sulfa_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text not null,
  params jsonb not null default '{}'::jsonb,                               -- amounts, references, dates copied from the recorded rows
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_email_log (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  notification_id uuid references public.sulfa_notifications(id) on delete set null,
  template_key text not null,
  language text not null,
  to_email text,
  status text not null check (status in ('NO_PROVIDER','QUEUED','SENT','FAILED','SKIPPED')),
  provider text,
  provider_message_id text,
  error text,
  attempts integer not null default 0,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sulfa_message_templates (
  key text not null,
  language text not null check (language in ('ar','fr','en')),
  subject text not null,
  body text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  primary key (key, language)
);

create table if not exists public.sulfa_audit_logs (
  id bigserial primary key,
  actor_id uuid references auth.users(id),
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sulfa_apps_user_idx on public.sulfa_applications(user_id, created_at desc);
create index if not exists sulfa_apps_status_idx on public.sulfa_applications(status, created_at desc);
create index if not exists sulfa_events_app_idx on public.sulfa_application_events(application_id, id);
create index if not exists sulfa_docs_user_idx on public.sulfa_documents(user_id, created_at desc);
create index if not exists sulfa_tx_user_idx on public.sulfa_transactions(user_id, created_at desc);
create index if not exists sulfa_ledger_tx_idx on public.sulfa_ledger_entries(transaction_id);
create index if not exists sulfa_ledger_acct_idx on public.sulfa_ledger_entries(account_id);
create index if not exists sulfa_inst_app_idx on public.sulfa_installments(application_id, seq);
create index if not exists sulfa_wd_user_idx on public.sulfa_withdrawals(user_id, created_at desc);
create index if not exists sulfa_wd_status_idx on public.sulfa_withdrawals(status, created_at desc);
create index if not exists sulfa_notif_user_idx on public.sulfa_notifications(user_id, created_at desc);
create index if not exists sulfa_audit_created_idx on public.sulfa_audit_logs(created_at desc);

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. guards: integrity that holds even for the service role
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.sulfa__guard_rpc_only() returns trigger language plpgsql as $$
begin
  if not public.sulfa__in_rpc() then
    raise exception 'sulfa_direct_write_forbidden: % on % must go through a SULFA server function', tg_op, tg_table_name using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.sulfa__guard_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'sulfa_immutable: % on % is not allowed (use a traceable reversal)', tg_op, tg_table_name using errcode = '42501';
end $$;

-- every transaction must be balanced (sum of debits = sum of credits) at commit time
create or replace function public.sulfa__check_balanced() returns trigger language plpgsql as $$
declare d numeric; c numeric; tx uuid := coalesce(new.transaction_id, old.transaction_id);
begin
  select coalesce(sum(amount) filter (where side = 'DEBIT'), 0), coalesce(sum(amount) filter (where side = 'CREDIT'), 0)
    into d, c from public.sulfa_ledger_entries where transaction_id = tx;
  if d <> c then raise exception 'sulfa_unbalanced_transaction % (debit % / credit %)', tx, d, c using errcode = '23514'; end if;
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['sulfa_settings','sulfa_admins','sulfa_profiles','sulfa_applications','sulfa_application_events','sulfa_documents',
    'sulfa_accounts','sulfa_transactions','sulfa_ledger_entries','sulfa_installments','sulfa_repayments','sulfa_withdrawals',
    'sulfa_notifications','sulfa_email_log','sulfa_message_templates','sulfa_audit_logs','sulfa_payment_attempts'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_rpc_only', t);
    execute format('create trigger %I before insert or update or delete on public.%I for each row execute function public.sulfa__guard_rpc_only()', t || '_rpc_only', t);
  end loop;
end $$;
-- the first rows (settings, platform accounts) were inserted above before the guard existed; admins are bootstrapped with
-- the sulfa_bootstrap_admin() function below.

drop trigger if exists sulfa_ledger_immutable on public.sulfa_ledger_entries;
create trigger sulfa_ledger_immutable before update or delete on public.sulfa_ledger_entries for each row execute function public.sulfa__guard_immutable();
drop trigger if exists sulfa_events_immutable on public.sulfa_application_events;
create trigger sulfa_events_immutable before update or delete on public.sulfa_application_events for each row execute function public.sulfa__guard_immutable();
drop trigger if exists sulfa_audit_immutable on public.sulfa_audit_logs;
create trigger sulfa_audit_immutable before update or delete on public.sulfa_audit_logs for each row execute function public.sulfa__guard_immutable();
drop trigger if exists sulfa_repay_immutable on public.sulfa_repayments;
create trigger sulfa_repay_immutable before update or delete on public.sulfa_repayments for each row execute function public.sulfa__guard_immutable();

drop trigger if exists sulfa_ledger_balanced on public.sulfa_ledger_entries;
create constraint trigger sulfa_ledger_balanced after insert on public.sulfa_ledger_entries
  deferrable initially deferred for each row execute function public.sulfa__check_balanced();

-- a recorded transaction can only move RECORDED -> REVERSED (and only reversal links may be set); nothing else changes
create or replace function public.sulfa__guard_tx_update() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then raise exception 'sulfa_immutable: delete on sulfa_transactions' using errcode = '42501'; end if;
  if (new.amount, new.transaction_type, new.user_id, new.validated_by, new.validated_at, new.reference, new.idempotency_key, new.created_at)
     is distinct from (old.amount, old.transaction_type, old.user_id, old.validated_by, old.validated_at, old.reference, old.idempotency_key, old.created_at)
     or not (old.status = 'RECORDED' and new.status in ('RECORDED','REVERSED')) then
    raise exception 'sulfa_immutable: recorded transaction % cannot be modified', old.reference using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists sulfa_tx_guard on public.sulfa_transactions;
create trigger sulfa_tx_guard before update or delete on public.sulfa_transactions for each row execute function public.sulfa__guard_tx_update();

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. roles, audit, notifications, balances
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.sulfa_is_admin(roles text[] default array['SUPER_ADMIN','ADMIN','REVIEWER']) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.sulfa_admins a where a.user_id = (select auth.uid()) and a.active and a.role = any(roles))
$$;

create or replace function public.sulfa__require_admin(roles text[] default array['SUPER_ADMIN','ADMIN']) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid());
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if not public.sulfa_is_admin(roles) then raise exception 'sulfa_forbidden' using errcode = '42501'; end if;
  return u;
end $$;

create or replace function public.sulfa__audit(p_action text, p_entity text, p_entity_id text, p_reason text, p_meta jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid());
begin
  insert into public.sulfa_audit_logs (actor_id, actor_role, action, entity_type, entity_id, reason, metadata)
  values (u, case when public.sulfa_is_admin() then 'ADMIN' when u is null then 'SYSTEM' else 'CLIENT' end, p_action, p_entity, p_entity_id, nullif(btrim(p_reason), ''), coalesce(p_meta, '{}'::jsonb));
end $$;

-- notification + e-mail log line (no provider connected: the real state NO_PROVIDER is recorded, nothing pretends to be sent)
create or replace function public.sulfa__notify(p_user uuid, p_key text, p_params jsonb, p_entity text, p_entity_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare nid uuid; lang text; mail text; on_ boolean;
begin
  select notifications_enabled into on_ from public.sulfa_settings where id;
  insert into public.sulfa_notifications (user_id, template_key, params, entity_type, entity_id)
  values (p_user, p_key, coalesce(p_params, '{}'::jsonb), p_entity, p_entity_id) returning id into nid;
  select coalesce(p.preferred_language, 'ar'), coalesce(p.email, u.email) into lang, mail
    from auth.users u left join public.sulfa_profiles p on p.user_id = u.id where u.id = p_user;
  insert into public.sulfa_email_log (user_id, notification_id, template_key, language, to_email, status, dedupe_key)
  values (p_user, nid, p_key, coalesce(lang, 'ar'), mail, case when coalesce(on_, true) then 'NO_PROVIDER' else 'SKIPPED' end, 'notif:' || nid)
  on conflict (dedupe_key) do nothing;
  return nid;
end $$;

create or replace function public.sulfa__account_balance(p_account uuid) returns numeric
language sql stable security definer set search_path = '' as $$
  select coalesce(sum(case when e.side = a.normal_side then e.amount else -e.amount end), 0)::numeric(16,3)
  from public.sulfa_accounts a left join public.sulfa_ledger_entries e on e.account_id = a.id where a.id = p_account group by a.id
$$;

create or replace function public.sulfa__client_account(p_user uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare aid uuid;
begin
  select id into aid from public.sulfa_accounts where code = 'CLIENT:' || p_user;
  if aid is null then
    insert into public.sulfa_accounts (code, owner_user_id, account_type, normal_side, label)
    values ('CLIENT:' || p_user, p_user, 'CLIENT_WALLET', 'CREDIT', 'Solde client') returning id into aid;
  end if;
  return aid;
end $$;

create or replace function public.sulfa__acct(p_code text) returns uuid language sql stable security definer set search_path = '' as $$
  select id from public.sulfa_accounts where code = p_code
$$;

-- client funds reserved by withdrawals not yet paid / closed
create or replace function public.sulfa__reserved(p_user uuid) returns numeric language sql stable security definer set search_path = '' as $$
  select coalesce(sum(amount), 0)::numeric(16,3) from public.sulfa_withdrawals
  where user_id = p_user and status in ('RECEIVED','IN_VERIFICATION','PROCESSING','CONFIRMED')
$$;

-- creates a balanced transaction from a list of entries [{code, side, amount}]
create or replace function public.sulfa__post(p_type text, p_user uuid, p_amount numeric, p_source text, p_idem text, p_entries jsonb,
  p_internal_ref text default null, p_note text default null, p_application uuid default null, p_withdrawal uuid default null, p_reverses uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare txid uuid; e jsonb; admin uuid := (select auth.uid());
begin
  insert into public.sulfa_transactions (reference, transaction_type, user_id, application_id, withdrawal_id, amount, source, created_by,
    validated_by, validated_at, internal_reference, note, idempotency_key, reverses_tx_id)
  values (public.sulfa__ref('SLFTX'), p_type, p_user, p_application, p_withdrawal, p_amount, p_source, admin, admin, now(),
    p_internal_ref, p_note, p_idem, p_reverses)
  returning id into txid;
  for e in select * from jsonb_array_elements(p_entries) loop
    insert into public.sulfa_ledger_entries (transaction_id, account_id, side, amount)
    values (txid, coalesce((e->>'account_id')::uuid, public.sulfa__acct(e->>'code')), e->>'side', (e->>'amount')::numeric);
  end loop;
  return txid;
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. quote (single source of truth for fees / rate; the browser shows the same formula, the server decides)
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.sulfa_quote(p_amount numeric, p_term integer) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare s public.sulfa_settings; fee numeric; interest numeric; total numeric; monthly numeric;
begin
  select * into s from public.sulfa_settings where id;
  if p_amount is null or p_amount < s.min_amount or p_amount > s.max_amount then raise exception 'sulfa_amount_out_of_range' using errcode = '22023'; end if;
  if p_term is null or p_term < s.min_term or p_term > s.max_term then raise exception 'sulfa_term_out_of_range' using errcode = '22023'; end if;
  fee := round(s.fee_fixed + p_amount * s.fee_percent / 100, 3);
  interest := round(p_amount * s.monthly_rate_percent / 100 * p_term, 3);
  total := round(p_amount, 3) + fee + interest;
  monthly := round(total / p_term, 3);
  return jsonb_build_object('amount', round(p_amount, 3), 'term', p_term, 'fee', fee, 'fee_fixed', s.fee_fixed, 'fee_percent', s.fee_percent,
    'monthly_rate_percent', s.monthly_rate_percent, 'interest', interest, 'total', total, 'monthly', monthly,
    'last', total - monthly * (p_term - 1), 'currency', 'OMR');
end $$;

create or replace function public.sulfa_public_settings() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('min_amount', min_amount, 'max_amount', max_amount, 'min_term', min_term, 'max_term', max_term,
    'fee_fixed', fee_fixed, 'fee_percent', fee_percent, 'monthly_rate_percent', monthly_rate_percent, 'currency', currency,
    'default_language', default_language) from public.sulfa_settings where id
$$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 5. client functions
-- ---------------------------------------------------------------------------------------------------------------------
-- creates the SULFA profile from the sign-up metadata on first sign-in (no trigger on auth.users: existing ones untouched)
create or replace function public.sulfa_ensure_profile() returns public.sulfa_profiles
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); m jsonb; p public.sulfa_profiles; em text;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  select * into p from public.sulfa_profiles where user_id = u;
  if found then return p; end if;
  perform public.sulfa__enter();
  select coalesce(raw_user_meta_data, '{}'::jsonb), email into m, em from auth.users where id = u;
  insert into public.sulfa_profiles (user_id, first_name, last_name, nationality, gender, date_of_birth, email, phone, preferred_language, terms_accepted_at)
  values (u, left(coalesce(m->>'first_name', ''), 60), left(coalesce(m->>'last_name', ''), 60), upper(left(coalesce(m->>'nationality', 'OM'), 2)),
    nullif(m->>'gender', ''), nullif(m->>'date_of_birth', '')::date, em, left(coalesce(m->>'phone', ''), 20),
    case when m->>'language' in ('ar','fr','en') then m->>'language' else 'ar' end,
    case when (m->>'terms_accepted') = 'true' then now() end)
  returning * into p;
  perform public.sulfa__client_account(u);
  perform public.sulfa__notify(u, 'WELCOME', jsonb_build_object('first_name', p.first_name), 'profile', null);
  perform public.sulfa__audit('PROFILE_CREATED', 'profile', u::text, null, '{}'::jsonb);
  return p;
end $$;

create or replace function public.sulfa_update_my_profile(p_first text, p_last text, p_phone text, p_language text) returns public.sulfa_profiles
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); p public.sulfa_profiles;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if btrim(coalesce(p_first, '')) = '' or btrim(coalesce(p_last, '')) = '' then raise exception 'sulfa_missing_name' using errcode = '22023'; end if;
  if p_phone is not null and p_phone !~ '^\+[0-9]{8,15}$' then raise exception 'sulfa_invalid_phone' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  update public.sulfa_profiles set first_name = left(btrim(p_first), 60), last_name = left(btrim(p_last), 60),
    phone = coalesce(p_phone, phone), preferred_language = case when p_language in ('ar','fr','en') then p_language else preferred_language end,
    updated_at = now() where user_id = u returning * into p;
  if not found then raise exception 'sulfa_no_profile' using errcode = 'P0002'; end if;
  perform public.sulfa__notify(u, 'ACCOUNT_UPDATED', '{}'::jsonb, 'profile', null);
  return p;
end $$;

-- recomputes the identity status from the documents (only an administrator's VERIFIED decisions make an identity verified)
create or replace function public.sulfa__refresh_identity(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare st text; f text; b text;
begin
  select status into f from public.sulfa_documents where user_id = p_user and document_type = 'id_front' and status <> 'REPLACED' order by created_at desc limit 1;
  select status into b from public.sulfa_documents where user_id = p_user and document_type = 'id_back' and status <> 'REPLACED' order by created_at desc limit 1;
  st := case
    when f is null and b is null then 'NOT_SUBMITTED'
    when f = 'VERIFIED' and b = 'VERIFIED' then 'VERIFIED'
    when 'REJECTED' in (f, b) then 'REJECTED'
    when 'REUPLOAD_REQUIRED' in (f, b) then 'REUPLOAD_REQUIRED'
    when 'IN_REVIEW' in (f, b) then 'IN_REVIEW'
    else 'PENDING' end;
  update public.sulfa_profiles set identity_status = st, updated_at = now() where user_id = p_user;
  return st;
end $$;

-- the file is uploaded by the client to sulfa-identity/<uid>/... (storage policy), then registered here
create or replace function public.sulfa_register_document(p_type text, p_path text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); did uuid;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if p_type not in ('id_front','id_back','address_proof','other') then raise exception 'sulfa_invalid_document_type' using errcode = '22023'; end if;
  if p_path is null or split_part(p_path, '/', 1) <> u::text or p_path like '%..%' then raise exception 'sulfa_invalid_path' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  perform public.sulfa_ensure_profile();
  update public.sulfa_documents set status = 'REPLACED' where user_id = u and document_type = p_type and status in ('PENDING','REJECTED','REUPLOAD_REQUIRED');
  insert into public.sulfa_documents (user_id, document_type, storage_path) values (u, p_type, p_path) returning id into did;
  perform public.sulfa__refresh_identity(u);
  perform public.sulfa__notify(u, 'DOCUMENT_RECEIVED', jsonb_build_object('document_type', p_type), 'document', did);
  perform public.sulfa__audit('DOCUMENT_SUBMITTED', 'document', did::text, null, jsonb_build_object('type', p_type));
  return did;
end $$;

create or replace function public.sulfa__app_event(p_app uuid, p_from text, p_to text, p_role text, p_reason text) returns void
language sql security definer set search_path = '' as $$
  insert into public.sulfa_application_events (application_id, from_status, to_status, actor_id, actor_role, reason)
  values (p_app, p_from, p_to, (select auth.uid()), p_role, nullif(btrim(p_reason), ''))
$$;

create or replace function public.sulfa_submit_application(p_amount numeric, p_term integer, p_accept_terms boolean, p_idempotency_key text)
returns public.sulfa_applications language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); a public.sulfa_applications; q jsonb; open_n integer; s public.sulfa_settings; prof public.sulfa_profiles;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
  select * into a from public.sulfa_applications where user_id = u and idempotency_key = p_idempotency_key;
  if found then return a; end if;                                         -- same request sent twice: same application, nothing new
  if coalesce(p_accept_terms, false) is not true then raise exception 'sulfa_terms_not_accepted' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  prof := public.sulfa_ensure_profile();
  if prof.account_status <> 'ACTIVE' then raise exception 'sulfa_account_not_active' using errcode = '42501'; end if;
  select * into s from public.sulfa_settings where id;
  select count(*) into open_n from public.sulfa_applications where user_id = u
    and status in ('SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED','APPROVED','DISBURSEMENT_PENDING');
  if open_n >= s.max_open_applications then raise exception 'sulfa_open_application_exists' using errcode = '23505'; end if;
  q := public.sulfa_quote(p_amount, p_term);
  insert into public.sulfa_applications (reference, user_id, requested_amount, requested_term, quote, status, terms_accepted_at, idempotency_key)
  values (public.sulfa__ref('SLF'), u, round(p_amount, 3), p_term, q, 'SUBMITTED', now(), p_idempotency_key) returning * into a;
  update public.sulfa_profiles set terms_accepted_at = coalesce(terms_accepted_at, now()) where user_id = u;
  perform public.sulfa__app_event(a.id, null, 'SUBMITTED', 'CLIENT', null);
  perform public.sulfa__notify(u, 'APPLICATION_SUBMITTED', jsonb_build_object('reference', a.reference, 'amount', a.requested_amount, 'term', a.requested_term, 'currency', 'OMR'), 'application', a.id);
  perform public.sulfa__audit('APPLICATION_SUBMITTED', 'application', a.id::text, null, jsonb_build_object('reference', a.reference, 'amount', a.requested_amount));
  return a;
end $$;

create or replace function public.sulfa_cancel_application(p_id uuid) returns public.sulfa_applications
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); a public.sulfa_applications;
begin
  select * into a from public.sulfa_applications where id = p_id and user_id = u for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  if a.status not in ('DRAFT','SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED') then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  perform public.sulfa__app_event(a.id, a.status, 'CANCELLED', 'CLIENT', null);
  update public.sulfa_applications set status = 'CANCELLED', updated_at = now() where id = p_id returning * into a;
  perform public.sulfa__audit('APPLICATION_CANCELLED', 'application', a.id::text, null, '{}'::jsonb);
  return a;
end $$;

create or replace function public.sulfa_request_withdrawal(p_amount numeric, p_bank text, p_holder text, p_account text, p_idempotency_key text)
returns public.sulfa_withdrawals language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); w public.sulfa_withdrawals; bal numeric; avail numeric;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
  select * into w from public.sulfa_withdrawals where user_id = u and idempotency_key = p_idempotency_key;
  if found then return w; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 3) <> p_amount then raise exception 'sulfa_invalid_amount' using errcode = '22023'; end if;
  if btrim(coalesce(p_bank, '')) = '' or btrim(coalesce(p_holder, '')) = '' or btrim(coalesce(p_account, '')) = '' then raise exception 'sulfa_missing_field' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  perform pg_advisory_xact_lock(hashtext('sulfa_wallet:' || u));            -- one balance check at a time per client
  bal := public.sulfa__account_balance(public.sulfa__client_account(u));
  avail := bal - public.sulfa__reserved(u);
  if p_amount > avail then raise exception 'sulfa_insufficient_funds' using errcode = '22023'; end if;
  insert into public.sulfa_withdrawals (reference, user_id, amount, bank_name, account_holder, bank_account, idempotency_key)
  values (public.sulfa__ref('SLFWD'), u, p_amount, left(btrim(p_bank), 80), left(btrim(p_holder), 80), left(btrim(p_account), 40), p_idempotency_key) returning * into w;
  perform public.sulfa__notify(u, 'WITHDRAWAL_REQUESTED', jsonb_build_object('reference', w.reference, 'amount', w.amount, 'currency', 'OMR'), 'withdrawal', w.id);
  perform public.sulfa__audit('WITHDRAWAL_REQUESTED', 'withdrawal', w.id::text, null, jsonb_build_object('amount', w.amount));
  return w;
end $$;

create or replace function public.sulfa_cancel_withdrawal(p_id uuid) returns public.sulfa_withdrawals
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); w public.sulfa_withdrawals;
begin
  select * into w from public.sulfa_withdrawals where id = p_id and user_id = u for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  if w.status not in ('RECEIVED','IN_VERIFICATION') then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  update public.sulfa_withdrawals set status = 'CANCELLED', updated_at = now() where id = p_id returning * into w;
  perform public.sulfa__audit('WITHDRAWAL_CANCELLED', 'withdrawal', w.id::text, null, '{}'::jsonb);
  return w;
end $$;

create or replace function public.sulfa_mark_notifications_read(p_ids uuid[] default null) returns integer
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); n integer;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  perform public.sulfa__enter();
  update public.sulfa_notifications set read_at = now() where user_id = u and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.sulfa_my_summary() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); bal numeric; res numeric; nxt record;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  bal := coalesce(public.sulfa__account_balance((select id from public.sulfa_accounts where code = 'CLIENT:' || u)), 0);
  res := public.sulfa__reserved(u);
  select i.due_date, i.amount_due - i.amount_paid as amount, a.reference into nxt from public.sulfa_installments i join public.sulfa_applications a on a.id = i.application_id
    where i.user_id = u and i.status <> 'PAID' order by i.due_date, i.seq limit 1;
  return jsonb_build_object(
    'balance', bal, 'reserved', res, 'available', bal - res, 'currency', 'OMR',
    'open_applications', (select count(*) from public.sulfa_applications where user_id = u and status in ('SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED','APPROVED','DISBURSEMENT_PENDING')),
    'approved_total', (select coalesce(sum(approved_amount), 0) from public.sulfa_applications where user_id = u and status in ('APPROVED','DISBURSEMENT_PENDING','DISBURSED','COMPLETED')),
    'outstanding', (select coalesce(sum(amount_due - amount_paid), 0) from public.sulfa_installments where user_id = u and status <> 'PAID'),
    'repaid_total', (select coalesce(sum(amount), 0) from public.sulfa_repayments where user_id = u),
    'next_due', case when nxt is null then null else jsonb_build_object('date', nxt.due_date, 'amount', nxt.amount, 'reference', nxt.reference) end,
    'unread', (select count(*) from public.sulfa_notifications where user_id = u and read_at is null));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 6. administrator functions — every decision: role check + atomic change + event + notification + audit
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.sulfa_admin_review_document(p_id uuid, p_decision text, p_reason text) returns public.sulfa_documents
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN','ADMIN','REVIEWER']); d public.sulfa_documents; st text;
begin
  if p_decision not in ('IN_REVIEW','VERIFIED','REJECTED','REUPLOAD_REQUIRED') then raise exception 'sulfa_invalid_decision' using errcode = '22023'; end if;
  if p_decision in ('REJECTED','REUPLOAD_REQUIRED') and btrim(coalesce(p_reason, '')) = '' then raise exception 'sulfa_reason_required' using errcode = '22023'; end if;
  select * into d from public.sulfa_documents where id = p_id for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  if d.status in ('REPLACED','VERIFIED','REJECTED') then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  update public.sulfa_documents set status = p_decision, review_reason = nullif(btrim(p_reason), ''), reviewed_by = admin, reviewed_at = now() where id = p_id returning * into d;
  st := public.sulfa__refresh_identity(d.user_id);
  if p_decision <> 'IN_REVIEW' then
    perform public.sulfa__notify(d.user_id, 'DOCUMENT_' || p_decision, jsonb_build_object('document_type', d.document_type, 'reason', d.review_reason, 'identity_status', st), 'document', d.id);
  end if;
  perform public.sulfa__audit('DOCUMENT_' || p_decision, 'document', d.id::text, p_reason, jsonb_build_object('user_id', d.user_id, 'identity_status', st));
  return d;
end $$;

-- p_action: IN_REVIEW | REQUEST_DOCUMENTS | APPROVE | REJECT
create or replace function public.sulfa_admin_decide_application(p_id uuid, p_action text, p_reason text, p_amount numeric default null, p_term integer default null)
returns public.sulfa_applications language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); a public.sulfa_applications; nxt text; q jsonb; prev text;
begin
  select * into a from public.sulfa_applications where id = p_id for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  prev := a.status;
  nxt := case p_action when 'IN_REVIEW' then 'IN_REVIEW' when 'REQUEST_DOCUMENTS' then 'DOCUMENTS_REQUIRED' when 'APPROVE' then 'APPROVED' when 'REJECT' then 'REJECTED' end;
  if nxt is null then raise exception 'sulfa_invalid_decision' using errcode = '22023'; end if;
  if not (prev in ('SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED') and (nxt <> prev)) then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  if nxt in ('REJECTED','DOCUMENTS_REQUIRED') and btrim(coalesce(p_reason, '')) = '' then raise exception 'sulfa_reason_required' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  if nxt = 'APPROVED' then
    if (select identity_status from public.sulfa_profiles where user_id = a.user_id) <> 'VERIFIED' then raise exception 'sulfa_identity_not_verified' using errcode = '22023'; end if;
    q := public.sulfa_quote(coalesce(p_amount, a.requested_amount), coalesce(p_term, a.requested_term));
    update public.sulfa_applications set status = 'APPROVED', approved_amount = (q->>'amount')::numeric, approved_term = (q->>'term')::int,
      approved_quote = q, decision_reason = nullif(btrim(p_reason), ''), decided_by = admin, decided_at = now(), updated_at = now()
      where id = p_id returning * into a;
  else
    update public.sulfa_applications set status = nxt, decision_reason = nullif(btrim(p_reason), ''),
      decided_by = case when nxt in ('REJECTED') then admin else decided_by end, decided_at = case when nxt in ('REJECTED') then now() else decided_at end,
      updated_at = now() where id = p_id returning * into a;
  end if;
  perform public.sulfa__app_event(a.id, prev, nxt, 'ADMIN', p_reason);
  perform public.sulfa__notify(a.user_id, 'APPLICATION_' || nxt, jsonb_build_object('reference', a.reference, 'amount', coalesce(a.approved_amount, a.requested_amount),
    'term', coalesce(a.approved_term, a.requested_term), 'reason', a.decision_reason, 'currency', 'OMR', 'monthly', a.approved_quote->'monthly'), 'application', a.id);
  perform public.sulfa__audit('APPLICATION_' || nxt, 'application', a.id::text, p_reason,
    jsonb_build_object('reference', a.reference, 'from', prev, 'approved_amount', a.approved_amount, 'approved_term', a.approved_term));
  return a;
end $$;

-- APPROVED -> DISBURSEMENT_PENDING (preparation) and DISBURSEMENT_PENDING -> DISBURSED (confirmation with internal reference).
-- The confirmation posts the ledger: receivable (total to repay) against the client's balance (principal) and fee income.
create or replace function public.sulfa_admin_disbursement(p_id uuid, p_action text, p_internal_ref text, p_idempotency_key text)
returns public.sulfa_applications language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); a public.sulfa_applications; txid uuid; q jsonb; i integer; total numeric; monthly numeric; client_acct uuid; prev text;
begin
  select * into a from public.sulfa_applications where id = p_id for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  prev := a.status;
  perform public.sulfa__enter();
  if p_action = 'PREPARE' then
    if a.status <> 'APPROVED' then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
    update public.sulfa_applications set status = 'DISBURSEMENT_PENDING', updated_at = now() where id = p_id returning * into a;
    perform public.sulfa__app_event(a.id, prev, a.status, 'ADMIN', null);
    perform public.sulfa__notify(a.user_id, 'DISBURSEMENT_PREPARING', jsonb_build_object('reference', a.reference, 'amount', a.approved_amount, 'currency', 'OMR'), 'application', a.id);
    perform public.sulfa__audit('DISBURSEMENT_PREPARED', 'application', a.id::text, null, jsonb_build_object('reference', a.reference));
    return a;
  elsif p_action = 'CONFIRM' then
    if a.status = 'DISBURSED' and exists (select 1 from public.sulfa_transactions where idempotency_key = 'disb:' || coalesce(p_idempotency_key, '')) then return a; end if;
    if a.status <> 'DISBURSEMENT_PENDING' then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
    if btrim(coalesce(p_internal_ref, '')) = '' then raise exception 'sulfa_internal_reference_required' using errcode = '22023'; end if;
    if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
    q := a.approved_quote; total := (q->>'total')::numeric; monthly := (q->>'monthly')::numeric;
    client_acct := public.sulfa__client_account(a.user_id);
    -- a credit to a client must be backed by funds really recorded: cash held minus what is already owed to clients
    if public.sulfa__account_balance(public.sulfa__acct('PLATFORM_CASH'))
       - (select coalesce(sum(public.sulfa__account_balance(id)), 0) from public.sulfa_accounts where account_type = 'CLIENT_WALLET') < a.approved_amount then
      raise exception 'sulfa_platform_funds_insufficient' using errcode = '22023';
    end if;
    txid := public.sulfa__post('DISBURSEMENT', a.user_id, a.approved_amount, 'ADMIN', 'disb:' || p_idempotency_key,
      jsonb_build_array(
        jsonb_build_object('code', 'LOANS_RECEIVABLE', 'side', 'DEBIT', 'amount', total),
        jsonb_build_object('account_id', client_acct, 'side', 'CREDIT', 'amount', a.approved_amount))
      || case when total > a.approved_amount then jsonb_build_array(jsonb_build_object('code', 'FEE_INCOME', 'side', 'CREDIT', 'amount', total - a.approved_amount)) else '[]'::jsonb end,
      p_internal_ref, 'Décaissement ' || a.reference, a.id);
    for i in 1..a.approved_term loop
      insert into public.sulfa_installments (application_id, user_id, seq, due_date, amount_due)
      values (a.id, a.user_id, i, (now() at time zone 'Asia/Muscat')::date + make_interval(months => i),
        case when i = a.approved_term then total - monthly * (a.approved_term - 1) else monthly end);
    end loop;
    update public.sulfa_applications set status = 'DISBURSED', disbursed_by = admin, disbursed_at = now(), disbursement_tx_id = txid, updated_at = now()
      where id = p_id returning * into a;
    perform public.sulfa__app_event(a.id, prev, 'DISBURSED', 'ADMIN', p_internal_ref);
    perform public.sulfa__notify(a.user_id, 'DISBURSEMENT_CONFIRMED', jsonb_build_object('reference', a.reference, 'tx_reference', (select reference from public.sulfa_transactions where id = txid),
      'amount', a.approved_amount, 'currency', 'OMR', 'first_due', (select min(due_date) from public.sulfa_installments where application_id = a.id)), 'application', a.id);
    perform public.sulfa__audit('DISBURSEMENT_CONFIRMED', 'application', a.id::text, null, jsonb_build_object('reference', a.reference, 'tx_id', txid, 'internal_reference', p_internal_ref, 'amount', a.approved_amount));
    return a;
  end if;
  raise exception 'sulfa_invalid_decision' using errcode = '22023';
end $$;

-- a repayment the administrator has really received (cash, bank transfer...), applied to the oldest installments first
create or replace function public.sulfa_admin_record_repayment(p_application uuid, p_amount numeric, p_internal_ref text, p_idempotency_key text)
returns public.sulfa_repayments language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); a public.sulfa_applications; r public.sulfa_repayments; txid uuid; left_ numeric; inst record; pay numeric; outstanding numeric;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
  select * into r from public.sulfa_repayments where idempotency_key = 'rep:' || p_idempotency_key;
  if found then return r; end if;                                         -- never recorded twice
  select * into a from public.sulfa_applications where id = p_application for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  if a.status <> 'DISBURSED' then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  if btrim(coalesce(p_internal_ref, '')) = '' then raise exception 'sulfa_internal_reference_required' using errcode = '22023'; end if;
  select coalesce(sum(amount_due - amount_paid), 0) into outstanding from public.sulfa_installments where application_id = a.id;
  if p_amount is null or p_amount <= 0 or round(p_amount, 3) <> p_amount then raise exception 'sulfa_invalid_amount' using errcode = '22023'; end if;
  if p_amount > outstanding then raise exception 'sulfa_overpayment' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  txid := public.sulfa__post('REPAYMENT', a.user_id, p_amount, 'ADMIN', 'rep:' || p_idempotency_key,
    jsonb_build_array(jsonb_build_object('code', 'PLATFORM_CASH', 'side', 'DEBIT', 'amount', p_amount),
                      jsonb_build_object('code', 'LOANS_RECEIVABLE', 'side', 'CREDIT', 'amount', p_amount)),
    p_internal_ref, 'Remboursement ' || a.reference, a.id);
  insert into public.sulfa_repayments (reference, application_id, user_id, amount, tx_id, internal_reference, recorded_by, idempotency_key)
  values ((select reference from public.sulfa_transactions where id = txid), a.id, a.user_id, p_amount, txid, p_internal_ref, admin, 'rep:' || p_idempotency_key) returning * into r;
  left_ := p_amount;
  for inst in select * from public.sulfa_installments where application_id = a.id and status <> 'PAID' order by seq for update loop
    exit when left_ <= 0;
    pay := least(left_, inst.amount_due - inst.amount_paid);
    update public.sulfa_installments set amount_paid = amount_paid + pay,
      status = case when amount_paid + pay >= amount_due then 'PAID' else 'PARTIAL' end,
      paid_at = case when amount_paid + pay >= amount_due then now() else paid_at end where id = inst.id;
    left_ := left_ - pay;
  end loop;
  if not exists (select 1 from public.sulfa_installments where application_id = a.id and status <> 'PAID') then
    update public.sulfa_applications set status = 'COMPLETED', updated_at = now() where id = a.id;
    perform public.sulfa__app_event(a.id, 'DISBURSED', 'COMPLETED', 'ADMIN', null);
  end if;
  perform public.sulfa__notify(a.user_id, 'REPAYMENT_RECEIVED', jsonb_build_object('reference', r.reference, 'application', a.reference, 'amount', p_amount, 'currency', 'OMR',
    'outstanding', outstanding - p_amount), 'repayment', r.id);
  perform public.sulfa__audit('REPAYMENT_RECORDED', 'repayment', r.id::text, null, jsonb_build_object('application', a.reference, 'amount', p_amount, 'internal_reference', p_internal_ref, 'tx_id', txid));
  return r;
end $$;

-- p_action: VERIFY | PROCESS | CONFIRM | PAY | REJECT | FAIL
create or replace function public.sulfa_admin_withdrawal_action(p_id uuid, p_action text, p_reason text, p_internal_ref text, p_idempotency_key text default null)
returns public.sulfa_withdrawals language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); w public.sulfa_withdrawals; nxt text; prev text; txid uuid; cash numeric; bal numeric;
begin
  select * into w from public.sulfa_withdrawals where id = p_id for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  prev := w.status;
  nxt := case p_action when 'VERIFY' then 'IN_VERIFICATION' when 'PROCESS' then 'PROCESSING' when 'CONFIRM' then 'CONFIRMED' when 'PAY' then 'PAID' when 'REJECT' then 'REJECTED' when 'FAIL' then 'FAILED' end;
  if nxt is null then raise exception 'sulfa_invalid_decision' using errcode = '22023'; end if;
  if not ((nxt = 'IN_VERIFICATION' and prev = 'RECEIVED')
       or (nxt = 'PROCESSING' and prev in ('RECEIVED','IN_VERIFICATION'))
       or (nxt = 'CONFIRMED' and prev in ('IN_VERIFICATION','PROCESSING'))
       or (nxt = 'PAID' and prev = 'CONFIRMED')
       or (nxt in ('REJECTED','FAILED') and prev in ('RECEIVED','IN_VERIFICATION','PROCESSING','CONFIRMED'))) then
    if nxt = 'PAID' and prev = 'PAID' then return w; end if;
    raise exception 'sulfa_invalid_transition' using errcode = '22023';
  end if;
  if nxt in ('REJECTED','FAILED') and btrim(coalesce(p_reason, '')) = '' then raise exception 'sulfa_reason_required' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  if nxt = 'PAID' then
    if btrim(coalesce(p_internal_ref, '')) = '' then raise exception 'sulfa_internal_reference_required' using errcode = '22023'; end if;
    perform pg_advisory_xact_lock(hashtext('sulfa_wallet:' || w.user_id));
    bal := public.sulfa__account_balance(public.sulfa__client_account(w.user_id));
    if w.amount > bal then raise exception 'sulfa_insufficient_funds' using errcode = '22023'; end if;
    cash := public.sulfa__account_balance(public.sulfa__acct('PLATFORM_CASH'));
    if w.amount > cash then raise exception 'sulfa_platform_funds_insufficient' using errcode = '22023'; end if;
    txid := public.sulfa__post('WITHDRAWAL', w.user_id, w.amount, 'ADMIN', 'wd:' || w.id,
      jsonb_build_array(jsonb_build_object('account_id', public.sulfa__client_account(w.user_id), 'side', 'DEBIT', 'amount', w.amount),
                        jsonb_build_object('code', 'PLATFORM_CASH', 'side', 'CREDIT', 'amount', w.amount)),
      p_internal_ref, 'Retrait ' || w.reference, null, w.id);
    update public.sulfa_withdrawals set status = 'PAID', paid_by = admin, paid_at = now(), internal_reference = p_internal_ref, tx_id = txid, updated_at = now()
      where id = p_id returning * into w;
  else
    update public.sulfa_withdrawals set status = nxt, decision_reason = coalesce(nullif(btrim(p_reason), ''), decision_reason),
      reviewed_by = admin, reviewed_at = now(), updated_at = now() where id = p_id returning * into w;
  end if;
  if nxt in ('CONFIRMED','PAID','REJECTED','FAILED') then
    perform public.sulfa__notify(w.user_id, 'WITHDRAWAL_' || nxt, jsonb_build_object('reference', w.reference, 'amount', w.amount, 'currency', 'OMR',
      'reason', w.decision_reason, 'tx_reference', (select reference from public.sulfa_transactions where id = w.tx_id)), 'withdrawal', w.id);
  end if;
  perform public.sulfa__audit('WITHDRAWAL_' || nxt, 'withdrawal', w.id::text, p_reason, jsonb_build_object('reference', w.reference, 'from', prev, 'amount', w.amount, 'internal_reference', p_internal_ref, 'tx_id', txid));
  return w;
end $$;

-- funds really received by the platform (capital contribution), recorded by an administrator with a reference
create or replace function public.sulfa_admin_record_capital(p_amount numeric, p_internal_ref text, p_note text, p_idempotency_key text) returns public.sulfa_transactions
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']); t public.sulfa_transactions; txid uuid;
begin
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
  select * into t from public.sulfa_transactions where idempotency_key = 'cap:' || p_idempotency_key;
  if found then return t; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 3) <> p_amount then raise exception 'sulfa_invalid_amount' using errcode = '22023'; end if;
  if btrim(coalesce(p_internal_ref, '')) = '' then raise exception 'sulfa_internal_reference_required' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  txid := public.sulfa__post('CAPITAL_DEPOSIT', null, p_amount, 'ADMIN', 'cap:' || p_idempotency_key,
    jsonb_build_array(jsonb_build_object('code', 'PLATFORM_CASH', 'side', 'DEBIT', 'amount', p_amount),
                      jsonb_build_object('code', 'EQUITY_CAPITAL', 'side', 'CREDIT', 'amount', p_amount)), p_internal_ref, p_note);
  select * into t from public.sulfa_transactions where id = txid;
  perform public.sulfa__audit('CAPITAL_RECORDED', 'transaction', txid::text, p_note, jsonb_build_object('amount', p_amount, 'internal_reference', p_internal_ref));
  return t;
end $$;

-- traceable correction: a new REVERSAL transaction mirrors the original entries; the original is marked REVERSED
create or replace function public.sulfa_admin_reverse_transaction(p_tx uuid, p_reason text, p_idempotency_key text) returns public.sulfa_transactions
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']); o public.sulfa_transactions; t public.sulfa_transactions; txid uuid; entries jsonb;
begin
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'sulfa_reason_required' using errcode = '22023'; end if;
  select * into t from public.sulfa_transactions where idempotency_key = 'rev:' || coalesce(p_idempotency_key, '');
  if found then return t; end if;
  select * into o from public.sulfa_transactions where id = p_tx for update;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  if o.status <> 'RECORDED' or o.transaction_type = 'REVERSAL' then raise exception 'sulfa_invalid_transition' using errcode = '22023'; end if;
  if o.transaction_type in ('DISBURSEMENT','REPAYMENT') then raise exception 'sulfa_reverse_not_supported_for_type' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  select jsonb_agg(jsonb_build_object('account_id', account_id, 'side', case side when 'DEBIT' then 'CREDIT' else 'DEBIT' end, 'amount', amount)) into entries
    from public.sulfa_ledger_entries where transaction_id = o.id;
  txid := public.sulfa__post('REVERSAL', o.user_id, o.amount, 'ADMIN', 'rev:' || p_idempotency_key, entries, null, p_reason, o.application_id, o.withdrawal_id, o.id);
  update public.sulfa_transactions set status = 'REVERSED', reversed_by_tx_id = txid, updated_at = now() where id = o.id;
  select * into t from public.sulfa_transactions where id = txid;
  perform public.sulfa__audit('TRANSACTION_REVERSED', 'transaction', o.id::text, p_reason, jsonb_build_object('reversal_tx', txid, 'original_reference', o.reference));
  return t;
end $$;

create or replace function public.sulfa_admin_update_settings(p jsonb) returns public.sulfa_settings
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']); s public.sulfa_settings; before jsonb;
begin
  select to_jsonb(x) into before from public.sulfa_settings x where id;
  perform public.sulfa__enter();
  update public.sulfa_settings set
    reference_capital = coalesce((p->>'reference_capital')::numeric, reference_capital),
    min_amount = coalesce((p->>'min_amount')::numeric, min_amount), max_amount = coalesce((p->>'max_amount')::numeric, max_amount),
    min_term = coalesce((p->>'min_term')::int, min_term), max_term = coalesce((p->>'max_term')::int, max_term),
    fee_fixed = coalesce((p->>'fee_fixed')::numeric, fee_fixed), fee_percent = coalesce((p->>'fee_percent')::numeric, fee_percent),
    monthly_rate_percent = coalesce((p->>'monthly_rate_percent')::numeric, monthly_rate_percent),
    default_language = coalesce(p->>'default_language', default_language),
    max_open_applications = coalesce((p->>'max_open_applications')::int, max_open_applications),
    notifications_enabled = coalesce((p->>'notifications_enabled')::boolean, notifications_enabled),
    updated_by = admin, updated_at = now() where id returning * into s;
  perform public.sulfa__audit('SETTINGS_UPDATED', 'settings', 'sulfa', null, jsonb_build_object('before', before, 'after', to_jsonb(s)));
  return s;
end $$;

create or replace function public.sulfa_admin_set_account_status(p_user uuid, p_status text, p_reason text) returns public.sulfa_profiles
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); p public.sulfa_profiles;
begin
  if p_status not in ('ACTIVE','SUSPENDED','CLOSED') then raise exception 'sulfa_invalid_decision' using errcode = '22023'; end if;
  if btrim(coalesce(p_reason, '')) = '' then raise exception 'sulfa_reason_required' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  update public.sulfa_profiles set account_status = p_status, updated_at = now() where user_id = p_user returning * into p;
  if not found then raise exception 'sulfa_not_found' using errcode = 'P0002'; end if;
  perform public.sulfa__notify(p_user, 'ACCOUNT_STATUS_' || p_status, jsonb_build_object('reason', p_reason), 'profile', null);
  perform public.sulfa__audit('ACCOUNT_' || p_status, 'profile', p_user::text, p_reason, '{}'::jsonb);
  return p;
end $$;

create or replace function public.sulfa_admin_upsert_template(p_key text, p_language text, p_subject text, p_body text) returns void
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']);
begin
  perform public.sulfa__enter();
  insert into public.sulfa_message_templates (key, language, subject, body, updated_by) values (p_key, p_language, p_subject, p_body, admin)
  on conflict (key, language) do update set subject = excluded.subject, body = excluded.body, updated_by = admin, updated_at = now();
  perform public.sulfa__audit('TEMPLATE_UPDATED', 'template', p_key || ':' || p_language, null, '{}'::jsonb);
end $$;

-- « échéance à venir » : sent when an administrator runs it (no scheduler connected); once per installment and due date
create or replace function public.sulfa_admin_send_due_reminders(p_days integer default 3) returns integer
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(); i record; n integer := 0;
begin
  perform public.sulfa__enter();
  for i in select x.*, a.reference from public.sulfa_installments x join public.sulfa_applications a on a.id = x.application_id
           where x.status <> 'PAID' and x.due_date <= (now() at time zone 'Asia/Muscat')::date + p_days
             and not exists (select 1 from public.sulfa_notifications nn where nn.entity_id = x.id and nn.template_key = 'INSTALLMENT_DUE') loop
    perform public.sulfa__notify(i.user_id, 'INSTALLMENT_DUE', jsonb_build_object('reference', i.reference, 'seq', i.seq, 'date', i.due_date,
      'amount', i.amount_due - i.amount_paid, 'currency', 'OMR'), 'installment', i.id);
    n := n + 1;
  end loop;
  perform public.sulfa__audit('DUE_REMINDERS_SENT', 'installment', null, null, jsonb_build_object('count', n, 'days', p_days));
  return n;
end $$;

create or replace function public.sulfa_admin_overview() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN','ADMIN','REVIEWER']); s public.sulfa_settings;
begin
  select * into s from public.sulfa_settings where id;
  return jsonb_build_object(
    'reference_capital', s.reference_capital, 'currency', s.currency,
    'cash_available', public.sulfa__account_balance(public.sulfa__acct('PLATFORM_CASH')),
    'capital_recorded', public.sulfa__account_balance(public.sulfa__acct('EQUITY_CAPITAL')),
    'receivables', public.sulfa__account_balance(public.sulfa__acct('LOANS_RECEIVABLE')),
    'fee_income', public.sulfa__account_balance(public.sulfa__acct('FEE_INCOME')),
    'client_balances', (select coalesce(sum(public.sulfa__account_balance(id)), 0) from public.sulfa_accounts where account_type = 'CLIENT_WALLET'),
    'reserved', (select coalesce(sum(amount), 0) from public.sulfa_withdrawals where status in ('RECEIVED','IN_VERIFICATION','PROCESSING','CONFIRMED')),
    'clients', (select count(*) from public.sulfa_profiles),
    'applications', (select coalesce(jsonb_object_agg(status, n), '{}'::jsonb) from (select status, count(*) n from public.sulfa_applications group by status) x),
    'approved_amount', (select coalesce(sum(approved_amount), 0) from public.sulfa_applications where status in ('APPROVED','DISBURSEMENT_PENDING','DISBURSED','COMPLETED')),
    'disbursed_amount', (select coalesce(sum(amount), 0) from public.sulfa_transactions where transaction_type = 'DISBURSEMENT' and status = 'RECORDED'),
    'repaid_amount', (select coalesce(sum(amount), 0) from public.sulfa_repayments),
    'pending_requested', (select coalesce(sum(requested_amount), 0) from public.sulfa_applications where status in ('SUBMITTED','IN_REVIEW','DOCUMENTS_REQUIRED')),
    'withdrawn_amount', (select coalesce(sum(amount), 0) from public.sulfa_withdrawals where status = 'PAID'),
    'withdrawals_open', (select count(*) from public.sulfa_withdrawals where status in ('RECEIVED','IN_VERIFICATION','PROCESSING','CONFIRMED')),
    'documents_pending', (select count(*) from public.sulfa_documents where status in ('PENDING','IN_REVIEW')),
    'operators_enabled', (select count(*) from public.sulfa_operators where enabled));
end $$;

create or replace function public.sulfa_admin_account_balances() returns table (code text, account_type text, owner_user_id uuid, balance numeric)
language plpgsql security definer set search_path = '' as $$
begin
  perform public.sulfa__require_admin(array['SUPER_ADMIN','ADMIN','REVIEWER']);
  return query select a.code, a.account_type, a.owner_user_id, public.sulfa__account_balance(a.id) from public.sulfa_accounts a order by a.account_type, a.code;
end $$;

-- first administrator: run ONCE from the SQL editor (service role), never from the browser
create or replace function public.sulfa_bootstrap_admin(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is not null then raise exception 'sulfa_bootstrap_from_sql_editor_only' using errcode = '42501'; end if;
  perform public.sulfa__enter();
  insert into public.sulfa_admins (user_id, email, role, active)
  select id, email, 'SUPER_ADMIN', true from auth.users where lower(email) = lower(p_email)
  on conflict (user_id) do update set role = 'SUPER_ADMIN', active = true;
  if not found then raise exception 'sulfa_user_not_found: create the account in Supabase Auth first' using errcode = 'P0002'; end if;
  perform public.sulfa__audit('ADMIN_BOOTSTRAPPED', 'admin', lower(p_email), null, '{}'::jsonb);
end $$;

create or replace function public.sulfa_admin_set_admin(p_user uuid, p_role text, p_active boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']);
begin
  if p_user = admin and coalesce(p_active, true) is false then raise exception 'sulfa_cannot_disable_self' using errcode = '22023'; end if;
  if p_role not in ('SUPER_ADMIN','ADMIN','REVIEWER') then raise exception 'sulfa_invalid_decision' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  insert into public.sulfa_admins (user_id, email, role, active) select id, email, p_role, coalesce(p_active, true) from auth.users where id = p_user
  on conflict (user_id) do update set role = p_role, active = coalesce(p_active, true);
  perform public.sulfa__audit('ADMIN_SET', 'admin', p_user::text, null, jsonb_build_object('role', p_role, 'active', p_active));
end $$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 7. row level security: read own rows (or all rows for an active administrator); NO direct write policy at all
-- ---------------------------------------------------------------------------------------------------------------------
do $$ declare t text; begin
  foreach t in array array['sulfa_settings','sulfa_admins','sulfa_profiles','sulfa_applications','sulfa_application_events','sulfa_documents',
    'sulfa_accounts','sulfa_transactions','sulfa_ledger_entries','sulfa_installments','sulfa_repayments','sulfa_withdrawals',
    'sulfa_notifications','sulfa_email_log','sulfa_message_templates','sulfa_audit_logs','sulfa_operators','sulfa_payment_attempts'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'sulfa\_%' loop
    execute format('drop policy if exists %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

create policy sulfa_settings_read on public.sulfa_settings for select to authenticated using (true);
create policy sulfa_admins_read on public.sulfa_admins for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_profiles_read on public.sulfa_profiles for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_apps_read on public.sulfa_applications for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_events_read on public.sulfa_application_events for select to authenticated
  using (public.sulfa_is_admin() or exists (select 1 from public.sulfa_applications a where a.id = application_id and a.user_id = (select auth.uid())));
create policy sulfa_docs_read on public.sulfa_documents for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_accounts_read on public.sulfa_accounts for select to authenticated using (owner_user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_tx_read on public.sulfa_transactions for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_ledger_read on public.sulfa_ledger_entries for select to authenticated using (public.sulfa_is_admin());
create policy sulfa_inst_read on public.sulfa_installments for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_repay_read on public.sulfa_repayments for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_wd_read on public.sulfa_withdrawals for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_notif_read on public.sulfa_notifications for select to authenticated using (user_id = (select auth.uid()) or public.sulfa_is_admin());
create policy sulfa_email_read on public.sulfa_email_log for select to authenticated using (public.sulfa_is_admin());
create policy sulfa_tpl_read on public.sulfa_message_templates for select to authenticated using (public.sulfa_is_admin());
create policy sulfa_audit_read on public.sulfa_audit_logs for select to authenticated using (public.sulfa_is_admin());
create policy sulfa_ops_read on public.sulfa_operators for select to authenticated using (public.sulfa_is_admin());
create policy sulfa_attempts_read on public.sulfa_payment_attempts for select to authenticated using (public.sulfa_is_admin());

-- functions: nothing for anonymous visitors except the public quote and public settings
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname like 'sulfa%' loop
    execute format('revoke all on function %s from public, anon, authenticated', f.sig);
    if f.proname not like 'sulfa\_\_%' and f.proname <> 'sulfa_bootstrap_admin' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.sulfa_quote(numeric, integer) to anon;
grant execute on function public.sulfa_public_settings() to anon;
grant execute on function public.sulfa_is_admin(text[]) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------------
-- 8. private documents bucket (existing buckets and objects untouched)
-- ---------------------------------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sulfa-identity', 'sulfa-identity', false, 8388608, array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 8388608, allowed_mime_types = array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists sulfa_identity_upload_own_folder on storage.objects;
drop policy if exists sulfa_identity_read_own_or_admin on storage.objects;
create policy sulfa_identity_upload_own_folder on storage.objects for insert to authenticated
  with check (bucket_id = 'sulfa-identity' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy sulfa_identity_read_own_or_admin on storage.objects for select to authenticated
  using (bucket_id = 'sulfa-identity' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.sulfa_is_admin()));

select set_config('sulfa.rpc', '', false);

-- No funds are created here. PLATFORM_CASH starts at 0,000 OMR until an administrator records funds really received
-- (sulfa_admin_record_capital). The 1 000 000,000 OMR reference capital is configuration only.
