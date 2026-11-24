// Projects / BOQ and team (users) routes of the fake backend (split out of mockApi.ts).
import { ok, fail, DEFAULTS, CATALOG, type Account, type MockProject } from './mockApiShared';

/* eslint-disable @typescript-eslint/no-explicit-any */
export type AdminState = {
  projects: MockProject[];
  boq: { id: string; projectId: string; serialNo: string; quantity: number; rate: number; amount: number }[];
  users: Map<string, Account>;
  perms: (a: Account) => string[];
  dto: (a: Account) => unknown;
  addUser: (u: Partial<Account> & { email: string; password: string }) => Account;
  byId: (id: string) => Account | undefined;
};

export function adminRoutes(st: AdminState, path: string, method: string, body: any, me: Account) {
  const { projects, boq, users, perms, dto, addUser, byId } = st;
  if (path.startsWith('/projects')) {
    const manage = perms(me).includes('project.manage');
    const editBoq = manage || perms(me).includes('boq.edit');
    const visible = (p: MockProject) => manage || ['purchase.manage', 'invoice.create', 'invoice.edit'].some((x) => perms(me).includes(x)) || p.memberIds.includes(me.id);
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
  return null;
}
