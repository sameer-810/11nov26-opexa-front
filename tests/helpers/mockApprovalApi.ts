// Approval settings, delegations, completed approvals, departments and the e-mail preference for the fake
// backend, layered on installMockApi (kept separate so mockApi.ts does not grow). Unknown requests go to the base mock.
import type { installMockApi } from './mockApi';
import type { Delegation, PendingApproval, Person, Workflow } from '../../src/modules/approval/api/approvalApi';
import type { Department } from '../../src/modules/department/departmentApi';

type BaseApi = ReturnType<typeof installMockApi>;
type Init = { method?: string; body?: unknown; headers?: Record<string, string> };

const defaultChain = (): Workflow[] => [
  { id: 'wlow', name: 'Default chain: below ₹1,00,000', transactionType: 'requisition', projectId: null, departmentId: null, department: null, minAmount: 0, maxAmount: null, isActive: true, isDefault: true, defaultKey: 'low', version: 1, levels: [{ sequence: 1, approverRole: 'purchaser' }, { sequence: 2, approverRole: 'project_manager' }] },
  { id: 'whigh', name: 'Default chain: ₹1,00,000 and above', transactionType: 'requisition', projectId: null, departmentId: null, department: null, minAmount: 100000, maxAmount: null, isActive: true, isDefault: true, defaultKey: 'high', version: 1, levels: [{ sequence: 1, approverRole: 'purchaser' }, { sequence: 2, approverRole: 'project_manager' }, { sequence: 3, approverRole: 'director' }] },
];

export function installApprovalMock(api: BaseApi) {
  const workflows: Workflow[] = defaultChain();
  const people: Person[] = [];
  const delegations: Delegation[] = [];
  const completed: PendingApproval[] = [];
  const departments: Department[] = [];
  const sent: { path: string; method: string; body: unknown }[] = [];
  const ok = (data: unknown, status = 200) => ({ ok: true, status, json: async () => ({ success: true, data }) });
  const base = api.fetchMock.getMockImplementation()!;
  let n = 0;

  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const p = url.replace(/^.*\/api\/v1/, '').split('?')[0];
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
    if (method !== 'GET') sent.push({ path: p, method, body });
    if (p === '/approvals/workflows' && method === 'GET') return ok(workflows);
    if (p === '/approvals/workflows' && method === 'POST') { const w = { ...body, id: `w${++n}`, isDefault: false, defaultKey: null, version: 1, department: null }; workflows.push(w); return ok(w, 201); }
    if (p === '/approvals/workflows/restore-default') { workflows.splice(0, workflows.length, ...defaultChain(), ...workflows.filter((w) => !w.isDefault)); return ok(workflows); }
    const wf = p.match(/^\/approvals\/workflows\/([^/]+)$/);
    if (wf) { const w = workflows.find((x) => x.id === wf[1])!; Object.assign(w, body, { version: w.version + 1 }); return ok(w); }
    if (p === '/approvals/people') return ok(people);
    if (p === '/approvals/completed') return ok(completed);
    if (p === '/approvals/delegations' && method === 'GET') return ok({ given: delegations.filter((d) => !('ended' in d)), received: [] });
    if (p === '/approvals/delegations') {
      const to = people.find((x) => x.id === body.delegateId)!;
      const d: Delegation = { id: `d${++n}`, transactionType: 'all', startsAt: body.startsAt, endsAt: body.endsAt, active: true, delegator: { id: 'me', name: 'Me' }, delegate: { id: to.id, name: to.name } };
      delegations.push(d);
      return ok(d, 201);
    }
    const end = p.match(/^\/approvals\/delegations\/([^/]+)\/end$/);
    if (end) { const d = delegations.find((x) => x.id === end[1])!; Object.assign(d, { ended: true, active: false }); return ok(d); }
    if (p === '/departments' && method === 'GET') return ok(departments);
    if (p === '/departments') { const d = { id: `dep${++n}`, name: body.name, code: body.name.slice(0, 3).toUpperCase(), isActive: true }; departments.push(d); return ok(d, 201); }
    const dep = p.match(/^\/departments\/([^/]+)$/);
    if (dep) { const d = departments.find((x) => x.id === dep[1])!; Object.assign(d, body); return ok(d); }
    return base(url, init as Parameters<typeof base>[1]);
  });
  return { workflows, people, delegations, completed, departments, sent };
}
