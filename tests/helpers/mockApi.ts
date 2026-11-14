// A fake backend for frontend tests: answers /auth/* and /users/* like the real API does.
type Account = {
  id: string;
  companyName: string;
  name: string;
  email: string;
  phone: string;
  password: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  mustChangePassword: boolean;
};

const ALL = [
  'team.manage', 'settings.manage', 'project.manage', 'boq.edit', 'requisition.create', 'requisition.overrideBoq',
  'purchase.manage', 'receiving.record', 'attendance.self', 'attendance.viewAll', 'payroll.manage',
  'invoice.create', 'invoice.edit', 'reports.view', 'service.manage', 'sales.manage',
];
const DEFAULTS: Record<string, string[]> = {
  owner: ALL,
  purchaser: ['purchase.manage', 'reports.view', 'attendance.self'],
  engineer: ['requisition.create', 'receiving.record', 'attendance.self', 'service.manage'],
  supervisor: ['receiving.record', 'attendance.self'],
  accounts: ['attendance.viewAll', 'payroll.manage', 'invoice.create', 'invoice.edit', 'reports.view', 'attendance.self'],
  staff: ['attendance.self'],
};
type MockProject = {
  id: string; code: string; name: string; clientName: string; status: string; siteAddress: string | null;
  clientPoNumber: string | null; poDate: null; location: { lat: number; lng: number } | null; geofenceRadiusM: number; memberIds: string[];
};

const CATALOG = ALL.map((key) => ({ key, group: key.split('.')[0], label: key }));

