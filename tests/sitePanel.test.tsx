import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { SitePanel } from '../src/modules/project/components/SitePanel';
import { projectApi } from '../src/modules/project/api/projectApi';
import type { SiteDetail } from '../src/modules/project/types';

afterEach(() => jest.restoreAllMocks());

const base: SiteDetail = {
  id: 's1', projectId: 'p1', code: 'S-01', name: 'Ground Floor', address: '', location: null, geofenceRadiusM: 200, isMain: true, isActive: true, engineerId: 'u1',
  engineer: { id: 'u1', name: 'Salman' },
  engineerHistory: [{ userId: 'u1', name: 'Salman', from: '2026-11-01T05:00:00.000Z', to: null, assignedBy: 'Pooja', note: '' }],
  team: [{ id: 'u1', name: 'Salman', role: 'engineer', allSites: false }, { id: 'pm', name: 'Pooja', role: 'project_manager', allSites: true }],
  activity: [{ at: '2026-11-01T05:00:00.000Z', action: 'engineer_changed', by: 'Pooja', remarks: '', changes: [{ field: 'engineer', old: 'none', new: 'Salman' }] }],
};

test('Phase A - the PM reassigns the site engineer with a note; history, team and activity are shown', async () => {
  jest.spyOn(projectApi, 'site').mockResolvedValue(base);
  jest.spyOn(projectApi, 'siteEngineers').mockResolvedValue([{ id: 'u1', name: 'Salman' }, { id: 'u2', name: 'Ahmed' }]);
  const save = jest.spyOn(projectApi, 'setSiteEngineer').mockResolvedValue({ ...base, engineer: { id: 'u2', name: 'Ahmed' } });
  const changed = jest.fn();
  await render(<SitePanel projectId="p1" siteId="s1" manage onChanged={changed} />);
  expect(await screen.findByTestId('site-engineer')).toHaveTextContent('Salman');
  expect(screen.getByTestId('site-history-0')).toHaveTextContent(/Salman .* now · by Pooja/);
  expect(screen.getByTestId('site-team-pm')).toHaveTextContent('Pooja · Project Manager · all sites');
  expect(screen.queryByTestId('site-engineer-save')).toBeNull(); // nothing changed yet
  await fireEvent.press(screen.getByTestId('site-engineer-pick-u2'));
  await fireEvent.changeText(screen.getByTestId('site-engineer-note'), 'Salman moved to Pune');
  await fireEvent.press(screen.getByTestId('site-engineer-save'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('p1', 's1', { userId: 'u2', note: 'Salman moved to Pune' }));
  expect(changed).toHaveBeenCalled();
});

test('Phase A - an engineer sees the site but cannot change its engineer', async () => {
  jest.spyOn(projectApi, 'site').mockResolvedValue(base);
  const list = jest.spyOn(projectApi, 'siteEngineers');
  await render(<SitePanel projectId="p1" siteId="s1" manage={false} onChanged={jest.fn()} />);
  expect(await screen.findByTestId('site-engineer')).toHaveTextContent('Salman');
  expect(screen.queryByTestId('site-engineer-pick-u1')).toBeNull();
  expect(list).not.toHaveBeenCalled();
});
