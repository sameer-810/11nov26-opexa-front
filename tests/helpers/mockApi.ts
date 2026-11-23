// A fake backend for frontend tests: answers /auth/* and /users/* like the real API does.
import { ALL, DEFAULTS, ok, fail, type Account, type MockProject } from './mockApiShared';
import { fieldRoutes } from './mockApiFieldRoutes';
import { adminRoutes } from './mockApiAdminRoutes';

export function installMockApi() {
  const users = new Map<string, Account>(); // email -> account
  const refreshTokens = new Map<string, string>(); // token -> email
  const accessTokens = new Map<string, string>(); // token -> email
  let n = 0;
  const projects: MockProject[] = [];
  const boq: { id: string; projectId: string; serialNo: string; quantity: number; rate: number; amount: number; tendered?: boolean; additionalStatus?: string | null }[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const reqs: any[] = [];
  // Approval requests are seeded by tests; POST /action stores what was sent in `acted`.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvals: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vendors: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pos: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfqs: any[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const inventory: { materials: any[]; stock: any[]; tools: any[] } = { materials: [], stock: [], tools: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const finance: { financials: any; estimate: any; saved: any[] } = { financials: null, estimate: null, saved: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subcontract: { subs: any[]; agreements: any[]; wos: any[]; progress: any[]; certs: any[] } = { subs: [], agreements: [], wos: [], progress: [], certs: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const billing: { plan: any; position: any; invoices: any[] } = { plan: null, position: null, invoices: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const commitments: { retention: any; bgs: any; posts: any[] } = { retention: null, bgs: null, posts: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handover: { current: any; decisions: any[]; amcs: any[]; renewals: { id: string; body: any }[] } = { current: null, decisions: [], amcs: [], renewals: [] };
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
        return { workOrderItemId: i.id, serialNo: i.serialNo, description: `Item ${i.serialNo}`, unit: 'Nos', boqQty: i.quantity, requested, balance: i.quantity - requested, tendered: i.tendered !== false, additionalStatus: i.additionalStatus ?? null };
      }));
    }
    const newReq = path.match(/^\/projects\/([^/]+)\/requisitions$/);
    const editReq = path.match(/^\/requisitions\/([^/]+)$/);
    if ((newReq && method === 'POST') || (editReq && method === 'PUT')) {
      const lines = body.lines.map((l: { workOrderItemId?: string; qty: number; reason?: string; billable?: boolean; materialId?: string; specification?: string; extraWorkItemId?: string }) => {
        if (!l.workOrderItemId) {
          const m = inventory.materials.find((x) => x.id === l.materialId);
          return { id: `l${Math.random()}`, workOrderItemId: null, materialId: m.id, billable: false, serialNo: m.code, description: m.name, unit: m.unit, boqQty: 0, previouslyRequested: 0, qtyRequested: l.qty, overBy: 0, overrideReason: null, specification: l.specification ?? '', newMaterial: m.verification === 'pending' };
        }
        const item = boq.find((i) => i.id === l.workOrderItemId)!;
        if (l.billable === false) return { id: `l${Math.random()}`, workOrderItemId: item.id, materialId: l.materialId, billable: false, extraWorkItemId: l.extraWorkItemId ?? null, serialNo: item.serialNo, description: 'package', unit: 'Rmt', boqQty: 0, previouslyRequested: 0, qtyRequested: l.qty, overBy: 0, overrideReason: null };
        const prev = reqs.filter((r) => r.status === 'open').flatMap((r) => r.lines).filter((x) => x.workOrderItemId === item.id).reduce((s, x) => s + x.qtyRequested, 0);
        const overBy = Math.min(l.qty, Math.max(0, prev + l.qty - item.quantity));
        return { id: `l${Math.random()}`, workOrderItemId: item.id, serialNo: item.serialNo, description: `Item ${item.serialNo}`, unit: 'Nos', boqQty: item.quantity, previouslyRequested: prev, qtyRequested: l.qty, overBy, overrideReason: overBy ? l.reason ?? null : null, specification: l.specification ?? '' };
      });
      const missing = lines.filter((l: { overBy: number; overrideReason: string | null }) => l.overBy > 0 && !l.overrideReason);
      if (missing.length) {
        return fail(422, 'OVER_BOQ', 'Some items go beyond the work order (BOQ).', missing.map((l: { workOrderItemId: string; serialNo: string; boqQty: number; previouslyRequested: number; qtyRequested: number; overBy: number }) => ({ field: l.workOrderItemId, message: 'over', serialNo: l.serialNo, boqQty: l.boqQty, previouslyRequested: l.previouslyRequested, qtyRequested: l.qtyRequested, overBy: l.overBy })));
      }
      const header = { note: body.remarks ?? body.note ?? '', remarks: body.remarks ?? body.note ?? '', deliveryAddress: body.deliveryAddress ?? '', neededBy: body.neededBy ?? null, overBoq: lines.some((l: { overBy: number }) => l.overBy > 0), lines };
      if (editReq) {
        const r = reqs.find((x) => x.id === editReq[1]);
        if (r.status !== 'sent_back') return fail(409, 'NOT_SENT_BACK', 'Only a request sent back for changes can be edited and resubmitted');
        Object.assign(r, header, { status: 'pending_approval' });
        r.timeline.push({ type: 'resubmitted', at: new Date().toISOString(), by: { id: me.id, name: me.name, role: me.role }, comment: '' });
        return ok(withProgress(r));
      }
      const r = { id: `r${reqs.length + 1}`, number: `MR-000${reqs.length + 1}`, projectId: newReq![1], projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: me.id, name: me.name }, ...header, status: 'open', cancelReason: null, createdAt: new Date().toISOString(), attachments: [], timeline: [{ type: 'created', at: new Date().toISOString(), by: { id: me.id, name: me.name, role: me.role }, comment: '' }] };
      reqs.push(r);
      return ok(r, 201);
    }
    const reqTimeline = path.match(/^\/requisitions\/([^/]+)\/timeline$/);
    if (reqTimeline) return ok(reqs.find((r) => r.id === reqTimeline[1])?.timeline ?? []);
    const approvalOne = path.match(/^\/approvals\/([^/]+)(\/action)?$/);
    if (path === '/approvals/pending') return ok(approvals.map((a) => ({ id: a.id, transactionNumber: a.transactionNumber, transactionType: 'requisition', amount: 0, status: 'pending', currentSequence: 1, submittedAt: '' })));
    if (approvalOne && approvalOne[2] && method === 'POST') { const a = approvals.find((x) => x.id === approvalOne[1]); a.acted = body; return ok(a); }
    if (approvalOne) return ok(approvals.find((x) => x.id === approvalOne[1]));
    const oneReq = path.match(/^\/requisitions\/([^/]+)$/);
    if (oneReq) return ok(withProgress(reqs.find((r) => r.id === oneReq[1])));
    if (path.startsWith('/requisitions')) return ok(reqs.map(withProgress));
    const buyer = perms(me).includes('purchase.manage');
    if (path === '/vendors') {
      if (!buyer) return fail(403, 'FORBIDDEN', 'You do not have access to this');
      if (method === 'GET') return ok(vendors);
      if (vendors.some((v) => v.name.toLowerCase() === body.name.toLowerCase())) return fail(409, 'DUPLICATE_VENDOR', 'A vendor with this name already exists', [{ field: 'name', message: 'Already added' }]);
      const v = { id: `v${vendors.length + 1}`, code: `SUP-000${vendors.length + 1}`, name: body.name, phone: body.phone ?? null, email: body.email ?? null, gstin: null, address: '', materials: body.materials ?? [], category: body.category ?? null, bank: null, isActive: true };
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
    const field = fieldRoutes({ sales, service, payroll, attendance, projects, overview, users, perms }, path, method, body, init, me);
    if (field) return field;
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
    if (path.startsWith('/subcontract/')) {
      const sc = subcontract;
      if (path === '/subcontract/subcontractors') return ok(sc.subs);
      if (path === '/subcontract/agreements') return ok(sc.agreements);
      if (path === '/subcontract/work-orders') return ok(sc.wos);
      if (path.startsWith('/subcontract/progress') && method === 'POST') { const p = { id: `pg${sc.progress.length + 1}`, status: 'submitted', verifiedQty: null, approvedQty: null, location: '', remarks: '', certificateId: null, ...body }; sc.progress.push(p); return ok(p, 201); }
      if (path.startsWith('/subcontract/progress')) return ok(sc.progress.filter((p: { status: string }) => ['submitted', 'verified'].includes(p.status)));
      if (path === '/subcontract/certificates' && method === 'POST') { const c = { id: `pc${sc.certs.length + 1}`, number: `PC-000${sc.certs.length + 1}`, workOrderId: body.workOrderId, status: 'approved', lines: [{ description: 'S.No 1 Copper pipe', unit: 'Rmt', qty: 50, reportedQty: 60, rate: 120, amount: 6000 }], gross: 6000, retention: 300, advanceRecovery: 0, net: 5700, paid: 0, outstanding: 5700, createdAt: new Date().toISOString() }; sc.certs.push(c); return ok(c, 201); }
      if (path === '/subcontract/certificates') return ok(sc.certs);
      if (path === '/subcontract/summary') return ok({ rows: [], pendingReview: 0 });
      return fail(404, 'NOT_FOUND', 'not found');
    }
    const hoM = path.match(/^\/projects\/([^/]+)\/handover(\/decision|\/submit)?$/);
    if (hoM) {
      if (hoM[2] === '/decision') { handover.decisions.push(body); handover.current.status = 'accepted'; return ok(handover.current); }
      return ok(handover.current);
    }
    if (path === '/amc') return ok({ rows: handover.amcs });
    const amcRenew = path.match(/^\/amc\/([^/]+)\/renew$/);
    if (amcRenew) { handover.renewals.push({ id: amcRenew[1], body }); return ok({}, 201); }
    if (path.startsWith('/commitments/')) {
      if (path === '/commitments/retention') return ok(commitments.retention);
      if (path === '/commitments/bank-guarantees' && method === 'GET') return ok(commitments.bgs);
      commitments.posts.push({ path, body });
      return ok({}, 201);
    }
    const billM = path.match(/^\/projects\/([^/]+)\/(billing-plan|billing-position|milestone-invoices|measurement-sheets|boq)$/);
    if (billM && billM[2] !== 'boq') {
      if (billM[2] === 'billing-plan') return ok(billing.plan);
      if (billM[2] === 'billing-position') return ok(billing.position);
      if (billM[2] === 'measurement-sheets') return ok([]);
      billing.invoices.push(body);
      return ok({ id: 'inv-new' }, 201);
    }
    const finM = path.match(/^\/projects\/([^/]+)\/(financials|estimate|boq-regularisation|boq-revisions|change-requests)$/);
    if (finM) {
      if (finM[2] === 'financials') return ok(finance.financials);
      if (finM[2] === 'estimate') { if (method === 'PUT') finance.saved.push(body); return ok(finance.estimate); }
      if (finM[2] === 'boq-regularisation') return ok({ boqRevision: 0, summary: { excessLines: 0, excessValue: 0, additionalLines: 0, additionalValue: 0, unconfirmedAdditional: 0 }, rows: [] });
      return ok([]);
    }
    if (path.startsWith('/inventory/')) {
      if (path.startsWith('/inventory/materials')) {
        if (method === 'POST') { const m = { id: `m${inventory.materials.length + 1}`, code: `MAT-0000${inventory.materials.length + 1}`, isActive: true, minStock: 0, category: null, verification: perms(me).includes('purchase.manage') || perms(me).includes('store.manage') ? 'verified' : 'pending', ...body }; inventory.materials.push(m); return ok(m, 201); }
        return ok(inventory.materials);
      }
      if (path === '/inventory/warehouses') return ok([{ id: 'w1', code: 'CS', name: 'Central Store', address: '', isCentral: true, managerIds: [], isActive: true }]);
      if (path.startsWith('/inventory/stock')) return ok(inventory.stock);
      if (path === '/inventory/reports/valuation') return ok({ locations: [], total: inventory.stock.reduce((a: number, r: { value: number }) => a + r.value, 0) });
      if (path === '/inventory/reconciliation') return ok({ ok: true, checked: 1, mismatches: [], negatives: [] });
      if (path === '/inventory/tools' && method === 'POST') { const t = { id: `t${inventory.tools.length + 1}`, code: `TL-000${inventory.tools.length + 1}`, serialNo: '', category: '', condition: 'good', status: 'available', holder: null, ...body }; inventory.tools.push(t); return ok(t, 201); }
      if (path.startsWith('/inventory/tools') && method === 'GET') return ok(inventory.tools);
      const ti = path.match(/^\/inventory\/tools\/([^/]+)\/issue$/);
      if (ti) { const t = inventory.tools.find((x) => x.id === ti[1]); t.status = 'issued'; t.holder = { ...body.holder, projectId: null, issuedAt: new Date().toISOString(), expectedReturn: null, overdue: false }; return ok(t); }
      return fail(404, 'NOT_FOUND', 'not found');
    }
    if (path.startsWith('/procurement/')) {
      if (!buyer) return fail(403, 'FORBIDDEN', 'You do not have access to this');
      if (path === '/procurement/rfqs' && method === 'POST') {
        const r = reqs.find((x) => x.id === body.requisitionId);
        if (r.status !== 'open') return fail(422, 'REQUEST_NOT_APPROVED', 'Choose an approved material request');
        const rfq = {
          id: `rfq${rfqs.length + 1}`, number: `RFQ-000${rfqs.length + 1}`, status: body.publish ? 'sent' : 'draft', requisitionId: r.id, requisitionNumber: r.number, projectId: r.projectId,
          deadline: body.deadline, expectedDate: null, paymentTerms: body.paymentTerms ?? '', deliveryLocation: '', terms: body.terms ?? '', remarks: '', evaluationRemarks: '', deadlinePassed: false,
          suppliers: body.vendorIds.map((id: string) => ({ vendorId: id, vendorName: vendors.find((v) => v.id === id)?.name, email: null, status: 'pending', sentAt: body.publish ? new Date().toISOString() : null, emailStatus: 'no_email', linkActive: Boolean(body.publish), declineReason: null })),
          lines: (body.lines ?? []).map((l: { requisitionLineId: string; qty: number }) => { const rl = r.lines.find((x: { id: string }) => x.id === l.requisitionLineId); return { requisitionLineId: rl.id, serialNo: rl.serialNo, description: rl.description, specification: '', unit: rl.unit, qty: l.qty }; }),
          quotations: [], history: [{ action: 'created', detail: '', by: me.name, at: new Date().toISOString() }],
        };
        rfqs.push(rfq);
        const links = body.publish ? body.vendorIds.map((id: string) => ({ vendorId: id, vendorName: vendors.find((v) => v.id === id)?.name, email: null, phone: null, portalPath: `/public/rfq/token-${id}`, expiresAt: body.deadline })) : [];
        return ok({ ...rfq, links }, 201);
      }
      const rfqM = path.match(/^\/procurement\/rfqs\/([^/]+)$/);
      if (rfqM) return ok(rfqs.find((x) => x.id === rfqM[1]));
      const poM = path.match(/^\/procurement\/purchase-orders\/([^/]+)$/);
      if (poM) {
        const p = poDto(pos.find((x) => x.id === poM[1]));
        return ok({
          ...p, revision: 0, pendingRevisionId: null, receiptStatus: 'not-received', overdue: false, rfqNumber: null, requisitionNumbers: ['MR-0001'], paymentTerms: '', terms: '', deliveryAddress: '',
          freight: 0, otherCharges: 0, taxable: p.total, gst: 0, cgst: 0, sgst: 0, igst: 0, revisions: [], followUps: [], history: [],
          lines: p.lines.map((l: { qty: number; dispatched: number }) => ({ ...l, discount: 0, taxPercent: 0, cancelledQty: 0, delivery: { ordered: l.qty, sent: l.dispatched, inTransit: l.dispatched, accepted: 0, damaged: 0, short: 0, pending: l.qty } })),
        });
      }
      return fail(404, 'NOT_FOUND', 'not found');
    }
    const admin = adminRoutes({ projects, boq, users, perms, dto, addUser, byId }, path, method, body, me);
    if (admin) return admin;
    return fail(404, 'NOT_FOUND', 'not found');
  };

  (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  return { fetchMock, net, users, addUser, byEmail: (e: string) => users.get(e.toLowerCase()), projects, boq, reqs, approvals, vendors, pos, rfqs, inventory, finance, subcontract, billing, commitments, handover, localPurchases, materialRows, returns, usage, counts, overview, attendance, payroll, service, sales };
}
