import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { installApprovalMock } from './helpers/mockApprovalApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({ Accuracy: { High: 4 }, requestForegroundPermissionsAsync: jest.fn(), getCurrentPositionAsync: jest.fn() }));

function setup() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  api.addUser({ email: 'pm@airtech.in', password: 'Pm1234567', role: 'project_manager', name: 'Kiran', permissions: ['project.manage', 'approval.act', 'attendance.self'] });
  const ap = installApprovalMock(api);
  ap.people.push({ id: 'u9', name: 'Meera', role: 'hod', canApprove: true }, { id: 'u8', name: 'Ravi', role: 'engineer', canApprove: false });
  return { api, ap };
}

async function openApprovals() {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'pm@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Pm1234567');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-approvals'));
  await screen.findByTestId('approvals-screen');
}

describe('1F.2 - Delegation and approval history', () => {
  test('delegate to an approver for dates, see it listed, end it', async () => {
    const { ap } = setup();
    await openApprovals();
    await fireEvent.press(screen.getByTestId('open-delegations'));
    await screen.findByTestId('delegations-screen');
    expect(screen.queryByTestId('delegate-to-u8')).toBeNull(); // cannot approve
    await fireEvent.press(screen.getByTestId('delegate-save'));
    expect(screen.getByTestId('delegation-error')).toHaveTextContent(/Choose who/);

    await fireEvent.press(screen.getByTestId('delegate-to-u9'));
    await fireEvent.changeText(screen.getByTestId('delegate-from'), '2026-12-01');
    await fireEvent.changeText(screen.getByTestId('delegate-to-date'), '2026-11-30');
    await fireEvent.press(screen.getByTestId('delegate-save'));
    expect(screen.getByTestId('delegation-error')).toHaveTextContent(/on or after/);
    await fireEvent.changeText(screen.getByTestId('delegate-to-date'), '2026-12-05');
    await fireEvent.press(screen.getByTestId('delegate-save'));

    await waitFor(() => expect(ap.delegations).toHaveLength(1));
    const body = ap.sent.find((s) => s.path === '/approvals/delegations')?.body as { delegateId: string; startsAt: string; endsAt: string };
    expect(body.delegateId).toBe('u9');
    expect(new Date(body.endsAt).getTime()).toBeGreaterThan(new Date(body.startsAt).getTime());
    expect(await screen.findByTestId(`delegation-${ap.delegations[0].id}`)).toHaveTextContent(/To Meera/);

    await fireEvent.press(screen.getByTestId(`end-delegation-${ap.delegations[0].id}`));
    expect(await screen.findByTestId('no-given')).toBeTruthy();
  });

  test('"Completed by me" shows each decision with role, person, delegation and comment', async () => {
    const { ap } = setup();
    ap.completed.push({
      id: 'a5', transactionNumber: 'MR-0005', transactionType: 'requisition', amount: 150000, status: 'approved', currentSequence: 3, submittedAt: '2026-11-20T10:00:00Z',
      history: [
        { action: 'submitted', sequence: 1, comment: '', createdAt: '2026-11-20T10:00:00Z', levelRole: null, actedBy: 'u2', actorName: 'Ravi', actorRole: 'engineer', onBehalfOfId: null, onBehalfOfName: null },
        { action: 'approved', sequence: 1, comment: 'OK', createdAt: '2026-11-20T11:00:00Z', levelRole: 'purchaser', actedBy: 'u3', actorName: 'Priya', actorRole: 'purchaser', onBehalfOfId: null, onBehalfOfName: null },
        { action: 'approved', sequence: 2, comment: 'For Kiran on leave', createdAt: '2026-11-20T12:00:00Z', levelRole: 'project_manager', actedBy: 'u9', actorName: 'Meera', actorRole: 'hod', onBehalfOfId: 'u1', onBehalfOfName: 'Kiran' },
        { action: 'skipped', sequence: 3, comment: 'Skipped: no active Director in the company', createdAt: '2026-11-20T12:00:01Z', levelRole: 'director', actedBy: null, actorName: null, actorRole: null, onBehalfOfId: null, onBehalfOfName: null },
      ],
    });
    await openApprovals();
    expect(await screen.findByText('No approvals waiting')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('approvals-tab-completed'));
    expect(await screen.findByTestId('history-a5-2')).toHaveTextContent(/Approved · level 2 \(Project Manager\)/);
    expect(screen.getByTestId('history-a5-2')).toHaveTextContent(/Meera, Head of Department · on behalf of Kiran/);
    expect(screen.getByTestId('history-a5-2')).toHaveTextContent(/For Kiran on leave/);
    expect(screen.getByTestId('history-a5-3')).toHaveTextContent(/Skipped · level 3 \(Director\)/);
    expect(screen.queryByTestId('review-a5')).toBeNull();
  });
});
