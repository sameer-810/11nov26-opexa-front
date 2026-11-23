import { Linking } from 'react-native';
import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';
import { ok } from './helpers/mockApiShared';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

type Init = { method?: string; body?: string; headers?: Record<string, string> };
type Reply = ReturnType<typeof ok> | null;

// Adds the 5A-5C routes on top of the shared fake backend.
function extend(api: ReturnType<typeof installMockApi>, routes: (path: string, method: string, body: Record<string, unknown>) => Reply) {
  const base = api.fetchMock.getMockImplementation();
  api.fetchMock.mockImplementation(async (url: string, init: Init) => {
    const hit = routes(url.replace(/^.*\/api\/v1/, '').split('?')[0], init?.method ?? 'GET', init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : {});
    return hit ?? (base ? base(url, init) : ok(null));
  });
}

async function signIn(email: string, pw: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), pw);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

test('Q29 - PM marks the project complete, fills the checklist and an install date per unit', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
  api.handover.current = {
    status: 'draft', handoverDate: '2026-11-19', returnReason: null, notes: '', files: [],
    equipment: [{ id: 'e1', workOrderItemId: 'w1', name: 'Split AC', serialNo: 'SN1', warrantyMonths: 12, pmEveryMonths: 0, verified: false, assetId: null, installedOn: null }],
    checklist: [{ key: 'training', label: 'Training done', required: false, status: 'pending', note: '', documentId: null }, { key: 'client_signoff', label: 'Client sign-off', required: true, status: 'pending', note: '', documentId: null }],
  };
  let completion = 'not_requested';
  const saved: Record<string, unknown>[] = [];
  extend(api, (path, method, body) => {
    if (path === '/projects/p1/completion') {
      if (method === 'POST') completion = 'approved';
      return ok({ status: completion, note: '', requestedAt: null, completedAt: completion === 'approved' ? '2026-11-20T00:00:00Z' : null, approvalRequestId: null });
    }
    if (path === '/projects/p1/handover' && method === 'PUT') { saved.push(body); return ok(api.handover.current); }
    return null;
  });
  await signIn('owner@airtech.in', 'Owner12345');
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
  await fireEvent.press(await screen.findByTestId('project-handover'));
  expect(await screen.findByTestId('ho-completion')).toHaveTextContent('Not marked complete');
  await fireEvent.press(screen.getByTestId('ho-complete'));
  await waitFor(() => expect(screen.getByTestId('ho-completion')).toHaveTextContent('Project complete'));

  // Required items cannot be marked N/A.
  expect(screen.queryByTestId('ho-ck-client_signoff-na')).toBeNull();
  await fireEvent.press(screen.getByTestId('ho-ck-training-na'));
  await fireEvent.press(screen.getByTestId('ho-ck-client_signoff-done'));
  await fireEvent.changeText(screen.getByTestId('ho-inst-SN1'), '2026-11-02');
  await fireEvent.press(screen.getByTestId('ho-save'));
  await waitFor(() => expect(saved).toHaveLength(1));
  expect(saved[0]).toMatchObject({ equipment: [{ serialNo: 'SN1', installedOn: '2026-11-02' }], checklist: [{ key: 'training', status: 'na' }, { key: 'client_signoff', status: 'done' }] });
});

