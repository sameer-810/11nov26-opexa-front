import type { SignInInput } from './types';

// Same rules as the backend, so most mistakes are caught before sending.
export type Errors<T> = Partial<Record<keyof T | 'confirmPassword', string>>;

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function passwordProblem(p: string): string | undefined {
  if (p.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(p)) return 'Password must contain a letter';
  if (!/[0-9]/.test(p)) return 'Password must contain a number';
  return undefined;
}

export function validateSignIn(v: SignInInput): Errors<SignInInput> {
  const e: Errors<SignInInput> = {};
  if (!emailOk(v.email)) e.email = 'Enter a valid email address';
  if (!v.password) e.password = 'Enter your password';
  return e;
}
