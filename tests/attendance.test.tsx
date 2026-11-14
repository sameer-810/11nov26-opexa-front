import { screen, fireEvent } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { installMockApi } from './helpers/mockApi';
import { renderApp } from './helpers/renderApp';

jest.mock('expo-location', () => ({
  Accuracy: { High: 4, Highest: 6 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(),
}));
const gps = (lat: number, mocked = false) =>
  (Location.getCurrentPositionAsync as jest.Mock).mockResolvedValue({ coords: { latitude: lat, longitude: 72.8172, accuracy: 10 }, mocked });

async function techSignIn() {
  const api = installMockApi();
  api.addUser({ email: 'owner@airtech.in', password: 'Owner12345' });
  const tech = api.addUser({ email: 'raju@airtech.in', password: 'Raju123456', role: 'staff', name: 'Raju' });
  api.projects.push({ id: 'p1', code: 'P-001', name: 'Worli', clientName: 'Lodha', status: 'active', siteAddress: null, clientPoNumber: null, poDate: null, location: { lat: 19.0176, lng: 72.8172 }, geofenceRadiusM: 200, memberIds: [tech.id] });
  await renderApp({ showLanding: false });
  await fireEvent.changeText(await screen.findByTestId('signin-email'), 'raju@airtech.in');
  await fireEvent.changeText(screen.getByTestId('signin-password'), 'Raju123456');
  await fireEvent.press(screen.getByTestId('signin-submit'));
  await fireEvent.press(await screen.findByTestId('tile-attendance'));
  await screen.findByTestId('att-check-in');
  return api;
}

describe('Phase 10 - Attendance (technician)', () => {
  test('check in at site with GPS + selfie, timer shows, then check out', async () => {
    const api = await techSignIn();
    gps(19.0177);
    await fireEvent.press(screen.getByTestId('att-check-in'));
    expect(await screen.findByTestId('att-message')).toHaveTextContent(/Checked in at 09:05 at Worli/);
    expect(api.attendance.punches[0]).toMatchObject({ path: '/attendance/check-in', selfie: true, fields: { place: 'project', projectId: 'p1', lat: '19.0177', mocked: 'false' } });
    expect(screen.getByTestId('att-timer')).toHaveTextContent(/2h 05m/);
    await fireEvent.press(screen.getByTestId('att-check-out'));
    expect(await screen.findByTestId('att-message')).toHaveTextContent(/Checked out at 17:20. Worked 8h 15m/);
    expect(api.attendance.punches[1]).toMatchObject({ path: '/attendance/check-out', selfie: false });
  });

  test('too far: the server message is shown; fake GPS is stopped on the phone', async () => {
    const api = await techSignIn();
    gps(19.03);
    await fireEvent.press(screen.getByTestId('att-check-in'));
    expect(await screen.findByTestId('att-error')).toHaveTextContent(/1400 m from Worli/);
    gps(19.0177, true);
    await fireEvent.press(screen.getByTestId('att-check-in'));
    expect(await screen.findByTestId('att-error')).toHaveTextContent(/fake-location app/);
    expect(api.attendance.punches).toHaveLength(1);
  });
});
