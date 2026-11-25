import { render, screen, fireEvent, waitFor } from '@testing-library/react-native';
import { ProjectAssignments } from '../src/modules/team/components/ProjectAssignments';
import { teamApi } from '../src/modules/team/api/teamApi';

afterEach(() => jest.restoreAllMocks());

const options = {
  projects: [
    { id: 'pA', code: 'P-001', name: 'Project A', status: 'active', sites: [{ id: 'sA', code: 'S-01', name: 'Main site' }, { id: 'sB', code: 'S-02', name: 'Site B' }] },
    { id: 'pB', code: 'P-002', name: 'Project B', status: 'active', sites: [{ id: 'sC', code: 'S-01', name: 'Main site' }] },
  ],
  subcontractors: [],
};

test('Phase 2 access - the admin assigns a person to Project A, Site B only, with finance access', async () => {
  jest.spyOn(teamApi, 'assignmentOptions').mockResolvedValue(options);
  jest.spyOn(teamApi, 'assignments').mockResolvedValue({ userId: 'u1', seesAllProjects: false, assignments: [] });
  const save = jest.spyOn(teamApi, 'saveAssignments').mockResolvedValue({ userId: 'u1', seesAllProjects: false, assignments: [{ projectId: 'pA', projectCode: 'P-001', projectName: 'Project A', siteIds: ['sB'], sites: [{ id: 'sB', code: 'S-02', name: 'Site B' }], roleOverride: null, financeAccess: true }] });
  await render(<ProjectAssignments userId="u1" canEdit />);
  await fireEvent(await screen.findByTestId('assign-P-001'), 'valueChange', true);
  await fireEvent.press(await screen.findByTestId('assign-P-001-S-02'));
  await fireEvent(screen.getByTestId('assign-P-001-finance'), 'valueChange', true);
  expect(screen.queryByTestId('assign-P-002-S-01')).toBeNull(); // Project B not ticked: no site choices
  await fireEvent.press(screen.getByTestId('save-assignments'));
  await waitFor(() => expect(save).toHaveBeenCalledWith('u1', [{ projectId: 'pA', siteIds: ['sB'], financeAccess: true }]));
  expect(await screen.findByTestId('assign-message')).toHaveTextContent(/applies at once/);
});

test('Phase 2 access - read-only viewers see the assignments without switches that work', async () => {
  jest.spyOn(teamApi, 'assignmentOptions').mockResolvedValue(options);
  jest.spyOn(teamApi, 'assignments').mockResolvedValue({ userId: 'u1', seesAllProjects: true, assignments: [] });
  await render(<ProjectAssignments userId="u1" canEdit={false} />);
  expect(await screen.findByTestId('assign-sees-all')).toBeTruthy();
  expect(screen.getByTestId('assign-P-001').props.disabled).toBe(true);
  expect(screen.queryByTestId('save-assignments')).toBeNull();
});
