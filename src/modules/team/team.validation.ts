import { passwordProblem } from '../auth/auth.validation';
import type { NewMemberInput } from './types';

export type MemberErrors = Partial<Record<keyof NewMemberInput, string>>;

export function validateNewMember(v: NewMemberInput): MemberErrors {
  const e: MemberErrors = {};
  if (v.name.trim().length < 2) e.name = 'Enter the name';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = 'Enter a valid email address';
  if (!/^\+?[0-9\s-]{10,15}$/.test(v.phone.trim())) e.phone = 'Enter a valid phone number';
  if (!v.role) e.role = 'Choose a role';
  const pw = passwordProblem(v.password);
  if (pw) e.password = pw;
  return e;
}

// Easy-to-read temporary password: 4 letters + 4 digits, no look-alike characters.
export function generateTempPassword(): string {
  const letters = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const digits = '23456789';
  const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
  return Array.from({ length: 4 }, () => pick(letters)).join('') + Array.from({ length: 4 }, () => pick(digits)).join('');
}
