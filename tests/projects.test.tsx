import { screen, fireEvent } from '@testing-library/react-native';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(async () => ({ coords: { latitude: 19.0176, longitude: 72.8172 } })),
}));

async function signInAs(email: string, password: string) {
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), email);
  await fireEvent.changeText(screen.getByTestId('signin-password'), password);
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await screen.findByTestId('dashboard-screen');
}

describe('Phase 3 - Projects (owner)', () => {
  test('creates a project with the current location and adds a BOQ item', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    await signInAs('owner@airtech.in', 'Owner12345');
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('new-project'));
    await screen.findByTestId('project-form-screen');

    await fireEvent.press(screen.getByTestId('pf-submit'));
    expect(screen.getByTestId('pf-name-error')).toHaveTextContent('Enter the project name');

    await fireEvent.changeText(screen.getByTestId('pf-name'), 'Worli Tower HVAC');
    await fireEvent.changeText(screen.getByTestId('pf-client'), 'Lodha Developers');
    await fireEvent.press(screen.getByTestId('pf-locate'));
    expect(await screen.findByDisplayValue('19.017600')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('pf-submit'));

    expect(await screen.findByTestId('project-detail-screen')).toBeTruthy();
    expect(api.projects[0]).toMatchObject({ name: 'Worli Tower HVAC', location: { lat: 19.0176, lng: 72.8172 } });
    expect(screen.getByTestId('fact-location')).toHaveTextContent(/19\.01760/);

    await fireEvent.press(screen.getByTestId('add-boq-item'));
    await fireEvent.changeText(screen.getByTestId('bi-desc'), 'Split AC 2 TR');
    await fireEvent.changeText(screen.getByTestId('bi-unit'), 'Nos');
    await fireEvent.changeText(screen.getByTestId('bi-qty'), '8');
    await fireEvent.changeText(screen.getByTestId('bi-rate'), '52,000');
    await fireEvent.press(screen.getByTestId('bi-save'));
    expect(await screen.findByTestId('boq-row-1')).toBeTruthy();
    expect(screen.getByTestId('boq-total')).toHaveTextContent(/4,16,000/);
  });

  test('BOQ item form validates and shows a duplicate S.No error', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] });
    api.boq.push({ id: 'i1', projectId: 'p1', serialNo: '1', quantity: 8, rate: 0, amount: 0 });
    await signInAs('owner@airtech.in', 'Owner12345');
    await fireEvent.press(screen.getByTestId('tile-projects'));
    await fireEvent.press(await screen.findByTestId('project-P-001'));
    await fireEvent.press(await screen.findByTestId('add-boq-item'));
    await fireEvent.press(screen.getByTestId('bi-save'));
    expect(screen.getByTestId('bi-qty-error')).toHaveTextContent('More than 0');
    await fireEvent.changeText(screen.getByTestId('bi-serial'), '1');
    await fireEvent.changeText(screen.getByTestId('bi-desc'), 'Duplicate');
    await fireEvent.changeText(screen.getByTestId('bi-unit'), 'Nos');
    await fireEvent.changeText(screen.getByTestId('bi-qty'), '2');
    await fireEvent.press(screen.getByTestId('bi-save'));
    expect(await screen.findByTestId('boq-item-error')).toHaveTextContent(/already exists/);
  });
});

describe('Phase 3 - Projects (engineer)', () => {
  test('engineer sees only assigned projects, read-only', async () => {
    const api = installMockApi();
    api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
    const eng = api.addUser({ email: 'ravi@airtech.in', password: 'Ravi12345', role: 'engineer', name: 'Ravi' });
    api.projects.push(
      { id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [eng.id] },
      { id: 'p2', code: 'P-002', name: 'Bandra', clientName: 'Phoenix', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: null, geofenceRadiusM: 200, memberIds: [] },
    );
    await signInAs('ravi@airtech.in', 'Ravi12345');
    await fireEvent.press(screen.getByTestId('tile-projects'));
    expect(await screen.findByTestId('project-P-001')).toBeTruthy();
    expect(screen.queryByTestId('project-P-002')).toBeNull();
    expect(screen.queryByTestId('new-project')).toBeNull();
    await fireEvent.press(screen.getByTestId('project-P-001'));
    await screen.findByTestId('project-detail-screen');
    expect(screen.queryByTestId('add-boq-item')).toBeNull();
    expect(screen.queryByTestId('import-boq')).toBeNull();
    expect(screen.queryByTestId('edit-project')).toBeNull();
  });
});