export function installMockApi() {
  const users = new Map<string, Account>(); // email -> account
  const refreshTokens = new Map<string, string>(); // token -> email
  const accessTokens = new Map<string, string>(); // token -> email
  let n = 0;
  const projects: MockProject[] = [];
  const boq: { id: string; projectId: string; serialNo: string; quantity: number; rate: number; amount: number }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendors: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos: any[] = [];
  let lotCounter = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const localPurchases: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lotDto = (p: any, l: any) => {
    const status = !l.receivedAt ? 'in-transit' : l.lines.some((x: { qty: number; qtyReceived: number }) => x.qtyReceived < x.qty) ? 'received-short' : 'received';
    return {
      ...l, poNumber: p.number, vendorName: p.vendor.name, status, daysInTransit: l.receivedAt ? null : 0, receivedAt: l.receivedAt ?? null, receivedBy: l.receivedBy ?? null, receiptNotes: l.receiptNotes ?? '',
      lines: l.lines.map((x: { id: string; poLineId: string; qty: number; qtyReceived?: number; qtyDamaged?: number; remark?: string }) => ({
        ...x, id: x.id ?? x.poLineId, qtyReceived: x.qtyReceived ?? null, qtyDamaged: x.qtyDamaged ?? 0, qtyShort: x.qtyReceived === undefined ? null : x.qty - x.qtyReceived - (x.qtyDamaged ?? 0), remark: x.remark ?? '',
      })),
    };
  };
  // Phase 7: material rows are seeded directly by tests (the real maths is tested in the API).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const materialRows: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const returns: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const usage: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const counts: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overview: any = {};
  // Attendance: tests set where the site is and read what was sent.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const attendance: { open: any; records: any[]; punches: any[] } = { open: null, records: [], punches: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payroll: { run: any; payslips: any[]; edits: any[] } = { run: null, payslips: [], edits: [] };
  const service: { tickets: any[]; visits: any[] } = { tickets: [], visits: [] };
  const sales: { leads: any[]; quotes: any[] } = { leads: [], quotes: [] };
  const allLots = () => pos.flatMap((p) => p.lots.map((l: unknown) => ({ p, l })));
  const orderedFor = (lineId: string) => pos.filter((p) => p.status === 'issued').flatMap((p) => p.lines).filter((l) => l.requisitionLineId === lineId).reduce((s, l) => s + l.qty, 0);
  const dispatchedFor = (lineId: string) => pos.flatMap((p) => p.lines).filter((l) => l.requisitionLineId === lineId).reduce((s, l) => s + l.dispatched, 0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const withProgress = (r: any) => {
    const lines = r.lines.map((l: { id: string; qtyRequested: number }) => {
      const ordered = orderedFor(l.id);
      return { ...l, ordered, dispatched: dispatchedFor(l.id), toOrder: r.status === 'open' ? Math.max(0, l.qtyRequested - ordered) : 0 };
    });
    const anyOrdered = lines.some((l: { ordered: number }) => l.ordered > 0);
    const allOrdered = lines.every((l: { toOrder: number }) => l.toOrder === 0);
    return { ...r, lines, purchaseStatus: r.status === 'cancelled' ? 'cancelled' : allOrdered ? 'ordered' : anyOrdered ? 'partly-ordered' : 'not-ordered' };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poDto = (p: any) => {
    const lines = p.lines.map((l: { qty: number; dispatched: number; rate: number }) => ({ ...l, amount: l.qty * l.rate, pending: p.status === 'issued' ? l.qty - l.dispatched : 0 }));
    const d = lines.reduce((s: number, l: { dispatched: number }) => s + l.dispatched, 0);
    const pending = lines.reduce((s: number, l: { pending: number }) => s + l.pending, 0);
    return { ...p, lines, total: lines.reduce((s: number, l: { amount: number }) => s + l.amount, 0), deliveryStatus: p.status === 'cancelled' ? 'cancelled' : pending === 0 ? 'dispatched' : d > 0 ? 'partly-dispatched' : 'not-dispatched' };
  };

  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const fail = (status: number, code: string, message: string, details: unknown[] = []) => ({
    ok: false,
    status,
    json: async () => ({ success: false, error: { code, message, details } }),
  });
  const perms = (a: Account) => (a.role === 'owner' ? ALL : a.permissions);
  const dto = (a: Account) => ({
    id: a.id, name: a.name, email: a.email, phone: a.phone, role: a.role, organizationId: 'o1',
    permissions: perms(a), isActive: a.isActive, mustChangePassword: a.mustChangePassword,
  });
  const owner = () => [...users.values()].find((u) => u.role === 'owner');
  const session = (email: string) => {
    const u = users.get(email)!;
    const refreshToken = `refresh-${++n}-xxxxxxxxxxxxxxxxxxxx`;
    const accessToken = `access-${n}`;
    refreshTokens.set(refreshToken, email);
    accessTokens.set(accessToken, email);
    return { accessToken, refreshToken, user: dto(u), organization: { id: 'o1', name: owner()?.companyName ?? 'Co', phone: u.phone } };
  };
  const addUser = (u: Partial<Account> & { email: string; password: string }) => {
    const acc: Account = {
      id: `u${users.size + 1}`, companyName: 'Global Airtech', name: 'Someone', phone: '9876543210', role: 'owner',
      permissions: [], isActive: true, mustChangePassword: false, ...u, email: u.email.toLowerCase(),
    };
    if (acc.role !== 'owner' && !u.permissions) acc.permissions = DEFAULTS[acc.role];
    users.set(acc.email, acc);
    return acc;
  };
  const byId = (id: string) => [...users.values()].find((u) => u.id === id);

  const net = { offline: false, idempotent: new Map<string, unknown>() };
  const fetchMock = jest.fn(async (url: string, init: { method?: string; body?: string; headers?: Record<string, string> }) => {
    if (net.offline) throw new TypeError('Network request failed');
    const key = init?.headers?.['Idempotency-Key'];
    if (key && net.idempotent.has(key)) return net.idempotent.get(key);
    const res = await route(url, init);
    if (key && (res as { ok: boolean }).ok) net.idempotent.set(key, res);
    return res;
  });
  const route = async (url: string, init: { method?: string; body?: string; headers?: Record<string, string> }) => {
    const path = url.replace(/^.*\/api\/v1/, '');
    const method = init?.method ?? 'GET';
    const body = init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {};
    const token = init?.headers?.Authorization?.replace('Bearer ', '');
    const me = token ? users.get(accessTokens.get(token) ?? '') : undefined;

    if (path === '/auth/signup') {
      if (users.has(body.email.toLowerCase())) return fail(409, 'EMAIL_TAKEN', 'An account with this email already exists', [{ field: 'email', message: 'Already registered' }]);
      addUser({ ...body, role: 'owner' });
      return ok(session(body.email.toLowerCase()), 201);
    }
    if (path === '/auth/signin') {
      const u = users.get(body.email.toLowerCase());
      if (!u || u.password !== body.password) return fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
      if (!u.isActive) return fail(403, 'ACCOUNT_DISABLED', 'This account has been deactivated');
      return ok(session(u.email));
    }
    if (path === '/auth/refresh') {
      const email = refreshTokens.get(body.refreshToken);
      if (!email) return fail(401, 'SESSION_EXPIRED', 'Session expired, please sign in again');
      refreshTokens.delete(body.refreshToken);
      return ok(session(email));
    }
    if (path === '/auth/signout') {
      refreshTokens.delete(body.refreshToken);
      return ok({ signedOut: true });
    }
    if (!me) return fail(401, 'UNAUTHENTICATED', 'Please sign in');
    if (path === '/auth/change-password') {
      if (body.currentPassword !== me.password) return fail(400, 'WRONG_PASSWORD', 'Current password is incorrect', [{ field: 'currentPassword', message: 'Incorrect password' }]);
      me.password = body.newPassword;
      me.mustChangePassword = false;
      return ok(dto(me));
    }
    if (path === '/notifications') return ok({ items: [], unread: 0 });
    const bal = path.match(/^\/projects\/([^/]+)\/boq-balance$/);
    if (bal) {
      return ok(boq.filter((i) => i.projectId === bal[1]).map((i) => {
        const requested = reqs.filter((r) => r.status === 'open').flatMap((r) => r.lines).filter((l) => l.workOrderItemId === i.id).reduce((s, l) => s + l.qtyRequested, 0);
        return { workOrderItemId: i.id, serialNo: i.serialNo, description: `Item ${i.serialNo}`, unit: 'Nos', boqQty: i.quantity, requested, balance: i.quantity - requested };
      }));
    }
    const newReq = path.match(/^\/projects\/([^/]+)\/requisitions$/);
    if (newReq && method === 'POST') {
      const lines = body.lines.map((l: { workOrderItemId: string; qty: number; reason?: string }) => {
        const item = boq.find((i) => i.id === l.workOrderItemId)!;
        const prev = reqs.filter((r) => r.status === 'open').flatMap((r) => r.lines).filter((x) => x.workOrderItemId === item.id).reduce((s, x) => s + x.qtyRequested, 0);
        const overBy = Math.min(l.qty, Math.max(0, prev + l.qty - item.quantity));
        return { id: `l${Math.random()}`, workOrderItemId: item.id, serialNo: item.serialNo, description: `Item ${item.serialNo}`, unit: 'Nos', boqQty: item.quantity, previouslyRequested: prev, qtyRequested: l.qty, overBy, overrideReason: overBy ? l.reason ?? null : null };
      });
      const missing = lines.filter((l: { overBy: number; overrideReason: string | null }) => l.overBy > 0 && !l.overrideReason);
      if (missing.length) {
        return fail(422, 'OVER_BOQ', 'Some items go beyond the work order (BOQ).', missing.map((l: { workOrderItemId: string; serialNo: string; boqQty: number; previouslyRequested: number; qtyRequested: number; overBy: number }) => ({ field: l.workOrderItemId, message: 'over', serialNo: l.serialNo, boqQty: l.boqQty, previouslyRequested: l.previouslyRequested, qtyRequested: l.qtyRequested, overBy: l.overBy })));
      }
      const r = { id: `r${reqs.length + 1}`, number: `MR-000${reqs.length + 1}`, projectId: newReq[1], projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: me.id, name: me.name }, note: body.note ?? '', neededBy: null, status: 'open', cancelReason: null, createdAt: new Date().toISOString(), overBoq: lines.some((l: { overBy: number }) => l.overBy > 0), lines };
      reqs.push(r);
      return ok(r, 201);
    }
    const oneReq = path.match(/^\/requisitions\/([^/]+)$/);
    if (oneReq) return ok(withProgress(reqs.find((r) => r.id === oneReq[1])));
    if (path.startsWith('/requisitions')) return ok(reqs.map(withProgress));
    const buyer = perms(me).includes('purchase.manage');
    if (path === '/vendors') {
      if (!buyer) return fail(403, 'FORBIDDEN', 'You do not have access to this');
      if (method === 'GET') return ok(vendors);
      if (vendors.some((v) => v.name.toLowerCase() === body.name.toLowerCase())) return fail(409, 'DUPLICATE_VENDOR', 'A vendor with this name already exists', [{ field: 'name', message: 'Already added' }]);
      const v = { id: `v${vendors.length + 1}`, name: body.name, phone: body.phone ?? null, gstin: null, address: '', isActive: true };
      vendors.push(v);
      return ok(v, 201);
    }
    if (path === '/lots/to-receive') {
      const mine = projects.filter((p) => perms(me).includes('project.manage') || (perms(me).includes('receiving.record') && p.memberIds.includes(me.id)));
      return ok(allLots().filter(({ p, l }) => !l.receivedAt && mine.some((x) => x.id === p.projectId)).map(({ p, l }) => ({ ...lotDto(p, l), projectId: p.projectId, projectName: 'Worli', projectCode: 'P-001' })));
    }
    const lotsM = path.match(/^\/projects\/([^/]+)\/lots(?:\/([^/]+))?(\/receive)?(?:\?.*)?$/);
    if (lotsM) {
      const rows = allLots().filter(({ p }) => p.projectId === lotsM[1]);
      if (!lotsM[2]) return ok(rows.map(({ p, l }) => lotDto(p, l)));
      const hit = rows.find(({ l }) => l.id === lotsM[2]);
      if (!hit) return fail(404, 'NOT_FOUND', 'Lot not found');
      if (lotsM[3]) {
        const proj = projects.find((x) => x.id === lotsM[1])!;
        if (!perms(me).includes('project.manage') && !(perms(me).includes('receiving.record') && proj.memberIds.includes(me.id))) return fail(403, 'FORBIDDEN', 'You do not have access to this');
        if (hit.l.receivedAt) return fail(409, 'LOT_ALREADY_RECEIVED', 'Already checked in');
        hit.l.lines.forEach((x: { id?: string; poLineId: string; qty: number; qtyReceived?: number; qtyDamaged?: number; remark?: string }) => {
          const g = body.lines.find((b: { lineId: string }) => b.lineId === (x.id ?? x.poLineId));
          x.qtyReceived = g.qtyReceived;
          x.qtyDamaged = g.qtyDamaged ?? 0;
          x.remark = g.remark ?? '';
          const pl = hit.p.lines.find((y: { id: string }) => y.id === x.poLineId);
          pl.dispatched -= x.qty - g.qtyReceived;
        });
        hit.l.receivedAt = new Date().toISOString();
        hit.l.receivedBy = { id: me.id, name: me.name };
        hit.l.receiptNotes = body.notes ?? '';
      }
      return ok(lotDto(hit.p, hit.l));
    }
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
    if (path === '/transfer-targets') return ok(projects.filter((x) => x.status !== 'closed').map((x) => ({ id: x.id, code: x.code, name: x.name })));
    const ttM = path.match(/^\/transfer-targets\/([^/]+)\/items$/);
    if (ttM) return ok(boq.filter((b) => b.projectId === ttM[1]).map((b) => ({ id: b.id, serialNo: b.serialNo, description: `Item ${b.serialNo}`, unit: 'Nos' })));
    if (path === '/vendors/names') return ok(vendors.map((v) => ({ id: v.id, name: v.name })));
    const matM = path.match(/^\/projects\/([^/]+)\/material$/);
    if (matM) return ok({ projectId: matM[1], projectName: 'Worli', summary: { itemsPending: 0, lotsInTransit: 0, lotsOverdue: 0, itemsOverBoq: 0 }, items: materialRows });
    const usageM = path.match(/^\/projects\/([^/]+)\/usage$/);
    if (usageM) {
      if (method === 'GET') return ok(usage);
      const u = { id: `u${usage.length + 1}`, ...body, createdBy: { id: me.id, name: me.name }, createdAt: new Date().toISOString(), lines: body.lines.map((l: { workOrderItemId: string; qty: number }) => {
        const r = materialRows.find((x) => x.workOrderItemId === l.workOrderItemId);
        r.atSite -= l.qty;
        r.installed += l.qty;
        return { ...l, serialNo: r.serialNo, description: r.description, unit: r.unit };
      }) };
      usage.unshift(u);
      return ok(u, 201);
    }
    const scM = path.match(/^\/projects\/([^/]+)\/stock-counts$/);
    if (scM) {
      if (method === 'GET') return ok(counts);
      const lines = body.lines.map((l: { workOrderItemId: string; countedQty: number; reason?: string }) => {
        const r = materialRows.find((x) => x.workOrderItemId === l.workOrderItemId);
        const variance = l.countedQty - r.atSite;
        return { ...l, serialNo: r.serialNo, description: r.description, unit: r.unit, expectedQty: r.atSite, variance, varianceValue: variance * (r.rate ?? 0), reason: l.reason ?? '' };
      });
      const c = { id: `sc${counts.length + 1}`, number: `SC-000${counts.length + 1}`, countedAt: new Date().toISOString(), note: body.note ?? '', createdBy: { id: me.id, name: me.name }, createdAt: new Date().toISOString(), lines, varianceValue: lines.reduce((a: number, l: { varianceValue: number }) => a + l.varianceValue, 0) };
      counts.unshift(c);
      return ok(c, 201);
    }
    const rtP = path.match(/^\/projects\/([^/]+)\/returns$/);
    const decider = perms(me).includes('project.manage') || perms(me).includes('purchase.manage');
    if (rtP) {
      if (method === 'GET') return ok(returns.filter((r) => r.projectId === rtP[1]));
      const r = {
        id: `rt${returns.length + 1}`, number: `RTN-000${returns.length + 1}`, projectId: rtP[1], projectName: 'Worli', status: 'pending', ...body,
        vendor: body.vendorId ? { id: body.vendorId, name: vendors.find((v) => v.id === body.vendorId)?.name } : null,
        toProject: body.toProjectId ? { id: body.toProjectId, name: projects.find((x) => x.id === body.toProjectId)?.name, code: 'P-002' } : null,
        challanNo: body.challanNo ?? null, decidedBy: null, decidedAt: null, decisionNote: '', createdBy: { id: me.id, name: me.name }, createdAt: new Date().toISOString(),
        lines: body.lines.map((l: { workOrderItemId: string; qty: number }, i: number) => {
          const row = materialRows.find((x) => x.workOrderItemId === l.workOrderItemId);
          row.atSite -= l.qty;
          return { id: `rl${i}`, ...l, serialNo: row.serialNo, description: row.description, unit: row.unit, toWorkOrderItemId: null, toSerialNo: null };
        }),
      };
      returns.unshift(r);
      return ok(r, 201);
    }
    if (path.startsWith('/returns')) {
      const one = path.match(/^\/returns\/([^/?]+)(\/decision)?$/);
      if (!one) return ok(returns.filter((r) => !path.includes('status=pending') || r.status === 'pending'));
      const r = returns.find((x) => x.id === one[1]);
      if (!r) return fail(404, 'NOT_FOUND', 'Return not found');
      if (one[2]) {
        if (!decider) return fail(403, 'FORBIDDEN', 'You do not have access to this');
        Object.assign(r, { status: body.decision, decidedBy: { id: me.id, name: me.name }, decidedAt: new Date().toISOString(), decisionNote: body.note ?? '' });
      }
      return ok(r);
    }
    const lpM = path.match(/^\/projects\/([^/]+)\/local-purchases$/);
    if (lpM) {
      if (method === 'GET') return ok(localPurchases.filter((x) => x.projectId === lpM[1]).slice().reverse());
      const item = boq.find((b) => b.id === body.workOrderItemId)!;
      const already = localPurchases.filter((x) => x.workOrderItemId === item.id).reduce((s2, x) => s2 + x.qty, 0);
      const lp = { id: `lp${localPurchases.length + 1}`, number: `LP-000${localPurchases.length + 1}`, projectId: lpM[1], ...body, serialNo: item.serialNo, description: `Item ${item.serialNo}`, unit: 'Nos', amount: body.qty * body.rate, billNo: body.billNo ?? null, overBy: Math.min(body.qty, Math.max(0, already + body.qty - item.quantity)), createdBy: { id: me.id, name: me.name }, createdAt: new Date().toISOString() };
      localPurchases.push(lp);
      return ok(lp, 201);
    }
    if (path.startsWith('/purchase-orders')) {
      if (!buyer) return fail(403, 'FORBIDDEN', 'You do not have access to this');
      if (path === '/purchase-orders' && method === 'POST') {
        const r = reqs.find((x) => x.id === body.requisitionId);
        const v = vendors.find((x) => x.id === body.vendorId);
        const over = body.lines.filter((l: { requisitionLineId: string; qty: number }) => {
          const rl = r.lines.find((x: { id: string }) => x.id === l.requisitionLineId);
          return l.qty > rl.qtyRequested - orderedFor(rl.id);
        });
        if (over.length) return fail(422, 'OVER_REQUESTED', 'More than what is left to order', over.map((l: { requisitionLineId: string }) => ({ field: l.requisitionLineId, message: 'Too much' })));
        const p = {
          id: `po${pos.length + 1}`, number: `PO-000${pos.length + 1}`, status: 'issued', projectId: r.projectId, projectName: r.projectName, projectCode: r.projectCode,
          vendor: { id: v.id, name: v.name, phone: v.phone }, expectedDate: null, notes: body.notes ?? '', cancelReason: null, createdAt: new Date().toISOString(), lots: [],
          lines: body.lines.map((l: { requisitionLineId: string; qty: number; rate?: number }, i: number) => {
            const rl = r.lines.find((x: { id: string }) => x.id === l.requisitionLineId);
            const item = boq.find((b) => b.id === rl.workOrderItemId)!;
            return { id: `pl${pos.length + 1}-${i}`, requisitionId: r.id, requisitionLineId: rl.id, serialNo: rl.serialNo, description: rl.description, unit: rl.unit, qty: l.qty, rate: l.rate ?? item.rate, dispatched: 0 };
          }),
        };
        pos.push(p);
        return ok(poDto(p), 201);
      }
      if (path.startsWith('/purchase-orders?') || path === '/purchase-orders') return ok(pos.map(poDto));
      const pm2 = path.match(/^\/purchase-orders\/([^/]+)(\/dispatches|\/cancel)?$/);
      const p = pm2 ? pos.find((x) => x.id === pm2[1]) : undefined;
      if (!p) return fail(404, 'NOT_FOUND', 'Purchase order not found');
      if (pm2?.[2] === '/dispatches') {
        const bad = body.lines.filter((l: { poLineId: string; qty: number }) => {
          const pl = p.lines.find((x: { id: string }) => x.id === l.poLineId);
          return l.qty > pl.qty - pl.dispatched;
        });
        if (bad.length) return fail(422, 'OVER_PO', 'More than what is pending on this PO', bad.map((l: { poLineId: string }) => ({ field: l.poLineId, message: 'Too much' })));
        const lot = {
          id: `lot${++lotCounter}`, receivedAt: null, lotNo: lotCounter, challanNo: body.challanNo, dispatchDate: body.dispatchDate, vehicleNo: body.vehicleNo ?? null,
          lines: body.lines.map((l: { poLineId: string; qty: number }) => {
            const pl = p.lines.find((x: { id: string }) => x.id === l.poLineId);
            pl.dispatched += l.qty;
            return { id: `${pl.id}-${lotCounter}`, poLineId: pl.id, serialNo: pl.serialNo, description: pl.description, unit: pl.unit, qty: l.qty };
          }),
        };
        p.lots.push(lot);
        return ok({ id: lot.id, lotNo: lot.lotNo, purchaseOrder: poDto(p) }, 201);
      }
      if (pm2?.[2] === '/cancel') {
        if (p.lots.length) return fail(409, 'PO_HAS_DISPATCHES', 'Goods were already dispatched on this PO');
        p.status = 'cancelled';
        p.cancelReason = body.reason;
        return ok(poDto(p));
      }
      return ok(poDto(p));
    }
    if (path.startsWith('/projects')) {
      const manage = perms(me).includes('project.manage');
      const editBoq = manage || perms(me).includes('boq.edit');
      const visible = (p: MockProject) => manage || perms(me).includes('purchase.manage') || p.memberIds.includes(me.id);
      const withTotals = (p: MockProject) => {
        const items = boq.filter((i) => i.projectId === p.id);
        return { ...p, boqItemCount: items.length, boqValue: items.reduce((s, i) => s + i.amount, 0) };
      };
      if (path === '/projects' && method === 'GET') return ok(projects.filter(visible).map(withTotals));
      if (path === '/projects' && method === 'POST') {
        if (!manage) return fail(403, 'FORBIDDEN', 'You do not have access to this');
        const p: MockProject = {
          id: `p${projects.length + 1}`, code: `P-${String(projects.length + 1).padStart(3, '0')}`, status: 'active',
          siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [], ...body,
        };
        projects.push(p);
        return ok(withTotals(p), 201);
      }
      const pm = path.match(/^\/projects\/([^/]+)(\/boq)?$/);
      const proj = pm ? projects.find((p) => p.id === pm[1]) : undefined;
      if (!proj || !visible(proj)) return fail(404, 'NOT_FOUND', 'Project not found');
      if (pm?.[2] && method === 'GET') return ok(boq.filter((i) => i.projectId === proj.id));
      if (pm?.[2] && method === 'POST') {
        if (!editBoq) return fail(403, 'FORBIDDEN', 'You do not have access to this');
        if (boq.some((i) => i.projectId === proj.id && i.serialNo === body.serialNo)) {
          return fail(409, 'DUPLICATE_SERIAL', `S.No ${body.serialNo} already exists in this BOQ`, [{ field: 'serialNo', message: 'Already used' }]);
        }
        const item = { id: `i${boq.length + 1}`, projectId: proj.id, rate: 0, ...body, amount: body.quantity * (body.rate ?? 0) };
        boq.push(item);
        return ok(item, 201);
      }
      if (method === 'GET') return ok(withTotals(proj));
    }
    if (path.startsWith('/users')) {
      if (!perms(me).includes('team.manage')) return fail(403, 'FORBIDDEN', 'You do not have access to this');
      if (path === '/users/meta') return ok({ roles: ['purchaser', 'engineer', 'supervisor', 'accounts', 'staff'], roleDefaults: DEFAULTS, permissions: CATALOG });
      if (path === '/users' && method === 'GET') return ok([...users.values()].map(dto));
      if (path === '/users' && method === 'POST') {
        if (users.has(body.email.toLowerCase())) return fail(409, 'EMAIL_TAKEN', 'An account with this email already exists', [{ field: 'email', message: 'Already registered' }]);
        return ok(dto(addUser({ ...body, mustChangePassword: true })), 201);
      }
      const m = path.match(/^\/users\/([^/]+)(\/reset-password)?$/);
      const target = m ? byId(m[1]) : undefined;
      if (!target) return fail(404, 'NOT_FOUND', 'User not found');
      if (m?.[2]) {
        target.password = body.password;
        target.mustChangePassword = true;
        return ok(dto(target));
      }
      if (method === 'GET') return ok(dto(target));
      if (method === 'PATCH') {
        if (body.role) {
          target.role = body.role;
          if (!body.permissions) target.permissions = DEFAULTS[body.role];
        }
        if (body.permissions) target.permissions = body.permissions;
        if (body.isActive !== undefined) target.isActive = body.isActive;
        return ok(dto(target));
      }
    }
    return fail(404, 'NOT_FOUND', 'not found');
  };

  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return { fetchMock, net, users, addUser, byEmail: (e: string) => users.get(e.toLowerCase()), projects, boq, reqs, vendors, pos, localPurchases, materialRows, returns, usage, counts, overview, attendance, payroll, service, sales };
}
