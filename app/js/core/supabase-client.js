'use strict';

/* ============================================================
   SUPABASE CONFIG — replace with your project's public keys
   (Settings → API). The anon key is public; NEVER put the
   service_role key in this file.
   ============================================================ */
const SUPABASE_URL = "https://gebjmguoauvutiqvoswl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYmptZ3VvYXV2dXRpcXZvc3dsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwOTExMzAsImV4cCI6MjEwNjY2NzEzMH0.2EvBOXWsrpm-vZfnoBnzrEoYeJ6-L6NorkNBiYGsYiU";

let supabaseReady = false;
let sb = null;
function initSupabase(){
  if (supabaseReady) return true;
  if (!window.supabase || !window.supabase.createClient) return false;
  if (SUPABASE_URL.indexOf('REPLACE_') === 0 || SUPABASE_ANON_KEY.indexOf('REPLACE_') === 0) return false;
  try {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    supabaseReady = true;
    return true;
  } catch(e){ console.error('Supabase init failed', e); return false; }
}

/* ============================================================
   ID GENERATORS
   ============================================================ */
const ID_PREFIX = Object.freeze({ USER:'USR-', ACCOUNT:'ACC-', CARD:'CARD-', BENEFICIARY:'BEN-', TRANSACTION:'TX-', RECEIPT:'REC-', NOTIFICATION:'NOTIF-', TRANSFER:'TRF-', WALLET:'CW-', BANK:'BK-', BANK_ACC:'BA-', CONTACT:'CT-', DEVICE:'DEV-', SESSION:'SES-' });
function genId(p){ return p + Date.now().toString(36).slice(-4).toUpperCase() + Math.random().toString(36).slice(2,6).toUpperCase(); }
function uuid(){
  try { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); } catch(e){}
  return 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}
const ID = {
  user:()=>genId(ID_PREFIX.USER), account:()=>genId(ID_PREFIX.ACCOUNT), card:()=>genId(ID_PREFIX.CARD),
  beneficiary:()=>genId(ID_PREFIX.BENEFICIARY), transaction:()=>genId(ID_PREFIX.TRANSACTION),
  receipt:()=>genId(ID_PREFIX.RECEIPT), notification:()=>genId(ID_PREFIX.NOTIFICATION),
  transfer:()=>genId(ID_PREFIX.TRANSFER), wallet:()=>genId(ID_PREFIX.WALLET),
  bankAccount:()=>genId(ID_PREFIX.BANK_ACC), contact:()=>genId(ID_PREFIX.CONTACT),
  device:()=>genId(ID_PREFIX.DEVICE), session:()=>genId(ID_PREFIX.SESSION),
  reference:()=>'YOR-' + Math.random().toString(36).slice(2,10).toUpperCase(),
  uuid: uuid
};

