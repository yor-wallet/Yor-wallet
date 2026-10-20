/** full years between a YYYY-MM-DD birth date and today */
export function age(dob: string, now = new Date()): number {
  const d = new Date(dob + 'T00:00:00');
  return now.getFullYear() - d.getFullYear() - (now < new Date(now.getFullYear(), d.getMonth(), d.getDate()) ? 1 : 0);
}
export const isPhone = (s: string) => /^\+[0-9]{8,15}$/.test(s.trim());
export const isEmail = (s: string) => /^\S+@\S+\.\S+$/.test(s.trim());
/** OMR amount: positive, at most 3 decimals */
export const isAmount = (s: string) => /^\d+(\.\d{1,3})?$/.test(s.trim()) && Number(s) > 0;
