-- SULFA 1.6: Omani banks for withdrawals, mandatory selfie for identity verification, Arabic validation email queue.
-- Idempotent, additive: no existing row is changed or deleted. Written as explicit statements (no dynamic DO blocks) and applied to the live project one statement at a time.

-- 1. banks the client can choose for a withdrawal (reference data; the administrator keeps it up to date) ---------------
create table if not exists public.sulfa_banks (
  code text primary key check (length(code) between 2 and 24 and code = upper(code)),
  name_ar text not null,
  name_en text not null,
  kind text not null check (kind in ('LOCAL','ISLAMIC','SPECIALIZED','FOREIGN')),
  active boolean not null default true,
  sort integer not null default 100,
  updated_at timestamptz not null default now()
);
alter table public.sulfa_banks enable row level security;
revoke all on public.sulfa_banks from anon, authenticated;
grant select on public.sulfa_banks to anon, authenticated;
drop policy if exists sulfa_banks_read on public.sulfa_banks;
drop policy if exists sulfa_banks_read_anon on public.sulfa_banks;
create policy sulfa_banks_read_anon on public.sulfa_banks for select to anon using (active);
create policy sulfa_banks_read on public.sulfa_banks for select to authenticated using (active or public.sulfa_is_admin());

-- reference rows below are written by the migration itself: open the RPC gate for this session only, closed again below
select set_config('sulfa.rpc', 'on', false);

-- later changes go through sulfa_admin_upsert_bank()
insert into public.sulfa_banks (code, name_ar, name_en, kind, sort) values
  ('BANK_MUSCAT', 'بنك مسقط', 'Bank Muscat', 'LOCAL', 10),
  ('NBO', 'البنك الوطني العماني', 'National Bank of Oman', 'LOCAL', 20),
  ('BANK_DHOFAR', 'بنك ظفار', 'Bank Dhofar', 'LOCAL', 30),
  ('SOHAR_INTL', 'صحار الدولي', 'Sohar International', 'LOCAL', 40),
  ('OMAN_ARAB_BANK', 'البنك العربي العماني', 'Oman Arab Bank', 'LOCAL', 50),
  ('AHLI_BANK', 'البنك الأهلي', 'Ahli Bank', 'LOCAL', 60),
  ('BANK_NIZWA', 'بنك نزوى', 'Bank Nizwa', 'ISLAMIC', 70),
  ('ALIZZ', 'بنك العز الإسلامي', 'Alizz Islamic Bank', 'ISLAMIC', 80),
  ('OMAN_HOUSING_BANK', 'بنك الإسكان العماني', 'Oman Housing Bank', 'SPECIALIZED', 90),
  ('DEVELOPMENT_BANK', 'بنك التنمية', 'Development Bank', 'SPECIALIZED', 100),
  ('STANDARD_CHARTERED', 'ستاندرد تشارترد', 'Standard Chartered', 'FOREIGN', 110),
  ('FAB', 'بنك أبوظبي الأول', 'First Abu Dhabi Bank', 'FOREIGN', 120),
  ('QNB', 'بنك قطر الوطني', 'Qatar National Bank', 'FOREIGN', 130),
  ('SBI', 'بنك الدولة الهندي', 'State Bank of India', 'FOREIGN', 140),
  ('HBL', 'بنك حبيب المحدود', 'Habib Bank Limited', 'FOREIGN', 150),
  ('BANK_OF_BARODA', 'بنك بارودا', 'Bank of Baroda', 'FOREIGN', 160),
  ('BANK_OF_BEIRUT', 'بنك بيروت', 'Bank of Beirut', 'FOREIGN', 170)
on conflict (code) do nothing;

drop trigger if exists sulfa_banks_rpc_only on public.sulfa_banks;
create trigger sulfa_banks_rpc_only before insert or update or delete on public.sulfa_banks for each row execute function public.sulfa__guard_rpc_only();

