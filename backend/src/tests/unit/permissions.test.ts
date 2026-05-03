import { canDo, ROLE_PERMISSIONS } from '../../utils/permissions';
import type { AuthenticatedUser } from '../../types';

const facilityId = 'fac-001';

function makeUser(role: string, fid = facilityId): AuthenticatedUser {
  return {
    id: 'u1',
    email: 'test@example.com',
    healthSystemId: 'hs1',
    sessionId: 's1',
    roles: [{ facilityId: fid, role: role as any }],
  };
}

describe('canDo — SYSTEM_ADMIN', () => {
  const admin = makeUser('SYSTEM_ADMIN');

  it('can do every permission', () => {
    const perms: string[] = [
      'user:create', 'user:deactivate', 'facility:edit',
      'iap:approve', 'cost:approve', 'audit_log:read',
    ];
    perms.forEach((p) => expect(canDo(admin, p as any)).toBe(true));
  });

  it('bypasses facility scope', () => {
    expect(canDo(admin, 'facility:edit', { facilityId: 'other-facility' })).toBe(true);
  });
});

describe('canDo — RESPONDER', () => {
  const responder = makeUser('RESPONDER');

  it('can read incidents', () => {
    expect(canDo(responder, 'incident:read', { facilityId })).toBe(true);
  });

  it('cannot create incidents', () => {
    expect(canDo(responder, 'incident:create', { facilityId })).toBe(false);
  });

  it('cannot read audit logs', () => {
    expect(canDo(responder, 'audit_log:read', { facilityId })).toBe(false);
  });
});

describe('canDo — READ_ONLY_OBSERVER', () => {
  const observer = makeUser('READ_ONLY_OBSERVER');

  it('can read iap', () => {
    expect(canDo(observer, 'iap:read', { facilityId })).toBe(true);
  });

  it('cannot edit users', () => {
    expect(canDo(observer, 'user:edit', { facilityId })).toBe(false);
  });
});

describe('canDo — facility scoping', () => {
  const incCmd = makeUser('INCIDENT_COMMANDER', 'facility-A');

  it('passes when checking correct facility', () => {
    expect(canDo(incCmd, 'iap:create', { facilityId: 'facility-A' })).toBe(true);
  });

  it('fails when checking different facility', () => {
    expect(canDo(incCmd, 'iap:create', { facilityId: 'facility-B' })).toBe(false);
  });

  it('passes with no facility scope', () => {
    expect(canDo(incCmd, 'iap:create')).toBe(true);
  });
});

describe('ROLE_PERMISSIONS completeness', () => {
  it('every HicsRole has a permissions entry', () => {
    const roles = Object.keys(ROLE_PERMISSIONS);
    expect(roles.length).toBeGreaterThan(30);
  });
});
