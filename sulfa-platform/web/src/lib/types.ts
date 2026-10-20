export type AdminRole = 'SUPER_ADMIN' | 'ADMIN' | 'REVIEWER';
export type Profile = {
  user_id: string; first_name: string; last_name: string; nationality: string; gender: 'M' | 'F' | null; date_of_birth: string | null;
  email: string | null; phone: string | null; preferred_language: 'ar' | 'fr' | 'en';
  account_status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  identity_status: 'NOT_SUBMITTED' | 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'REUPLOAD_REQUIRED';
  terms_accepted_at: string | null; created_at: string; updated_at: string;
};
export type QuoteJson = { amount: number; term: number; fee: number; interest: number; total: number; monthly: number; last: number; fee_percent: number; fee_fixed: number; monthly_rate_percent: number };
export type Application = {
  id: string; reference: string; user_id: string; requested_amount: number; requested_term: number; quote: QuoteJson;
  approved_amount: number | null; approved_term: number | null; approved_quote: QuoteJson | null; status: string; decision_reason: string | null;
  decided_by: string | null; decided_at: string | null; disbursed_by: string | null; disbursed_at: string | null; disbursement_tx_id: string | null;
  terms_accepted_at: string; created_at: string; updated_at: string;
};
export type AppEvent = { id: number; application_id: string; from_status: string | null; to_status: string; actor_role: string; reason: string | null; created_at: string };
export type Doc = { id: string; user_id: string; document_type: string; storage_path: string; status: string; review_reason: string | null; reviewed_at: string | null; created_at: string };
export type Installment = { id: string; application_id: string; seq: number; due_date: string; amount_due: number; amount_paid: number; status: 'DUE' | 'PARTIAL' | 'PAID'; paid_at: string | null };
export type Repayment = { id: string; reference: string; application_id: string; user_id: string; amount: number; internal_reference: string; recorded_at: string; tx_id: string };
export type Withdrawal = {
  id: string; reference: string; user_id: string; amount: number; bank_name: string; account_holder: string; bank_account: string; status: string;
  decision_reason: string | null; reviewed_at: string | null; paid_at: string | null; internal_reference: string | null; tx_id: string | null; created_at: string; updated_at: string;
};
export type Tx = {
  id: string; reference: string; transaction_type: string; user_id: string | null; application_id: string | null; withdrawal_id: string | null;
  amount: number; status: 'RECORDED' | 'REVERSED'; source: string; validated_by: string; validated_at: string; internal_reference: string | null;
  reverses_tx_id: string | null; reversed_by_tx_id: string | null; note: string | null; created_at: string;
};
export type Notification = { id: string; user_id: string; template_key: string; params: Record<string, unknown>; entity_type: string | null; entity_id: string | null; read_at: string | null; created_at: string };
export type Summary = { balance: number; reserved: number; available: number; open_applications: number; approved_total: number; outstanding: number; repaid_total: number; next_due: { date: string; amount: number; reference: string } | null; unread: number };
export type PublicSettings = { min_amount: number; max_amount: number; min_term: number; max_term: number; fee_fixed: number; fee_percent: number; monthly_rate_percent: number; currency: string; default_language: string };
