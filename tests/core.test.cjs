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


test('prompt placeholders are substituted without evaluating unknown names', () => {
  assert.equal(Core.fillPrompt('For {groupName}: {postText}; {unknown}', {
    groupName: 'Group A', postText: 'Hello'
  }), 'For Group A: Hello; {unknown}');
});

test('CSV protects spreadsheet formulas', () => {
  assert.equal(Core.toCsv([['=1+1', '+cmd', '-2', '@x']]), '"\'=1+1","\'+cmd","\'-2","\'@x"');
});


test('import validation rejects unknown providers and invalid reminder states', () => {
  const badProvider = Core.createDefaultState();
  badProvider.settings.provider = 'external-unknown';
  assert.equal(Core.isValidState(badProvider), false);

  const badProfile = Core.createDefaultState();
  badProfile.profiles.push({ id: 'p1', name: 'Bad profile', provider: 'unknown' });
  assert.equal(Core.isValidState(badProfile), false);

  const badTask = Core.createDefaultState();
  badTask.tasks.push({ id: 't1', name: 'Bad task', time: '2026-10-24T09:00', status: 'run-action' });
  assert.equal(Core.isValidState(badTask), false);
});


test('group-targeted drafts accept valid Facebook URLs and reject unsafe targets', () => {
  const state = Core.createDefaultState();
  state.drafts.push({
    id: 'd-group', text: 'Draft for group', url: '',
    createdAt: '2026-10-24T01:00:00.000Z', kind: 'share',
    targetGroupId: 'g1', targetGroupName: 'Nhóm mẫu',
    targetGroupUrl: 'https://www.facebook.com/groups/mau'
  });
  assert.equal(Core.isValidState(state), true);

  const unsafe = Core.createDefaultState();
  unsafe.drafts.push({
    id: 'd-bad', text: 'Bad target', url: '',
    createdAt: '2026-10-24T01:00:00.000Z', kind: 'share',
    targetGroupUrl: 'https://evil.example/groups/mau'
  });
  assert.equal(Core.isValidState(unsafe), false);
});


test('CSV parser handles quoted commas, quotes, CRLF, and embedded newlines', () => {
  const csv = '"name","url","selected"\r\n"Group, A","https://www.facebook.com/groups/a","true"\r\n"Group ""B""","https://www.facebook.com/groups/b","false"';
  assert.deepEqual(Core.parseCsv(csv), [
    ['name', 'url', 'selected'],
    ['Group, A', 'https://www.facebook.com/groups/a', 'true'],
    ['Group "B"', 'https://www.facebook.com/groups/b', 'false']
  ]);
  assert.deepEqual(Core.parseCsv('"name","notes"\n"A","line one\nline two"'), [
    ['name', 'notes'], ['A', 'line one\nline two']
  ]);
});

test('CSV parser rejects malformed quoting and oversized input', () => {
  assert.throws(() => Core.parseCsv('"not closed'), /chưa đóng/);
  assert.throws(() => Core.parseCsv('a"b,c'), /không đúng vị trí/);
  assert.throws(() => Core.parseCsv('x'.repeat(5000001)), /5 MB/);
});


test('legacy settings migrate prompt defaults and old reminders without losing groups', () => {
  const legacy = Core.createDefaultState();
  legacy.prompts = { share: 'Hello {groupName}' };
  legacy.tasks.push({ id: 't-old', name: 'Old reminder', time: '2026-10-24T09:00' });
  legacy.groups.push({ id: 'g-old', name: 'Old group', url: 'https://www.facebook.com/groups/old', selected: true });
  const migrated = Core.migrateState(legacy);
  assert.equal(migrated.groups[0].id, 'g-old');
  assert.equal(migrated.tasks[0].status, 'scheduled');
  assert.ok(migrated.prompts.general.includes('{content}'));
  assert.equal(Core.isValidState(migrated), true);
});

test('CSV parser rejects characters after a closing quote', () => {
  assert.throws(() => Core.parseCsv('"closed"x,value'), /sau dấu ngoặc kép đóng/);
  assert.equal(Core.isSafeFacebookGroupUrl('https://evil.facebook.com/groups/example'), false);
  assert.equal(Core.isSafeFacebookGroupUrl('https://facebook.com:444/groups/example'), false);
});
