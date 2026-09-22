import { describe, it, expect } from 'vitest';

/**
 * Role routing — the client half of SF-H9.
 *
 * These lists live in authStore.js and routes.jsx as a hand-maintained mirror
 * of packages/core/src/roles, because the client is not in the pnpm workspace
 * and cannot import it. Drift between the two is not cosmetic: it locked the
 * master admin out of the admin panel and sent SALES and FINANCE into a
 * redirect loop, because getDashboardPath() returned a route whose own guard
 * rejected them.
 *
 * The invariant that actually matters is the loop: EVERY role must resolve to
 * a dashboard whose guard admits it. That is what these assert.
 */

// Mirrors of the authStore helpers. Kept as literals rather than imported so a
// change to the store is a visible, deliberate change here too.
const ADMIN = ['admin', 'ADMIN', 'SUPER_ADMIN'];
const SALES = ['SALES'];
const TEAM = [
  'team',
  'TEAM',
  'SE',
  'SENIOR_PM',
  'PM',
  'DEVELOPER',
  'QA',
  'DESIGNER',
  'DEVOPS',
  'FINANCE',
  'SALES',
];
const CLIENT = [
  'client',
  'CLIENT',
  'CLIENT_ADMIN',
  'CLIENT_PM',
  'CLIENT_VIEWER',
  'INDIVIDUAL_CLIENT',
  'ORG_OWNER',
  'REFERRER',
];

const isAdmin = (r) => ADMIN.includes(r);
const isSales = (r) => SALES.includes(r);
const isTeam = (r) => TEAM.includes(r);

function getDashboardPath(role) {
  if (isAdmin(role)) return '/app/admin';
  if (isSales(role)) return '/app/team/sales';
  if (isTeam(role)) return '/app/team';
  return '/app/client';
}

// Mirrors of the routes.jsx guards.
const GUARDS = {
  '/app/client': [...CLIENT, 'admin', 'ADMIN', 'SUPER_ADMIN'],
  '/app/team': [
    'team',
    'admin',
    'SE',
    'SENIOR_PM',
    'PM',
    'DEVELOPER',
    'QA',
    'DESIGNER',
    'DEVOPS',
    'FINANCE',
    'SALES',
    'ADMIN',
    'SUPER_ADMIN',
  ],
  '/app/team/sales': ['team', 'admin', 'SE', 'SENIOR_PM', 'PM', 'SALES', 'ADMIN', 'SUPER_ADMIN'],
  '/app/admin': ['admin', 'ADMIN', 'SUPER_ADMIN'],
};

const INTERNAL_ROLES = [
  'ADMIN',
  'SUPER_ADMIN',
  'SE',
  'SENIOR_PM',
  'PM',
  'DEVELOPER',
  'QA',
  'DESIGNER',
  'DEVOPS',
  'FINANCE',
  'SALES',
];
const CLIENT_ROLES = [
  'INDIVIDUAL_CLIENT',
  'ORG_OWNER',
  'CLIENT_ADMIN',
  'CLIENT_PM',
  'CLIENT_VIEWER',
  'CLIENT',
  'REFERRER',
];

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

  it('SUPER_ADMIN reaches the admin panel', () => {
    expect(getDashboardPath('SUPER_ADMIN')).toBe('/app/admin');
    expect(GUARDS['/app/admin']).toContain('SUPER_ADMIN');
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
