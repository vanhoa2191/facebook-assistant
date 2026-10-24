'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');

function loadBackground(options) {
  const settings = options || {};
  let state = settings.state || Core.createDefaultState();
  const listeners = { installed: null, startup: null, changed: null, alarm: null, action: null, message: null, notificationClick: null };
  const alarms = [];
  const notifications = [];
  const clearedNotifications = [];
  const openedTabs = [];
  const badge = { text: '', title: '' };

  const chrome = {
    runtime: {
      onInstalled: { addListener(callback) { listeners.installed = callback; } },
      onStartup: { addListener(callback) { listeners.startup = callback; } },
      onMessage: { addListener(callback) { listeners.message = callback; } },
      getURL(file) { return 'chrome-extension://test/' + file; }
    },
    storage: {
      local: {
        async get() { return { 'faa.state': state }; },
        async set(values) { state = values['faa.state']; }
      },
      onChanged: { addListener(callback) { listeners.changed = callback; } }
    },
    alarms: {
      async getAll() { return alarms.slice(); },
      async clear(name) {
        const index = alarms.findIndex(item => item.name === name);
        if (index >= 0) alarms.splice(index, 1);
        return true;
      },
      create(name, info) { alarms.push({ name, ...info }); },
      onAlarm: { addListener(callback) { listeners.alarm = callback; } }
    },
    action: {
      async setBadgeText(options) { badge.text = options.text; },
      async setBadgeBackgroundColor() {},
      async setTitle(options) { badge.title = options.title; },
      onClicked: { addListener(callback) { listeners.action = callback; } }
    },
    permissions: {
      async contains(args) {
        return Array.isArray(args.permissions) && args.permissions.includes('notifications') && Boolean(settings.notificationsAllowed);
      }
    },
    notifications: {
      async create(id, options) { notifications.push({ id, options }); return id; },
      async clear(id) { clearedNotifications.push(id); return true; },
      onClicked: { addListener(callback) { listeners.notificationClick = callback; } }
    },
    tabs: {
      async create(options) { openedTabs.push(options); return { id: openedTabs.length }; }
    }
  };
  const context = {
    chrome,
    FAACore: Core,
    importScripts() {},
    Date,
    Math,
    String,
    Array,
    Number,
    Promise,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'background.js'), 'utf8'), context, {
    filename: 'src/background.js'
  });
  return {
    listeners,
    alarms,
    notifications,
    clearedNotifications,
    openedTabs,
    badge,
    getState: () => state
  };
}

test('due reminders update the badge and create a desktop notification when permission is granted', async () => {
  const state = Core.createDefaultState();
  state.tasks.push({
    id: 'task-1', name: 'Review draft before publishing',
    time: '2026-10-24T09:00', status: 'scheduled', draftId: 'draft-1'
  });
  const app = loadBackground({ state, notificationsAllowed: true });
  await app.listeners.alarm({ name: 'faa-task:task-1' });

  assert.equal(app.getState().tasks[0].status, 'due');
  assert.equal(app.badge.text, '1');
  assert.match(app.badge.title, /1 nhắc việc đến hạn/);
  assert.equal(app.notifications.length, 1);
  assert.equal(app.notifications[0].id, 'faa-reminder:task-1');
  assert.equal(app.notifications[0].options.title, 'Facebook AI Assistant · Nhắc việc đến hạn');
  assert.match(app.notifications[0].options.message, /Review draft before publishing/);
  assert.match(app.notifications[0].options.iconUrl, /src\/notification\.svg$/);
});

test('due reminders remain visible in the badge when desktop notifications are denied', async () => {
  const state = Core.createDefaultState();
  state.tasks.push({
    id: 'task-2', name: 'Review content',
    time: '2026-10-24T09:00', status: 'scheduled'
  });
  const app = loadBackground({ state, notificationsAllowed: false });
  await app.listeners.alarm({ name: 'faa-task:task-2' });

  assert.equal(app.getState().tasks[0].status, 'due');
  assert.equal(app.badge.text, '1');
  assert.equal(app.notifications.length, 0);
});

test('clicking a reminder notification opens the dashboard and clears the notification', async () => {
  const app = loadBackground({ notificationsAllowed: true });
  await app.listeners.notificationClick('faa-reminder:task-1');
  assert.equal(app.openedTabs.length, 1);
  assert.equal(app.openedTabs[0].url, 'chrome-extension://test/dashboard.html#schedule');
  assert.deepEqual(app.clearedNotifications, ['faa-reminder:task-1']);
});

test('startup restores alarms for future reminders and does not reschedule completed tasks', async () => {
  const state = Core.createDefaultState();
  state.tasks.push(
    { id: 'future', name: 'Future task', time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), status: 'scheduled' },
    { id: 'done', name: 'Completed task', time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), status: 'done' }
  );
  const app = loadBackground({ state, notificationsAllowed: true });
  app.listeners.startup();
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(app.alarms.length, 2);
  assert.ok(app.alarms.some(alarm => alarm.name === 'faa-task:future'));
  assert.ok(app.alarms.some(alarm => alarm.name === 'faa-weekly-report'));
  assert.equal(app.notifications.length, 0);
});


test('weekly report alarm stores a local report and notifies without calling an AI provider', async () => {
  const state = Core.createDefaultState();
  state.observations.push({
    id: 'weekly-observation', sourceUrl: 'https://www.facebook.com/posts/123',
    capturedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    text: 'Visible post and comments', contactId: 'contact-1', contactName: 'Alice'
  });
  const app = loadBackground({ state, notificationsAllowed: true });
  await app.listeners.alarm({ name: 'faa-weekly-report' });

  assert.equal(app.getState().weeklyReports.length, 1);
  assert.equal(app.getState().weeklyReports[0].observationsCount, 1);
  assert.match(app.getState().weeklyReports[0].summary, /Alice: 1/);
  assert.equal(app.notifications.length, 1);
  assert.match(app.notifications[0].id, /^faa-weekly-report:/);
  assert.match(app.notifications[0].options.title, /Báo cáo tuần đã sẵn sàng/);
});

test('clicking a weekly report notification opens the analytics dashboard', async () => {
  const app = loadBackground({ notificationsAllowed: true });
  await app.listeners.notificationClick('faa-weekly-report:weekly-2026-10-24');
  assert.equal(app.openedTabs.length, 1);
  assert.equal(app.openedTabs[0].url, 'chrome-extension://test/dashboard.html#analytics');
  assert.deepEqual(app.clearedNotifications, ['faa-weekly-report:weekly-2026-10-24']);
});
