import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi Kumar' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: 'Worli Sea Face, Mumbai', clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] });
  api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 8, rate: 52000, amount: 416000 });
  api.inventory.materials.push({ id: 'm1', code: 'MAT-00001', name: 'PVC drain pipe', unit: 'Rmt', category: null, minStock: 0, isActive: true, verification: 'verified' });
  return { api, eng };
}

async function signIn(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
}

async function openProject() {
  await signIn('ravi@airtech.in', 'Ravi12345');
  await fireEvent.press(await screen.findByTestId('tile-projects'));
  await fireEvent.press(await screen.findByTestId('project-P-001'));
}

describe('1B - Material request form', () => {
  test('address from the site, BOQ line with spec, master material, new material for verification, date and remarks', async () => {
    const { api } = setup();
    await openProject();
    await fireEvent.press(await screen.findByTestId('project-new-requisition'));
    await waitFor(() => expect(screen.getByTestId('req-address').props.value).toBe('Worli Sea Face, Mumbai'));
    // One project only: the project is still shown first (1B.1 field order).
    expect(await screen.findByTestId('req-project-fixed')).toHaveTextContent(/1\. Project: P-001 · Worli/);

    await fireEvent.changeText(screen.getByTestId('req-qty-1'), '2');
    await fireEvent.changeText(screen.getByTestId('req-spec-1'), 'Inverter, 5 star');
    await fireEvent.press(screen.getByTestId('extra-open'));
    await fireEvent.press(await screen.findByTestId('extra-mat-MAT-00001'));
    await fireEvent.changeText(screen.getByTestId('extra-qty-0'), '30');
    await fireEvent.press(screen.getByTestId('extra-new-open'));
    await fireEvent.changeText(screen.getByTestId('extra-new-name'), 'Anchor fastener M10');
    await fireEvent.changeText(screen.getByTestId('extra-new-unit'), 'Nos');
    await fireEvent.changeText(screen.getByTestId('extra-new-specs'), 'SS 304');
    await fireEvent.press(screen.getByTestId('extra-new-save'));
    expect(await screen.findByTestId('extra-line-1')).toHaveTextContent(/New – verify/);
    await fireEvent.changeText(screen.getByTestId('extra-qty-1'), '100');

    await fireEvent.changeText(screen.getByTestId('req-needed-by'), '15-12-2026');
    await fireEvent.press(screen.getByTestId('req-submit'));
    expect(screen.getByTestId('req-error')).toHaveTextContent(/YYYY-MM-DD/);
    await fireEvent.changeText(screen.getByTestId('req-needed-by'), '2026-12-15');
    await fireEvent.changeText(screen.getByTestId('req-note'), 'For floor 3');
    await fireEvent.press(screen.getByTestId('req-submit'));

    expect(await screen.findByTestId('req-created')).toBeTruthy();
    expect(api.inventory.materials[1]).toMatchObject({ name: 'Anchor fastener M10', verification: 'pending', specifications: 'SS 304' });
    expect(api.reqs[0]).toMatchObject({ deliveryAddress: 'Worli Sea Face, Mumbai', neededBy: '2026-12-15', remarks: 'For floor 3' });
    expect(api.reqs[0].lines).toHaveLength(3);
    expect(api.reqs[0].lines[0]).toMatchObject({ workOrderItemId: 'i1', qtyRequested: 2, specification: 'Inverter, 5 star' });
    expect(api.reqs[0].lines[1]).toMatchObject({ workOrderItemId: null, materialId: 'm1', qtyRequested: 30 });
    expect(screen.getByTestId('req-new-MAT-00002')).toBeTruthy();
    expect(screen.getByTestId('req-info')).toHaveTextContent(/Deliver to: Worli Sea Face, Mumbai/);
    expect(await screen.findByTestId('req-timeline')).toHaveTextContent(/Request raised/);
  });

  test('a sent-back request shows why, can be changed and is resubmitted', async () => {
    const { api, eng } = setup();
    const at = new Date().toISOString();
    api.reqs.push({
      id: 'r1', number: 'MR-0001', projectId: 'p1', projectName: 'Worli', projectCode: 'P-001', raisedBy: { id: eng.id, name: 'Ravi Kumar' }, note: 'First try', remarks: 'First try', deliveryAddress: 'Gate 2', neededBy: null,
      status: 'sent_back', cancelReason: null, createdAt: at, overBoq: false, attachments: [],
      lines: [{ id: 'l1', workOrderItemId: 'i1', serialNo: '1', description: 'Item 1', unit: 'Nos', boqQty: 8, previouslyRequested: 0, qtyRequested: 5, overBy: 0, overrideReason: null, specification: '', status: null, rejectReason: null }],
      timeline: [
        { type: 'created', at, by: { id: eng.id, name: 'Ravi Kumar', role: 'engineer' }, comment: '' },
        { type: 'sent_back', at, by: { id: 'u9', name: 'Meera', role: 'project_manager' }, comment: 'Reduce to 4 for now', level: 1, levelRole: 'project_manager' },
      ],
    });
    await openProject();
    await fireEvent.press(await screen.findByTestId('project-requisitions'));
    await fireEvent.press(await screen.findByTestId('req-MR-0001'));
    expect(await screen.findByTestId('req-timeline')).toHaveTextContent(/Sent back for changes.*level 1 \(Project Manager\).*Reduce to 4 for now/);

    await fireEvent.press(screen.getByTestId('req-resubmit'));
    await waitFor(() => expect(screen.getByTestId('req-qty-1').props.value).toBe('5'));
    expect(screen.getByTestId('req-address').props.value).toBe('Gate 2');
    await fireEvent.changeText(screen.getByTestId('req-qty-1'), '4');
    await fireEvent.press(screen.getByTestId('req-submit'));
    expect(await screen.findByTestId('req-created')).toBeTruthy();
    expect(api.reqs[0]).toMatchObject({ status: 'pending_approval', deliveryAddress: 'Gate 2' });
    expect(api.reqs[0].lines[0]).toMatchObject({ qtyRequested: 4 });
    expect(await screen.findByTestId('req-timeline')).toHaveTextContent(/Changed and resubmitted/);
  });

  test('approver rejects an item only with a reason, and reduces another', async () => {
    const { api } = setup();
    api.addUser({ email: 'hod@airtech.in', password: 'Hod12345', role: 'hod', name: 'Meera', permissions: ['approval.act', 'attendance.self'] });
    api.approvals.push({
      id: 'a1', transactionNumber: 'MR-0007', transactionType: 'requisition', amount: 0, status: 'pending', currentSequence: 1, submittedAt: '', history: [],
      details: {
        kind: 'requisition', requisitionId: 'r7', priority: 'normal', note: 'Urgent', deliveryAddress: 'Gate 2', neededBy: null, attachments: [],
        lines: [
          { id: 'x1', serialNo: '1', description: 'Split AC', unit: 'Nos', qtyRequested: 4, qtyApproved: 4, overBy: 0, inBoq: true, newMaterial: false, status: null, rejectReason: null },
          { id: 'x2', serialNo: 'MAT-00002', description: 'Anchor fastener', unit: 'Nos', qtyRequested: 100, qtyApproved: 100, overBy: 0, inBoq: false, newMaterial: true, specification: 'SS 304', status: null, rejectReason: null },
        ],
      },
    });
    await signIn('hod@airtech.in', 'Hod12345');
    await fireEvent.press(await screen.findByTestId('tile-approvals'));
    await fireEvent.press(await screen.findByTestId('review-a1'));
    expect(await screen.findByTestId('approve-new-MAT-00002')).toBeTruthy();
    expect(screen.getByTestId('approve-line-MAT-00002')).toHaveTextContent(/Spec: SS 304/);

    await fireEvent.press(screen.getByTestId('reject-line-1'));
    await fireEvent.press(screen.getByTestId('approve-a1'));
    expect(screen.getByTestId('approval-problem')).toHaveTextContent(/reason for rejecting S\.No 1/);
    expect(api.approvals[0].acted).toBeUndefined();

    await fireEvent.changeText(screen.getByTestId('reject-reason-1'), 'Client deferred the ACs');
    await fireEvent.changeText(screen.getByTestId('approve-qty-MAT-00002'), '60');
    await fireEvent.press(screen.getByTestId('approve-a1'));
    await waitFor(() => expect(api.approvals[0].acted).toBeTruthy());
    expect(api.approvals[0].acted).toMatchObject({
      action: 'approve',
      approvedLines: [{ lineId: 'x1', reject: true, rejectReason: 'Client deferred the ACs' }, { lineId: 'x2', qtyApproved: 60 }],
    });
  });
});
