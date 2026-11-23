import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ProjectDocumentsScreen } from '../src/modules/documents/ProjectDocumentsScreen';
import type { Drive } from '../src/modules/documents/driveApi';

const user = { id: 'u1', name: 'Ravi', role: 'owner', permissions: [] as string[] };
jest.mock('../src/shared/store/useAuthStore', () => ({ useAuth: () => ({ user }) }));

const P = 'a'.repeat(24);
const REQ = 'b'.repeat(24);
const drive = (extra: Partial<Drive> = {}): Drive => ({
  canWrite: true, canManage: true,
  folders: [{ name: 'Drawings', count: 1, attachments: 0, access: 'all' }, { name: 'Material requests', count: 0, attachments: 1, access: 'all' }, { name: 'Meeting notes', count: 0, attachments: 0, access: 'all' }],
  documents: [{ id: 'd1', folder: 'Drawings', title: 'HVAC layout L3', kind: 'file', restricted: false, meeting: null, linkedTo: null, currentVersion: 1, versions: [{ version: 1, name: 'layout.pdf', note: '', at: '2026-11-20T10:00:00.000Z' }], comments: [], archived: null }],
  attachments: [{ id: 'f1', folder: 'Material requests', name: 'site-photo.pdf', label: 'MR-0001', size: 10, uploadedAt: '2026-11-21T10:00:00.000Z', source: { type: 'requisition', label: 'Material request', number: 'MR-0001', link: `/app/requisitions/${REQ}` } }],
  ...extra,
});

function mock(data: Drive) {
  const calls: { path: string; method: string; body: unknown; query: string }[] = [];
  (globalThis as unknown as { fetch: unknown }).fetch = jest.fn(async (url: string, init: { method?: string; body?: unknown } = {}) => {
    const [path, query = ''] = url.replace(/^.*\/api\/v1/, '').split('?');
    calls.push({ path, method: init.method ?? 'GET', body: typeof init.body === 'string' ? JSON.parse(init.body) : init.body, query });
    return { ok: true, status: 200, json: async () => ({ success: true, data: path.endsWith('/drive') ? data : data.documents[0] }) };
  });
  return calls;
}
const nav = () => ({ navigate: jest.fn() });

test('5D - drive lists folder files and transaction attachments; opening the source goes to the transaction', async () => {
  mock(drive());
  const navigation = nav();
  await render(<NavigationContainer><ProjectDocumentsScreen navigation={navigation as never} route={{ key: 'k', name: 'ProjectDocuments', params: { id: P } } as never} /></NavigationContainer>);
  expect(await screen.findByTestId('doc-HVAC layout L3')).toHaveTextContent(/v1 · layout\.pdf/);
  expect(screen.getByTestId('doc-folder-Material requests')).toHaveTextContent('Material requests (1)');
  expect(screen.getByTestId('att-site-photo.pdf')).toHaveTextContent(/Material request MR-0001/);
  await fireEvent.press(screen.getByTestId('att-open-site-photo.pdf'));
  expect(navigation.navigate).toHaveBeenCalledWith('RequisitionDetail', { id: REQ });
});

test('5D - archive needs a reason and posts it; archived view and meeting note form', async () => {
  const calls = mock(drive());
  await render(<NavigationContainer><ProjectDocumentsScreen navigation={nav() as never} route={{ key: 'k', name: 'ProjectDocuments', params: { id: P } } as never} /></NavigationContainer>);
  await fireEvent.press(await screen.findByTestId('doc-archive-HVAC layout L3'));
  await fireEvent.changeText(screen.getByTestId('doc-archive-reason-HVAC layout L3'), 'Superseded by R2');
  await fireEvent.press(screen.getByTestId('doc-archive-save-HVAC layout L3'));
  await waitFor(() => expect(calls.find((c) => c.method === 'POST')).toMatchObject({ path: `/projects/${P}/documents/d1/archive`, body: { reason: 'Superseded by R2' } }));

  await fireEvent.press(screen.getByTestId('doc-show-archived'));
  await waitFor(() => expect(calls.some((c) => c.path.endsWith('/drive') && c.query.includes('archived=true'))).toBe(true));
  await fireEvent.press(screen.getByTestId('doc-show-live'));
  await fireEvent.press(screen.getByTestId('doc-folder-Meeting notes'));
  await fireEvent.changeText(await screen.findByTestId('note-title'), 'Kick-off');
  await fireEvent.changeText(screen.getByTestId('note-attendees'), 'Ravi, Mr. Shah');
  await fireEvent.changeText(screen.getByTestId('note-text'), 'Shaft sizes agreed.');
  await fireEvent.press(screen.getByTestId('note-save'));
  await waitFor(() => expect(calls.find((c) => c.path.endsWith('/documents/notes'))).toMatchObject({ body: { title: 'Kick-off', attendees: ['Ravi', 'Mr. Shah'], text: 'Shaft sizes agreed.' } }));
});

test('5D - read-only viewer sees files but no upload, comment or archive', async () => {
  mock(drive({ canWrite: false, canManage: false }));
  await render(<NavigationContainer><ProjectDocumentsScreen navigation={nav() as never} route={{ key: 'k', name: 'ProjectDocuments', params: { id: P } } as never} /></NavigationContainer>);
  await screen.findByTestId('doc-HVAC layout L3');
  expect(screen.queryByTestId('doc-upload')).toBeNull();
  expect(screen.queryByTestId('doc-archive-HVAC layout L3')).toBeNull();
  expect(screen.queryByTestId('doc-comment-HVAC layout L3')).toBeNull();
});
