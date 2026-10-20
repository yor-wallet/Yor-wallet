/* Turns a Supabase / PostgREST error into a translation key, and says whether the outcome is CERTAIN.
 * A SQLSTATE code means the database answered and rolled back: nothing was recorded.
 * No answer (network down, timeout) means we do not know: the screen says so and the retry reuses the same
 * idempotency key, so the server can never record the operation twice. */

export type RpcFailure = { key: string; certain: boolean; raw: string };

type Err = { message?: string; code?: string; details?: string; hint?: string; status?: number } | null | undefined;

export function describeError(e: Err | unknown): RpcFailure {
  const err = (e ?? {}) as Exclude<Err, null | undefined>;
  const raw = String(err.message ?? e ?? '');
  const m = /sulfa_[a-z_]+/.exec(raw);
  if (m) return { key: 'err.' + m[0], certain: true, raw };
  if (/invalid login credentials/i.test(raw)) return { key: 'err.invalid_login', certain: true, raw };
  if (/email not confirmed/i.test(raw)) return { key: 'err.email_not_confirmed', certain: true, raw };
  if (/already registered|already been registered/i.test(raw)) return { key: 'err.already_registered', certain: true, raw };
  if (/password/i.test(raw) && /(least|short|weak)/i.test(raw)) return { key: 'err.weak_password', certain: true, raw };
  if (/rate limit|too many/i.test(raw)) return { key: 'err.rate_limited', certain: true, raw };
  if (/jwt|not authenticated|permission denied|42501/i.test(raw) || err.code === '42501') return { key: 'err.forbidden', certain: true, raw };
  if (err.code && /^[0-9A-Z]{5}$/.test(err.code)) return { key: 'err.unknown', certain: true, raw };
  if (/failed to fetch|networkerror|load failed|network request failed|timeout|aborted/i.test(raw) || !err.code)
    return { key: 'err.uncertain', certain: false, raw };
  return { key: 'err.unknown', certain: true, raw };
}