create or replace function public.sulfa_admin_upsert_bank(p_code text, p_name_ar text, p_name_en text, p_kind text, p_active boolean, p_sort integer default 100)
returns public.sulfa_banks language plpgsql security definer set search_path = '' as $$
declare admin uuid := public.sulfa__require_admin(array['SUPER_ADMIN']); b public.sulfa_banks;
begin
  if btrim(coalesce(p_name_ar, '')) = '' or btrim(coalesce(p_name_en, '')) = '' then raise exception 'sulfa_missing_field' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  insert into public.sulfa_banks (code, name_ar, name_en, kind, active, sort) values (upper(p_code), btrim(p_name_ar), btrim(p_name_en), p_kind, coalesce(p_active, true), coalesce(p_sort, 100))
  on conflict (code) do update set name_ar = excluded.name_ar, name_en = excluded.name_en, kind = excluded.kind, active = excluded.active, sort = excluded.sort, updated_at = now()
  returning * into b;
  perform public.sulfa__audit('BANK_UPSERTED', 'bank', b.code, null, to_jsonb(b));
  return b;
end $$;

-- 2. withdrawals remember which listed bank was chosen (nullable: older rows and "other bank" keep the free text) -------
alter table public.sulfa_withdrawals add column if not exists bank_code text references public.sulfa_banks(code);

-- new 6-parameter version next to the original 5-parameter one (kept unchanged for older app versions)
create or replace function public.sulfa_request_withdrawal(p_amount numeric, p_bank text, p_holder text, p_account text, p_idempotency_key text, p_bank_code text)
returns public.sulfa_withdrawals language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); w public.sulfa_withdrawals; bal numeric; avail numeric; bk public.sulfa_banks; bank text := btrim(coalesce(p_bank, ''));
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 then raise exception 'sulfa_idempotency_key_required' using errcode = '22023'; end if;
  select * into w from public.sulfa_withdrawals where user_id = u and idempotency_key = p_idempotency_key;
  if found then return w; end if;
  if p_amount is null or p_amount <= 0 or round(p_amount, 3) <> p_amount then raise exception 'sulfa_invalid_amount' using errcode = '22023'; end if;
  if p_bank_code is not null then
    select * into bk from public.sulfa_banks where code = p_bank_code and active;
    if not found then raise exception 'sulfa_invalid_bank' using errcode = '22023'; end if;
    bank := bk.name_en || ' / ' || bk.name_ar;                              -- the name always comes from the reference list
  end if;
  if bank = '' or btrim(coalesce(p_holder, '')) = '' or btrim(coalesce(p_account, '')) = '' then raise exception 'sulfa_missing_field' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  perform pg_advisory_xact_lock(hashtext('sulfa_wallet:' || u));            -- one balance check at a time per client
  bal := public.sulfa__account_balance(public.sulfa__client_account(u));
  avail := bal - public.sulfa__reserved(u);
  if p_amount > avail then raise exception 'sulfa_insufficient_funds' using errcode = '22023'; end if;
  insert into public.sulfa_withdrawals (reference, user_id, amount, bank_name, bank_code, account_holder, bank_account, idempotency_key)
  values (public.sulfa__ref('SLFWD'), u, p_amount, left(bank, 120), p_bank_code, left(btrim(p_holder), 80), left(btrim(p_account), 40), p_idempotency_key) returning * into w;
  perform public.sulfa__notify(u, 'WITHDRAWAL_REQUESTED', jsonb_build_object('reference', w.reference, 'amount', w.amount, 'currency', 'OMR'), 'withdrawal', w.id);
  perform public.sulfa__audit('WITHDRAWAL_REQUESTED', 'withdrawal', w.id::text, null, jsonb_build_object('amount', w.amount, 'bank_code', p_bank_code));
  return w;
end $$;

-- 3. selfie: a new document type, required (with both sides of the ID card) for the identity to be VERIFIED -------------
alter table public.sulfa_documents drop constraint if exists sulfa_documents_document_type_check;
alter table public.sulfa_documents add constraint sulfa_documents_document_type_check check (document_type in ('id_front','id_back','selfie','address_proof','other'));

