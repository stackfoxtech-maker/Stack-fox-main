import { describe, it, expect } from 'vitest';
import {
  ADMIN_ROLES,
  INTERNAL_ROLES,
  CLIENT_ROLES,
  SALES_ROLES,
  dashboardForRole,
} from '../../../../packages/core/src/roles/index';
const getDashboardPath = (role) =>
  dashboardForRole(role) === 'sales' ? '/app/team/sales' : '/app/' + dashboardForRole(role);
const GUARDS = {
  '/app/admin': ADMIN_ROLES,
  '/app/team': [...INTERNAL_ROLES, 'TEAM'],
  '/app/team/sales': SALES_ROLES,
  '/app/client': [...CLIENT_ROLES, ...ADMIN_ROLES],
};
describe('dashboard routing', () => {
  it.each([...INTERNAL_ROLES, ...CLIENT_ROLES])(
    '%s lands on a dashboard whose guard admits it',
    (role) => {
      const path = getDashboardPath(role);
      const guard = GUARDS[path];
      expect(guard, `no guard defined for ${path}`).toBeDefined();
      // This is the redirect loop: ProtectedRoute sends a rejected user to
      // getDashboardPath(), so if that path also rejects them it bounces forever.
      expect(
        guard.includes(role) || guard.includes(role.toLowerCase()),
        `${role} is sent to ${path}, which its own guard rejects — infinite redirect`,
      ).toBe(true);
    },
  );

  it('ADMIN reaches the admin panel', () => {
    expect(getDashboardPath('ADMIN')).toBe('/app/admin');
    expect(GUARDS['/app/admin']).toContain('ADMIN');
  });

  // SUPER_ADMIN was retired on 2026-09-22 — it granted exactly what ADMIN
  // granted, so the name implied a tier the code never enforced. It must not
  // come back silently: an unrecognised role falls through to the client
  // portal, so a stray SUPER_ADMIN row would be quietly demoted rather than
  // rejected, which is the kind of failure nobody notices.
  it('SUPER_ADMIN is retired and no longer an admin role', () => {
    expect(GUARDS['/app/admin']).not.toContain('SUPER_ADMIN');
    expect(INTERNAL_ROLES).not.toContain('SUPER_ADMIN');
    expect(getDashboardPath('SUPER_ADMIN')).toBe('/app/client');
  });

  it('SALES reaches the sales dashboard built for it', () => {
    expect(getDashboardPath('SALES')).toBe('/app/team/sales');
    expect(GUARDS['/app/team/sales']).toContain('SALES');
  });

  it('FINANCE reaches a staff dashboard rather than the client portal', () => {
    expect(getDashboardPath('FINANCE')).toBe('/app/team');
  });

  it('no internal role is treated as a client', () => {
    for (const role of INTERNAL_ROLES) {
      expect(getDashboardPath(role), `${role} was routed to the client portal`).not.toBe(
        '/app/client',
      );
    }
  });

  it('every client role is routed to the client portal', () => {
    for (const role of CLIENT_ROLES) {
      expect(getDashboardPath(role)).toBe('/app/client');
    }
  });

  it('an unknown role degrades to the least-privileged dashboard', () => {
    expect(getDashboardPath('SOMETHING_NEW')).toBe('/app/client');
    expect(getDashboardPath(undefined)).toBe('/app/client');
  });
});
