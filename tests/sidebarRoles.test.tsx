import { NAV_ITEMS } from '../src/navigation/navItems';
import type { Role, User } from '../src/modules/auth/types';

// Same role -> permission map as the server (opexa-backend/src/config/permissions.js) for the roles checked here.
const PERMS: Partial<Record<Role, string[]>> = {
  engineer: ['requisition.create', 'receiving.record', 'attendance.self', 'service.manage'],
  supervisor: ['receiving.record', 'attendance.self'],
  store_incharge: ['store.manage', 'receiving.record', 'attendance.self'],
  hr: ['attendance.viewAll', 'payroll.manage', 'attendance.self', 'team.view'],
  contractor: [],
};
const menu = (role: Role) => {
  const u = { id: 'u', name: 'U', email: 'u@x.in', phone: null, role, organizationId: 'o', permissions: PERMS[role] ?? [], isActive: true, mustChangePassword: false } as User;
  return NAV_ITEMS.filter((i) => i.show(u)).map((i) => i.label);
};

test('sidebar shows each role only what it can use', () => {
  expect(menu('engineer')).toEqual(expect.arrayContaining(['Projects', 'BOQ', 'Sites', 'Material requests', 'Service & AMC', 'My expenses']));
  expect(menu('engineer')).not.toEqual(expect.arrayContaining(['Store']));
  expect(menu('supervisor')).toEqual(expect.arrayContaining(['BOQ', 'Sites', 'Material requests']));
  expect(menu('supervisor')).not.toContain('Service & AMC');
  expect(menu('store_incharge')).toEqual(expect.arrayContaining(['Store', 'Material requests', 'BOQ']));
  expect(menu('store_incharge')).not.toContain('Service & AMC');
  expect(menu('hr')).toEqual(['Dashboard', 'Projects', 'My expenses', 'Team']);
  expect(menu('contractor')).toEqual(['Dashboard', 'Projects']);
});
