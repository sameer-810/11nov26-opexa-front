// Schedule milestones, the audit log and the attendance report for the fake backend, layered on installMockApi
// (kept separate so mockApi.ts does not grow). Requests it does not know go to the base mock.
import type { installMockApi } from './mockApi';
import type { Milestone, MilestoneStatus } from '../../src/modules/project/types';
import type { ActivityEntry } from '../../src/modules/activity/activityApi';
import type { AttendanceReport } from '../../src/modules/attendance/types';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };
type MilestoneBody = { name: string; plannedDate: string; actualDate?: string | null; started?: boolean; ownerId?: string | null; remarks?: string };

export const TODAY = '2026-11-23';

export function installActivityMock(api: BaseApi) {
  const milestones: Milestone[] = [];
  const activity: ActivityEntry[] = [];
  const activityQueries: string[] = [];
  const reportQueries: string[] = [];
  const managerOf: Record<string, string> = {};
  let report: AttendanceReport | null = null;
  let n = 0;
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const base = api.fetchMock.getMockImplementation()!;
  const statusOf = (m: Milestone): MilestoneStatus => (m.actualDate ? 'done' : m.plannedDate < TODAY ? 'delayed' : m.startedAt ? 'in_progress' : 'planned');
  const listFor = (projectId: string) => {
    const rows = milestones.filter((m) => m.projectId === projectId).sort((a, b) => a.plannedDate.localeCompare(b.plannedDate));
    rows.forEach((m) => { m.status = statusOf(m); });
    const done = rows.filter((m) => m.status === 'done').length;
    return { milestones: rows, progress: { total: rows.length, done, delayed: rows.filter((m) => m.status === 'delayed').length, progressPct: rows.length ? Math.round((done / rows.length) * 100) : 0 } };
  };
  const apply = (m: Milestone, b: Partial<MilestoneBody>) => {
    if (b.name !== undefined) m.name = b.name;
    if (b.plannedDate !== undefined) m.plannedDate = b.plannedDate;
    if (b.actualDate !== undefined) m.actualDate = b.actualDate;
    if (b.ownerId !== undefined) { m.ownerId = b.ownerId; m.ownerName = b.ownerId ? [...api.users.values()].find((u) => u.id === b.ownerId)?.name ?? null : null; }
    if (b.remarks !== undefined) m.remarks = b.remarks || null;
    if (b.started !== undefined) m.startedAt = b.started ? m.startedAt ?? `${TODAY}T05:00:00.000Z` : null;
  };

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const [p, query = ''] = url.replace(/^.*\/api\/v1/, '').split('?');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    const ms = p.match(/^\/projects\/([^/]+)\/milestones(?:\/([^/]+))?$/);
    if (ms) {
      if (method === 'POST') {
        const m: Milestone = { id: `m${++n}`, projectId: ms[1], name: '', plannedDate: '', actualDate: null, startedAt: null, status: 'planned', ownerId: null, ownerName: null, remarks: null };
        apply(m, body);
        milestones.push(m);
        return ok(listFor(ms[1]), 201);
      }
      const m = milestones.find((x) => x.id === ms[2]);
      if (m && method === 'PATCH') apply(m, body);
      if (m && method === 'DELETE') milestones.splice(milestones.indexOf(m), 1);
      return ok(listFor(ms[1]));
    }
    if (p === '/projects/assignable-users') return ok([...api.users.values()].map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, canManage: u.role === 'owner' || u.permissions.includes('project.manage') })));
    const proj = p.match(/^\/projects\/([^/]+)$/);
    if (proj && method === 'PATCH') {
      const target = api.projects.find((x) => x.id === proj[1]);
      if (target) Object.assign(target, Object.fromEntries(Object.entries(body).filter(([k]) => k !== 'projectManagerId')));
      if (body.projectManagerId !== undefined) managerOf[proj[1]] = body.projectManagerId;
    }
    if (proj && (method === 'GET' || method === 'PATCH')) {
      const res = (await base(url, { ...init, method: 'GET' } as never)) as { json: () => Promise<{ success: boolean; data: Record<string, unknown> }> };
      const json = await res.json();
      if (!json.success) return { ok: false, status: 404, json: async () => json };
      const pm = managerOf[proj[1]];
      const pmUser = pm ? [...api.users.values()].find((u) => u.id === pm) : undefined;
      return ok({ ...json.data, projectManagerId: pm ?? null, projectManager: pmUser ? { id: pmUser.id, name: pmUser.name, role: pmUser.role } : null, milestones: listFor(proj[1]).progress });
    }
    if (p === '/activity') {
      activityQueries.push(query);
      const q = new URLSearchParams(query);
      const rows = activity.filter((a) => (!q.get('projectId') || a.projectId === q.get('projectId')) && (!q.get('entityType') || a.entityType === q.get('entityType')) && (!q.get('userId') || a.user?.id === q.get('userId')));
      const page = Number(q.get('page') ?? 1);
      const limit = Number(q.get('limit') ?? 50);
      return ok({ items: rows.slice((page - 1) * limit, page * limit), total: rows.length, page, limit });
    }
    if (p === '/attendance/report') { reportQueries.push(query); return ok(report); }
    return base(url, init as never);
  });

  return {
    milestones, activity, activityQueries, reportQueries,
    setManager: (projectId: string, userId: string) => { managerOf[projectId] = userId; },
    setReport: (r: AttendanceReport) => { report = r; },
  };
}
