'use client';
import { useCallback, useRef } from 'react';

export function newKey(prefix = 'web'): string {
  const r = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${r}`;
}

/** One key per intended operation: kept across retries (same request), renewed only after a confirmed result. */
export function useIdempotencyKey(prefix: string): [() => string, () => void] {
  const ref = useRef<string>('');
  const get = useCallback(() => (ref.current ||= newKey(prefix)), [prefix]);
  const renew = useCallback(() => { ref.current = ''; }, []);
  return [get, renew];
}
