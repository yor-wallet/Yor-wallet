-- SULFA additive migration for the existing Supabase project.
-- This script creates new sulfa_* objects only. It does NOT rename, truncate,
-- delete, or alter the existing Friendly Pay tables or records.
-- Run in Supabase SQL Editor after making a database backup.

create extension if not exists pgcrypto;

create table if not exists public.sulfa_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  nationality text not null default 'OM',
  gender text,
  date_of_birth date,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sulfa_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'ADMIN' check (role in ('ADMIN','SUPER_ADMIN','REVIEWER')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  reference text not null unique,
  requested_amount numeric(14,3) not null check (requested_amount between 500 and 10000),
  approved_amount numeric(14,3),
  currency text not null default 'OMR' check (currency = 'OMR'),
  requested_term_months integer not null check (requested_term_months between 3 and 9),
  bank_name text,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','PENDING_REVIEW','IDENTITY_REVIEW','DOCUMENTS_REQUIRED','IDENTITY_VERIFIED','PENDING_ADMIN_DECISION','APPROVED','REJECTED','CREDIT_PENDING','CREDITED','COMPLETED','CANCELLED')),
  decision_message text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (approved_amount is null or approved_amount between 500 and 10000)
);

create table if not exists public.sulfa_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  document_type text not null check (document_type in ('id_front','id_back','address_proof','other')),
  storage_path text not null,
  verification_status text not null default 'PENDING' check (verification_status in ('PENDING','VERIFIED','REUPLOAD_REQUIRED','REJECTED')),
  review_message text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete restrict,
  account_type text not null check (account_type in ('PLATFORM','CLIENT')),
  currency text not null default 'OMR' check (currency = 'OMR'),
  label text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_reference text not null unique default ('SLFTX-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12))),
  transaction_type text not null check (transaction_type in ('DEPOSIT','FINANCING_CREDIT','WITHDRAWAL','REPAYMENT','FEE','ADJUSTMENT')),
  user_id uuid references auth.users(id) on delete restrict,
  amount numeric(14,3) not null check (amount > 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  status text not null default 'PENDING' check (status in ('PENDING','INTERNAL_RECORDED','PROCESSING','CONFIRMED','REJECTED','FAILED')),
  external_reference text,
  created_by uuid references auth.users(id),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.sulfa_transactions(id) on delete restrict,
  account_id uuid not null references public.sulfa_accounts(id) on delete restrict,
  entry_side text not null check (entry_side in ('DEBIT','CREDIT')),
  amount numeric(14,3) not null check (amount > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_withdrawals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(14,3) not null check (amount > 0),
  currency text not null default 'OMR' check (currency = 'OMR'),
  bank_name text not null,
  account_holder text not null,
  bank_account_last4 text,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED','PENDING_ADMIN','APPROVED','PROCESSING','PAID','REJECTED','FAILED')),
  external_reference text,
  decision_message text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sulfa_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  message text not null,
  notification_type text not null default 'GENERAL',
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sulfa_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sulfa_apps_user_created_idx on public.sulfa_applications(user_id, created_at desc);
create index if not exists sulfa_apps_status_created_idx on public.sulfa_applications(status, created_at desc);
create index if not exists sulfa_docs_user_created_idx on public.sulfa_documents(user_id, created_at desc);
create index if not exists sulfa_tx_user_created_idx on public.sulfa_transactions(user_id, created_at desc);
create index if not exists sulfa_withdrawals_user_created_idx on public.sulfa_withdrawals(user_id, created_at desc);
create index if not exists sulfa_notifications_user_created_idx on public.sulfa_notifications(user_id, created_at desc);

alter table public.sulfa_profiles enable row level security;
alter table public.sulfa_admins enable row level security;
alter table public.sulfa_applications enable row level security;
alter table public.sulfa_documents enable row level security;
alter table public.sulfa_accounts enable row level security;
alter table public.sulfa_transactions enable row level security;
alter table public.sulfa_ledger_entries enable row level security;
alter table public.sulfa_withdrawals enable row level security;
alter table public.sulfa_notifications enable row level security;
alter table public.sulfa_audit_logs enable row level security;

-- Remove only policies belonging to this migration, making re-runs predictable.
do $$ declare p record; begin
  for p in select schemaname, tablename, policyname from pg_policies where schemaname='public' and tablename like 'sulfa_%' loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

create policy sulfa_profiles_read_own_or_admin on public.sulfa_profiles for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_profiles_insert_own on public.sulfa_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy sulfa_profiles_update_own on public.sulfa_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy sulfa_admins_read_self on public.sulfa_admins for select to authenticated
using (user_id = (select auth.uid()));

create policy sulfa_apps_read_own_or_admin on public.sulfa_applications for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_apps_insert_own_pending on public.sulfa_applications for insert to authenticated
with check (user_id = (select auth.uid()) and status='SUBMITTED' and approved_amount is null and reviewed_by is null and reviewed_at is null);
create policy sulfa_apps_admin_update on public.sulfa_applications for update to authenticated
using (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true))
with check (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));

create policy sulfa_docs_read_own_or_admin on public.sulfa_documents for select to authenticated
using (user_id = (select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_docs_insert_own_pending on public.sulfa_documents for insert to authenticated
with check (user_id=(select auth.uid()) and verification_status='PENDING' and reviewed_by is null and reviewed_at is null);
create policy sulfa_docs_admin_update on public.sulfa_documents for update to authenticated
using (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true))
with check (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));

create policy sulfa_accounts_read_owner_or_admin on public.sulfa_accounts for select to authenticated
using (owner_user_id=(select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_transactions_read_owner_or_admin on public.sulfa_transactions for select to authenticated
using (user_id=(select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_ledger_read_owner_or_admin on public.sulfa_ledger_entries for select to authenticated
using (exists (select 1 from public.sulfa_transactions t where t.id=transaction_id and (t.user_id=(select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true))));

create policy sulfa_withdrawals_read_own_or_admin on public.sulfa_withdrawals for select to authenticated
using (user_id=(select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_withdrawals_insert_own on public.sulfa_withdrawals for insert to authenticated
with check (user_id=(select auth.uid()) and status='SUBMITTED' and reviewed_by is null and reviewed_at is null);
create policy sulfa_withdrawals_admin_update on public.sulfa_withdrawals for update to authenticated
using (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true))
with check (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));

create policy sulfa_notifications_read_own_or_admin on public.sulfa_notifications for select to authenticated
using (user_id=(select auth.uid()) or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_notifications_insert_admin on public.sulfa_notifications for insert to authenticated
with check (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_notifications_update_own_read on public.sulfa_notifications for update to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create policy sulfa_audit_read_admin on public.sulfa_audit_logs for select to authenticated
using (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));
create policy sulfa_audit_insert_admin on public.sulfa_audit_logs for insert to authenticated
with check (exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true));

-- Private document bucket. Existing storage buckets and objects are untouched.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('sulfa-identity','sulfa-identity',false,8388608,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=8388608, allowed_mime_types=array['image/jpeg','image/png','image/webp','application/pdf'];

drop policy if exists sulfa_identity_upload_own_folder on storage.objects;
drop policy if exists sulfa_identity_read_own_or_admin on storage.objects;
create policy sulfa_identity_upload_own_folder on storage.objects for insert to authenticated
with check (bucket_id='sulfa-identity' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy sulfa_identity_read_own_or_admin on storage.objects for select to authenticated
using (bucket_id='sulfa-identity' and ((storage.foldername(name))[1]=(select auth.uid())::text or exists (select 1 from public.sulfa_admins a where a.user_id=(select auth.uid()) and a.active=true)));

-- Create the initial admin account in Supabase Auth first, then replace the email below
-- and run this INSERT. Never put the admin password in SQL, HTML, or JavaScript.
-- insert into public.sulfa_admins(user_id,email,role,active)
-- select id,email,'SUPER_ADMIN',true from auth.users where lower(email)=lower('ADMIN_EMAIL_HERE')
-- on conflict (user_id) do update set role='SUPER_ADMIN',active=true,email=excluded.email;

-- No fake funds are inserted. Record only funds that have actually been deposited and verified.
