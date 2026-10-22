// SULFA mailer (Supabase Edge Function, Deno).
// Sends the queued e-mails that have a template (today: IDENTITY_VERIFIED, in Arabic) through Brevo's transactional API.
// Called by an administrator from the app right after a document decision. Secrets live in Supabase, never in the site:
//   BREVO_API_KEY   transactional API key (Brevo → SMTP & API → API keys)
//   SULFA_MAIL_FROM verified sender address, e.g. no-reply@your-domain
// Without BREVO_API_KEY nothing is sent and rows stay NO_PROVIDER: the app then says "not sent", never "sent".
import { createClient } from 'npm:@supabase/supabase-js@2.118.0';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const BREVO = Deno.env.get('BREVO_API_KEY') ?? '';
const FROM = Deno.env.get('SULFA_MAIL_FROM') ?? '';
const SITE = Deno.env.get('SULFA_SITE_URL') ?? 'https://sulfa-oman.vercel.app';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function html(subject: string, body: string) {
  const paras = esc(body).split(/\n{2,}/).map(p => `<p style="margin:0 0 16px;line-height:1.9">${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(subject)}</title></head>
<body style="margin:0;background:#eef4f1;font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#10231e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef4f1;padding:28px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:22px;overflow:hidden">
<tr><td style="background:linear-gradient(135deg,#0d7f5c,#032a21);background-color:#064a3a;padding:30px 28px;text-align:right">
<img src="${SITE}/brand/icon-rounded-512.png" width="56" height="56" alt="سلفه" style="border-radius:16px;display:inline-block">
<div style="color:#fff;font-size:26px;font-weight:700;margin-top:12px">سلفه</div>
<div style="color:#e3c27a;font-size:11px;letter-spacing:4px;font-family:Arial">SULFA FINANCE</div></td></tr>
<tr><td style="padding:30px 28px;text-align:right;font-size:16px">
<div style="display:inline-block;background:#e6f6ef;color:#087f5b;border-radius:999px;padding:6px 14px;font-weight:700;font-size:13px;margin-bottom:18px">✓ تم التحقق من الهوية</div>
<h1 style="font-size:22px;margin:0 0 18px;color:#063b32">${esc(subject)}</h1>${paras}
<a href="${SITE}/client/" style="display:inline-block;background:#087f5b;color:#fff;text-decoration:none;font-weight:700;border-radius:14px;padding:14px 26px;margin-top:6px">الدخول إلى حسابي</a>
</td></tr>
<tr><td style="padding:18px 28px;background:#f7faf9;color:#6b7f79;font-size:12px;line-height:1.8;text-align:right">
وصلتك هذه الرسالة لأن لديك حساباً في سلفه. لا نطلب منك أبداً كلمة المرور أو رمز التحقق عبر البريد الإلكتروني.</td></tr>
</table></td></tr></table></body></html>`;
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  // only an active administrator may trigger sending
  const auth = req.headers.get('Authorization') ?? '';
  const caller = createClient(URL_, ANON, { global: { headers: { Authorization: auth } } });
  const { data: isAdmin, error: aerr } = await caller.rpc('sulfa_is_admin');
  if (aerr || isAdmin !== true) return json({ error: 'sulfa_forbidden' }, 403);

  const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: rows, error } = await db.from('sulfa_email_log').select('id, user_id, template_key, language, to_email, status')
    .in('status', ['NO_PROVIDER', 'QUEUED']).eq('template_key', 'IDENTITY_VERIFIED').order('id').limit(20);
  if (error) return json({ error: error.message }, 500);
  // names of the missing secrets only (never their values), so an administrator can see what to add
  const missing = [!BREVO && 'BREVO_API_KEY', !FROM && 'SULFA_MAIL_FROM'].filter(Boolean);
  if (missing.length) return json({ configured: false, missing, pending: rows?.length ?? 0, sent: 0, failed: 0 });

  // { test: true }: one test e-mail to the calling administrator's own address, to prove the provider really delivers
  const body0 = await req.json().catch(() => ({}));
  if (body0?.test === true) {
    const { data: me } = await caller.auth.getUser();
    const to = me?.user?.email;
    if (!to) return json({ error: 'no_address' }, 400);
    const subject = 'رسالة تجريبية من سلفه';
    const text = 'مرحباً،' + '\n\n' + 'هذه رسالة تجريبية للتأكد من أن إرسال البريد الإلكتروني من سلفه يعمل بشكل صحيح.' + '\n\n' + 'مع تحيات فريق سلفه';
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': BREVO, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ sender: { name: 'سلفه SULFA', email: FROM }, to: [{ email: to }], subject, htmlContent: html(subject, text), textContent: text }),
    });
    const out = await res.json().catch(() => ({}));
    return json({ configured: true, test: true, ok: res.ok && !!out.messageId, status: res.status, messageId: out.messageId ?? null, error: res.ok ? null : (out.message ?? out.code ?? null) });
  }

  let sent = 0, failed = 0;
  for (const r of rows ?? []) {
    const { data: tpl } = await db.from('sulfa_message_templates').select('subject, body').eq('key', r.template_key).eq('language', 'ar').maybeSingle();
    const { data: prof } = await db.from('sulfa_profiles').select('first_name, last_name').eq('user_id', r.user_id).maybeSingle();
    if (!tpl || !r.to_email) { await db.rpc('sulfa__mail_mark', { p_id: r.id, p_status: 'FAILED', p_provider: 'brevo', p_message_id: null, p_error: !tpl ? 'no_template' : 'no_address' }); failed++; continue; }
    const name = [prof?.first_name, prof?.last_name].filter(Boolean).join(' ') || 'عميلنا العزيز';
    const body = tpl.body.replaceAll('{name}', name);
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST', headers: { 'api-key': BREVO, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ sender: { name: 'سلفه SULFA', email: FROM }, to: [{ email: r.to_email, name }], subject: tpl.subject, htmlContent: html(tpl.subject, body), textContent: body, headers: { 'X-SULFA-Log': String(r.id) } }),
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.messageId) { await db.rpc('sulfa__mail_mark', { p_id: r.id, p_status: 'SENT', p_provider: 'brevo', p_message_id: out.messageId, p_error: null }); sent++; }
      else { await db.rpc('sulfa__mail_mark', { p_id: r.id, p_status: 'FAILED', p_provider: 'brevo', p_message_id: null, p_error: `${res.status} ${JSON.stringify(out).slice(0, 300)}` }); failed++; }
    } catch (e) {
      await db.rpc('sulfa__mail_mark', { p_id: r.id, p_status: 'QUEUED', p_provider: 'brevo', p_message_id: null, p_error: String(e) }); failed++;
    }
  }
  return json({ configured: true, pending: (rows?.length ?? 0) - sent - failed, sent, failed });
});