create or replace function public.sulfa__refresh_identity(p_user uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare st text; prev text; f text; b text; s text;
begin
  select identity_status into prev from public.sulfa_profiles where user_id = p_user;
  select status into f from public.sulfa_documents where user_id = p_user and document_type = 'id_front' and status <> 'REPLACED' order by created_at desc limit 1;
  select status into b from public.sulfa_documents where user_id = p_user and document_type = 'id_back' and status <> 'REPLACED' order by created_at desc limit 1;
  select status into s from public.sulfa_documents where user_id = p_user and document_type = 'selfie' and status <> 'REPLACED' order by created_at desc limit 1;
  st := case
    when f is null and b is null and s is null then 'NOT_SUBMITTED'
    when f = 'VERIFIED' and b = 'VERIFIED' and s = 'VERIFIED' then 'VERIFIED'
    when 'REJECTED' in (f, b, s) then 'REJECTED'
    when 'REUPLOAD_REQUIRED' in (f, b, s) then 'REUPLOAD_REQUIRED'
    when 'IN_REVIEW' in (f, b, s) then 'IN_REVIEW'
    else 'PENDING' end;
  update public.sulfa_profiles set identity_status = st, updated_at = now() where user_id = p_user;
  if st = 'VERIFIED' and prev is distinct from 'VERIFIED' then
    perform public.sulfa__notify(p_user, 'IDENTITY_VERIFIED', '{}'::jsonb, 'profile', p_user);
    -- the validation e-mail is always written in Arabic
    update public.sulfa_email_log set language = 'ar' where template_key = 'IDENTITY_VERIFIED' and user_id = p_user and status in ('NO_PROVIDER','QUEUED');
  end if;
  return st;
end $$;

create or replace function public.sulfa_register_document(p_type text, p_path text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare u uuid := (select auth.uid()); did uuid;
begin
  if u is null then raise exception 'sulfa_unauthenticated' using errcode = '28000'; end if;
  if p_type not in ('id_front','id_back','selfie','address_proof','other') then raise exception 'sulfa_invalid_document_type' using errcode = '22023'; end if;
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

-- 4. Arabic validation e-mail (sent by the sulfa-mailer edge function when a provider key is configured) ----------------
insert into public.sulfa_message_templates (key, language, subject, body) values
  ('IDENTITY_VERIFIED', 'ar', 'تم التحقق من هويتك في سلفه',
   'مرحباً {name}،' || chr(10) || chr(10) || 'يسعدنا إبلاغك بأن فريق سلفه راجع بطاقتك الشخصية وصورتك الشخصية (سيلفي) وتم التحقق من هويتك بنجاح.' || chr(10) ||
   'يمكنك الآن تقديم طلب تمويل ومتابعته خطوة بخطوة من حسابك.' || chr(10) || chr(10) || 'مع تحيات فريق سلفه')
on conflict (key, language) do nothing;
select set_config('sulfa.rpc', '', false);

-- the mailer marks what really happened: SENT with the provider id, or FAILED with the error (never "sent" without proof)
create or replace function public.sulfa__mail_mark(p_id bigint, p_status text, p_provider text, p_message_id text, p_error text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('SENT','FAILED','QUEUED') then raise exception 'sulfa_invalid_status' using errcode = '22023'; end if;
  perform public.sulfa__enter();
  update public.sulfa_email_log set status = p_status, provider = p_provider, provider_message_id = p_message_id, error = left(p_error, 500),
    attempts = attempts + 1, updated_at = now() where id = p_id;
end $$;

-- 5. execute rights (explicit; internal sulfa__ helpers stay private, the mailer uses the service role) -----------------
revoke all on function public.sulfa_admin_upsert_bank(text, text, text, text, boolean, integer) from public, anon, authenticated;
grant execute on function public.sulfa_admin_upsert_bank(text, text, text, text, boolean, integer) to authenticated;
revoke all on function public.sulfa_request_withdrawal(numeric, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sulfa_request_withdrawal(numeric, text, text, text, text, text) to authenticated;
revoke all on function public.sulfa_register_document(text, text) from public, anon, authenticated;
grant execute on function public.sulfa_register_document(text, text) to authenticated;
revoke all on function public.sulfa__refresh_identity(uuid) from public, anon, authenticated;
revoke all on function public.sulfa__mail_mark(bigint, text, text, text, text) from public, anon, authenticated;
grant execute on function public.sulfa__mail_mark(bigint, text, text, text, text) to service_role;
