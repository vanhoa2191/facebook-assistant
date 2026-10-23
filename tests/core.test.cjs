'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../src/core.js');

test('default state is valid and each call returns independent arrays', () => {
  const first = Core.createDefaultState();
  const second = Core.createDefaultState();
  assert.equal(Core.isValidState(first), true);
  first.groups.push({ id: 'g1', name: 'Example', url: 'https://www.facebook.com/groups/example', selected: false });
  assert.equal(second.groups.length, 0);
});

test('HTML escaping encodes markup and attribute delimiters', () => {
  assert.equal(Core.escapeHtml('<script x="y">a & b</script>'), '&lt;script x=&quot;y&quot;&gt;a &amp; b&lt;/script&gt;');
  assert.equal(Core.escapeHtml("'"), '&#39;');
});

test('group URL validation accepts HTTPS Facebook group URLs', () => {
  assert.equal(Core.isSafeFacebookGroupUrl('https://www.facebook.com/groups/example'), true);
  assert.equal(Core.isSafeFacebookGroupUrl('https://facebook.com/groups/123456/'), true);
});

test('group URL validation rejects non-Facebook, non-HTTPS, and non-group URLs', () => {
  assert.equal(Core.isSafeFacebookGroupUrl('http://facebook.com/groups/example'), false);
  assert.equal(Core.isSafeFacebookGroupUrl('https://evil.example/groups/example'), false);
  assert.equal(Core.isSafeFacebookGroupUrl('https://facebook.com/profile.php?id=1'), false);
  assert.equal(Core.isSafeFacebookGroupUrl('javascript:alert(1)'), false);
  assert.equal(Core.isSafeFacebookGroupUrl('https://facebook.com.evil.example/groups/example'), false);
});

test('state validation rejects malformed and oversized imported data', () => {
  assert.equal(Core.isValidState(null), false);
  assert.equal(Core.isValidState([]), false);
  const invalid = Core.createDefaultState();
  invalid.groups = [{ id: 'g1', name: 'bad', url: 'https://example.com', selected: false }];
  assert.equal(Core.isValidState(invalid), false);
  const oversized = Core.createDefaultState();
  oversized.logs = new Array(10001).fill({ at: 'now', message: 'x' });
  assert.equal(Core.isValidState(oversized), false);
});

test('state validation accepts well-formed group, profile, task, log, and draft records', () => {
  const state = Core.createDefaultState();
  state.groups.push({ id: 'g1', name: 'Nhóm mẫu', url: 'https://www.facebook.com/groups/mau', selected: true });
  state.profiles.push({ id: 'p1', name: 'Mặc định', provider: 'demo' });
  state.tasks.push({ id: 't1', name: 'Nhắc xem bản nháp', time: '2026-10-24T09:00' });
  state.logs.push({ at: '24/10/2026', message: 'Đã lưu nháp' });
  state.drafts.push({ id: 'd1', text: 'Nội dung', url: '', createdAt: '2026-10-24T01:00:00.000Z' });
  assert.equal(Core.isValidState(state), true);
});

test('CSV output quotes commas, quotes, and embedded newlines', () => {
  assert.equal(Core.toCsv([['a', 'b'], ['x,y', 'say "hi"']]), '"a","b"\r\n"x,y","say ""hi"""');
  assert.equal(Core.toCsv([['line1\nline2']]), '"line1\nline2"');
});
