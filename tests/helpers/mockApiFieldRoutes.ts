// Sales, service, payroll, attendance and overview routes of the fake backend (split out of mockApi.ts).
import { ok, fail, type Account, type Init, type MockProject } from './mockApiShared';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type FieldState = {
  sales: { leads: any[]; quotes: any[] };
  service: { tickets: any[]; visits: any[] };
  payroll: { run: any; payslips: any[]; edits: any[] };
  attendance: { open: any; records: any[]; punches: any[] };
  projects: MockProject[];
  overview: any;
  users: Map<string, Account>;
  perms: (a: Account) => string[];
};

export function fieldRoutes(st: FieldState, path: string, method: string, body: any, init: Init, me: Account) {
  const { sales, service, payroll, attendance, projects, overview, users, perms } = st;
  if (path.startsWith('/sales/')) {
    if (!perms(me).includes('sales.manage')) return fail(403, 'FORBIDDEN', 'You do not have access to this');
    const withQuotes = (l: any) => ({ ...l, quotes: sales.quotes.filter((q) => q.leadId === l.id) });
    if (path === '/sales/summary') return ok({ stages: {}, followUpsDue: sales.leads.filter((l) => l.followUpDue).length, wonThisMonth: 0, openCount: sales.leads.length, openValue: sales.leads.reduce((a, l) => a + l.estValue, 0), winRatePct: null });
    if (path === '/sales/people') return ok([{ id: me.id, name: me.name }]);
    if (path.startsWith('/sales/leads?')) return ok(sales.leads);
    const lq = path.match(/^\/sales\/leads\/([^/]+)\/quotes$/);
    if (lq && method === 'POST') {
      const lines = body.lines.map((x: any) => ({ ...x, amount: x.qty * x.rate }));
      const taxable = lines.reduce((a: number, x: any) => a + x.amount, 0) - body.discount;
      const q = { id: `q${sales.quotes.length + 1}`, leadId: lq[1], number: 'QT-0001', version: 1, label: 'QT-0001', status: 'draft', ...body, lines, taxable, gst: taxable * body.gstRate / 100, total: Math.round(taxable * (1 + body.gstRate / 100)), terms: body.terms ?? '', validTill: body.validTill ?? null, subject: body.subject ?? '', sentAt: null };
      sales.quotes.push(q);
      return ok(q, 201);
    }
    const sq = path.match(/^\/sales\/quotes\/([^/]+)\/send$/);
    if (sq) { const q = sales.quotes.find((x) => x.id === sq[1]); q.status = 'sent'; return ok(q); }
    const lm = path.match(/^\/sales\/leads\/([^/]+)$/);
    if (lm) {
      const l = sales.leads.find((x) => x.id === lm[1]);
      if (!l) return fail(404, 'NOT_FOUND', 'Enquiry not found');
      if (method === 'PATCH') Object.assign(l, body);
      return ok(withQuotes(l));
    }
  }
  if (path.startsWith('/service/')) {
    const mgr = perms(me).includes('service.manage');
    const mine = (t: any) => mgr || t.assignedTo?.id === me.id;
    if (path.startsWith('/service/tickets?')) return ok(service.tickets.filter(mine));
    if (path === '/service/technicians') return mgr ? ok([...users.values()].map((u) => ({ id: u.id, name: u.name, role: u.role }))) : fail(403, 'FORBIDDEN', 'You do not have access to this');
    const tm = path.match(/^\/service\/tickets\/([^/]+)(?:\/(assign|visits))?$/);
    if (tm) {
      const t = service.tickets.find((x) => x.id === tm[1]);
      if (!t || !mine(t)) return fail(404, 'NOT_FOUND', 'Ticket not found');
      if (tm[2] === 'assign') {
        const u = [...users.values()].find((x) => x.id === body.userId)!;
        t.assignedTo = { id: u.id, name: u.name };
        t.status = 'assigned';
        t.visits.push({ at: new Date().toISOString(), byName: me.name, note: `Assigned to ${u.name}`, partsUsed: '', status: 'assigned' });
      }
      if (tm[2] === 'visits') {
        if (t.underWarranty && body.charge && !mgr) return fail(422, 'UNDER_WARRANTY', 'This is under warranty - no charge');
        service.visits.push(body);
        t.status = body.status;
        t.visits.push({ at: new Date().toISOString(), byName: me.name, note: body.note, partsUsed: body.partsUsed ?? '', status: body.status });
      }
      return ok(t);
    }
  }
  if (path === '/payroll/my-payslips') return ok({ advanceOutstanding: 400, payslips: payroll.payslips });
  const prM = path.match(/^\/payroll\/runs\/([^/]+)(?:\/lines\/([^/]+))?$/);
  if (prM) {
    if (!perms(me).includes('payroll.manage')) return fail(403, 'FORBIDDEN', 'You do not have access to this');
    if (prM[2]) {
      payroll.edits.push(body);
      const l = payroll.run.lines.find((x: { id: string }) => x.id === prM[2]);
      Object.assign(l, body, { edited: true });
      l.gross = l.basePay + l.otPay + l.allowance + l.adjustment;
      l.net = l.gross - l.advanceDeduction - l.otherDeduction;
    }
    return ok(payroll.run);
  }
  if (path === '/attendance/today') {
    return ok({ date: '2026-11-12', shiftHours: 8, open: attendance.open, todayMinutes: 0, places: projects.filter((x) => x.memberIds.includes(me.id)).map((x) => ({ place: 'project', projectId: x.id, name: `${x.code} ${x.name}`, hasLocation: !!x.location, radiusM: x.geofenceRadiusM })) });
  }
  if (path.startsWith('/attendance/mine')) return ok({ month: '2026-11', daysPresent: attendance.records.length, totalMinutes: 0, records: attendance.records });
  if (path === '/attendance/check-in' || path === '/attendance/check-out') {
    const f = init.body as unknown as FormData;
    const fields = Object.fromEntries(['place', 'projectId', 'lat', 'lng', 'accuracy', 'mocked'].map((k) => [k, f.get(k)]));
    attendance.punches.push({ path, fields, selfie: !!f.get('selfie') });
    if (path === '/attendance/check-in') {
      if (Number(fields.lat) > 19.02) return fail(422, 'OUTSIDE_SITE', 'You are 1400 m from Worli. You must be within 200 m to check in.');
      attendance.open = { id: 'a1', user: { id: me.id }, place: 'project', project: { id: 'p1', name: 'Worli', code: 'P-001' }, date: '2026-11-12', checkIn: { at: new Date(Date.now() - 125 * 60000).toISOString(), time: '09:05', distanceM: 20, insideSite: true, accuracyM: 10, manual: false, photoUrl: null }, checkOut: null, status: 'open', workedMinutes: 125, flags: [], correctionReason: null };
      return ok(attendance.open, 201);
    }
    const done = { ...attendance.open, status: 'closed', checkOut: { ...attendance.open.checkIn, time: '17:20' }, workedMinutes: 495 };
    attendance.open = null;
    attendance.records.push(done);
    return ok(done);
  }
  if (path === '/dashboard/overview') {
    if (!perms(me).includes('project.manage')) return fail(403, 'FORBIDDEN', 'You do not have access to this');
    return ok(overview);
  }
  return null;
}
