'use strict';

importScripts('core.js');

const STATE_KEY = 'faa.state';
const ALARM_PREFIX = 'faa-task:';

function addLog(state, message) {
  state.logs = Array.isArray(state.logs) ? state.logs : [];
  state.logs.push({ at: new Date().toLocaleString('vi-VN'), message: String(message).slice(0, 2000) });
  if (state.logs.length > 500) state.logs.shift();
}

async function updateBadge(state) {
  const due = Array.isArray(state.tasks) ? state.tasks.filter(task => task.status === 'due').length : 0;
  await chrome.action.setBadgeText({ text: due ? String(Math.min(due, 99)) : '' });
  await chrome.action.setBadgeBackgroundColor({ color: '#d94841' });
  await chrome.action.setTitle({ title: due ? 'Facebook AI Assistant: ' + due + ' nhắc việc đến hạn' : 'Mở Facebook AI Assistant' });
}

async function syncTaskAlarms() {
  const result = await chrome.storage.local.get(STATE_KEY);
  const state = result[STATE_KEY] || FAACore.createDefaultState();
  state.tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter(alarm => alarm.name.startsWith(ALARM_PREFIX)).map(alarm => chrome.alarms.clear(alarm.name)));
  let changed = false;
  const now = Date.now();
  for (const task of state.tasks) {
    if (!task || ['done', 'missed', 'due'].includes(task.status)) continue;
    const when = Date.parse(task.time);
    if (!Number.isFinite(when)) continue;
    if (when <= now) {
      task.status = 'due';
      addLog(state, 'Nhắc việc đến hạn: ' + task.name);
      changed = true;
    } else {
      chrome.alarms.create(ALARM_PREFIX + task.id, { when });
      if (task.status !== 'scheduled') { task.status = 'scheduled'; changed = true; }
    }
  }
  if (changed) await chrome.storage.local.set({ [STATE_KEY]: state });
  await updateBadge(state);
}

chrome.runtime.onInstalled.addListener(async () => {
  const result = await chrome.storage.local.get(STATE_KEY);
  if (!result[STATE_KEY]) await chrome.storage.local.set({ [STATE_KEY]: FAACore.createDefaultState() });
  await syncTaskAlarms();
});
chrome.runtime.onStartup.addListener(() => { syncTaskAlarms().catch(() => {}); });
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes[STATE_KEY]) syncTaskAlarms().catch(() => {});
});
chrome.alarms.onAlarm.addListener(async alarm => {
  if (!alarm.name.startsWith(ALARM_PREFIX)) return;
  const result = await chrome.storage.local.get(STATE_KEY);
  const state = result[STATE_KEY] || FAACore.createDefaultState();
  const id = alarm.name.slice(ALARM_PREFIX.length);
  const task = Array.isArray(state.tasks) ? state.tasks.find(item => item.id === id) : null;
  if (!task || ['done', 'missed', 'due'].includes(task.status)) return;
  task.status = 'due';
  addLog(state, 'Nhắc việc đến hạn: ' + task.name);
  await chrome.storage.local.set({ [STATE_KEY]: state });
  await updateBadge(state);
});
chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PING') sendResponse({ ok: true, version: '0.5.0' });
});
