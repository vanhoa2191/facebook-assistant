'use strict';

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get('faa.state').then(result => {
    if (!result['faa.state']) {
      const defaults = globalThis.FAACore ? globalThis.FAACore.createDefaultState() : {
        settings: { language: 'vi', speed: 'normal', provider: 'demo', model: '', groupLimit: 10, delay: 30 },
        groups: [], profiles: [], tasks: [], logs: [], drafts: [], moduleNotes: {},
        prompts: { share: 'Viết lời dẫn phù hợp với ngữ cảnh và không thêm thông tin chưa xác minh.' }
      };
      return chrome.storage.local.set({ 'faa.state': defaults });
    }
    return undefined;
  }).catch(() => {});
});

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message && message.type === 'PING') {
    sendResponse({ ok: true, version: '0.1.0' });
  }
});
