export type Punch = { at: string; time: string; distanceM: number | null; insideSite: boolean | null; accuracyM: number | null; manual: boolean; photoUrl: string | null };
export type AttendanceRecord = {
  id: string; user: { id: string; name?: string; role?: string }; place: 'project' | 'office';
  project: { id: string; name: string; code: string } | null; date: string; checkIn: Punch; checkOut: Punch | null;
  status: 'open' | 'closed' | 'auto-closed'; workedMinutes: number; flags: string[]; correctionReason: string | null;
};
export type Place = { place: 'project' | 'office'; projectId: string | null; name: string; hasLocation: boolean; radiusM: number };
export type Today = { date: string; shiftHours: number; open: AttendanceRecord | null; todayMinutes: number; places: Place[] };
export type Mine = { month: string; daysPresent: number; totalMinutes: number; records: AttendanceRecord[] };
export type TeamDay = { date: string; projects: { id: string; code: string; name: string }[]; records: AttendanceRecord[]; absent: { id: string; name: string; role: string }[] };
export type TeamMonth = { month: string; people: { user: { id: string; name: string; role: string }; daysPresent: number; totalMinutes: number; flagged: number; sessions: number }[] };
export type Office = { office: { name: string; lat: number; lng: number; radiusM: number } | null; shiftHours: number };

export const hm = (mins: number) => `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
export const FLAG_LABEL: Record<string, string> = {
  'checkout-outside': 'Left site before check-out',
  'no-checkout': 'Forgot to check out',
  corrected: 'Corrected by manager',
  manual: 'Added by manager',
};
