import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidProfileUrl, normalizeProfileUrl, profilePlatform, safeProfileHref } from './socialProfile.js';

test('normalizeProfileUrl adds https:// and treats blank as no link', () => {
  assert.equal(normalizeProfileUrl('facebook.com/ana.cruz'), 'https://facebook.com/ana.cruz');
  assert.equal(normalizeProfileUrl('  https://www.facebook.com/ana  '), 'https://www.facebook.com/ana');
  assert.equal(normalizeProfileUrl('HTTP://fb.com/ana'), 'HTTP://fb.com/ana');
  assert.equal(normalizeProfileUrl('   '), null);
  assert.equal(normalizeProfileUrl(null), null);
});

test('isValidProfileUrl accepts web addresses and rejects names or junk', () => {
  assert.equal(isValidProfileUrl('facebook.com/ana.cruz'), true);
  assert.equal(isValidProfileUrl('https://www.facebook.com/profile.php?id=1000123'), true);
  assert.equal(isValidProfileUrl('instagram.com/ana'), true);
  assert.equal(isValidProfileUrl(''), true);
  assert.equal(isValidProfileUrl('Ana Cruz'), false);
  assert.equal(isValidProfileUrl('ana'), false);
  assert.equal(isValidProfileUrl('facebook.com/ana cruz'), false);
  assert.equal(isValidProfileUrl('ftp://facebook.com/ana'), false);
  assert.equal(isValidProfileUrl(`facebook.com/${'a'.repeat(600)}`), false);
});

test('profilePlatform names common sites, including mobile and short hosts', () => {
  assert.equal(profilePlatform('https://www.facebook.com/ana'), 'Facebook');
  assert.equal(profilePlatform('m.facebook.com/ana'), 'Facebook');
  assert.equal(profilePlatform('fb.com/ana'), 'Facebook');
  assert.equal(profilePlatform('instagram.com/ana'), 'Instagram');
  assert.equal(profilePlatform('twitter.com/ana'), 'X');
  assert.equal(profilePlatform('ana.example.com'), 'ana.example.com');
  assert.equal(profilePlatform('not a url'), 'Profile');
});

test('safeProfileHref only lets web links through', () => {
  assert.equal(safeProfileHref('https://facebook.com/ana'), 'https://facebook.com/ana');
  assert.equal(safeProfileHref('javascript:alert(1)'), null);
  assert.equal(safeProfileHref('data:text/html,hi'), null);
  assert.equal(safeProfileHref('facebook.com/ana'), null);
  assert.equal(safeProfileHref(null), null);
});