test('5C - AMC coverage badge, service invoice once, report print and feedback on close', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'ravi@airtech.in', password: 'Ravi123456', role: 'engineer', name: 'Ravi' });
  const t = {
    id: 'aaaaaaaaaaaaaaaaaaaaaaaa', number: 'SR-0001', kind: 'complaint', title: 'ODU tripping', description: '', priority: 'normal', project: { id: 'p1', code: 'P-001', name: 'Worli Tower' },
    asset: { id: 'as1', projectId: 'p1', projectName: null, name: 'VRF ODU', brand: '', model: '', serialNo: 'V1', location: '', installedOn: '2023-01-10', warrantyMonths: 12, warrantyEnd: '2024-01-10', underWarranty: false, pmEveryMonths: 0, nextPmDate: null },
    contactName: '', contactPhone: '', source: 'app', status: 'resolved', underWarranty: false, charge: 1500, assignedTo: null, coverage: 'amc', amcId: 'amc1', partsIncluded: false, labourFree: true, noCharge: false,
    serviceInvoiceId: null as string | null, feedback: '', signOffName: '', visits: [], createdAt: new Date().toISOString(), resolvedAt: null, closedAt: null, clientRating: null,
  };
  api.service.tickets.push(t);
  const calls: { path: string; body: Record<string, unknown> }[] = [];
  extend(api, (path, method, body) => {
    if (path === `/service/tickets/${t.id}/invoice` && method === 'POST') { calls.push({ path, body }); t.serviceInvoiceId = 'inv1'; return ok({ invoiceId: 'inv1' }, 201); }
    if (path === `/service/tickets/${t.id}/report-link`) return ok({ url: `/print/service-reports/${t.id}?exp=1&sig=x` });
    if (path === `/service/tickets/${t.id}/close`) { calls.push({ path, body }); Object.assign(t, { status: 'closed', ...body }); return ok(t); }
    return null;
  });
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await signIn('ravi@airtech.in', 'Ravi123456');
  await fireEvent.press(screen.getByTestId('tile-service'));
  expect(await screen.findByTestId('svc-cover-SR-0001')).toHaveTextContent('AMC');
  await fireEvent.press(screen.getByTestId('svc-row-SR-0001'));
  expect(await screen.findByTestId('tk-warranty')).toHaveTextContent('AMC - labour free, parts chargeable');
  await fireEvent.press(screen.getByTestId('tk-invoice'));
  await screen.findByTestId('tk-open-invoice');
  expect(screen.queryByTestId('tk-invoice')).toBeNull();
  await fireEvent.press(screen.getByTestId('tk-print'));
  await waitFor(() => expect(open).toHaveBeenCalledWith(expect.stringContaining('/print/service-reports/')));
  await fireEvent.changeText(screen.getByTestId('tk-feedback-input'), 'Quick visit');
  await fireEvent.changeText(screen.getByTestId('tk-signoff'), 'Mr Shah');
  await fireEvent.press(screen.getByTestId('tk-close'));
  await waitFor(() => expect(calls.map((c) => c.path.split('/').pop())).toEqual(['invoice', 'close']));
  expect(calls[1].body).toMatchObject({ feedback: 'Quick visit', signOffName: 'Mr Shah' });
  expect(await screen.findByTestId('tk-feedback')).toHaveTextContent('Feedback: Quick visit');
  open.mockRestore();
});

test('Q28 - Service Head and HR in the role picker; HR sees the team read-only', async () => {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'hr@airtech.in', password: 'Hr12345678', role: 'hr', name: 'Hema', permissions: ['attendance.viewAll', 'payroll.manage', 'attendance.self', 'team.view'] });
  await signIn('owner@airtech.in', 'Owner12345');
  await fireEvent.press(await screen.findByTestId('tile-team'));
  await fireEvent.press(await screen.findByTestId('add-member'));
  expect(await screen.findByTestId('member-role-service_head')).toHaveTextContent(/Service Head/);
  expect(screen.getByTestId('member-role-hr')).toHaveTextContent(/HR/);
});

test('Q28 - HR opens the team list without add or edit', async () => {
  const api = installMockApi();
  api.addUser({ email: 'hr@airtech.in', password: 'Hr12345678', role: 'hr', name: 'Hema', permissions: ['attendance.viewAll', 'payroll.manage', 'attendance.self', 'team.view'] });
  extend(api, (path) => (path === '/users' ? ok([...api.users.values()].map((u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role, permissions: u.permissions, isActive: true, mustChangePassword: false }))) : null));
  await signIn('hr@airtech.in', 'Hr12345678');
  await fireEvent.press(await screen.findByTestId('tile-team'));
  expect(await screen.findByTestId('member-hr@airtech.in')).toHaveTextContent(/HR/);
  expect(screen.queryByTestId('add-member')).toBeNull();
});
