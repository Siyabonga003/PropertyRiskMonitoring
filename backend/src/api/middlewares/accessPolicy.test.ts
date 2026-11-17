import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canControlDevice, canManageProperty, canResolveIncident } from './accessPolicy';

test('property management requires both the owner role and the stored owner relationship', () => {
  assert.equal(canManageProperty('PROPERTY_OWNER', true), true);
  assert.equal(canManageProperty('PROPERTY_OWNER', false), false);
  assert.equal(canManageProperty('AUTHORIZED_DELEGATE', true), false);
  assert.equal(canManageProperty('ADMIN', true), false);
  assert.equal(canManageProperty('MANAGER', true), false);
  assert.equal(canManageProperty('VIEWER', true), false);
});

test('device commands and incident resolution allow system admins or actual property owners only', () => {
  for (const role of ['ADMIN', 'PROPERTY_OWNER', 'AUTHORIZED_DELEGATE', 'MANAGER', 'VIEWER'] as const) {
    const isOwner = role === 'PROPERTY_OWNER';
    assert.equal(canControlDevice(role, isOwner), role === 'ADMIN' || isOwner);
    assert.equal(canResolveIncident(role, isOwner), role === 'ADMIN' || isOwner);
  }
  assert.equal(canControlDevice('PROPERTY_OWNER', false), false);
  assert.equal(canResolveIncident('AUTHORIZED_DELEGATE', true), false);
});
