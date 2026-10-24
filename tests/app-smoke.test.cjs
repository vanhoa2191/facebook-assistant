'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');
const Gemini = require('../src/ai-provider.js');

function loadApp() {
  const listeners = {};
  const elements = {};
  function makeElement(selector) {
    return {
      selector, innerHTML: '', textContent: '', value: '', style: {},
      addEventListener(type, callback) { listeners[selector + ':' + type] = callback; },
      click() { this.clicked = true; }
    };
  }
  const document = {
    querySelector(selector) {
      if (!elements[selector]) elements[selector] = makeElement(selector);
      return elements[selector];
    },
    addEventListener(type, callback) { listeners['document:' + type] = callback; }
  };
  const window = {
    FAACore: Core,
    FAAAI: Gemini,
    confirm: () => true,
    prompt: () => null
  };
  const chrome = {
    storage: {
      local: {
        get: async () => ({}),
        set: async () => ({})
      },
      session: {
        get: async () => ({}),
        set: async () => ({}),
        remove: async () => ({})
      }
    },
    permissions: {
      contains: async args => Array.isArray(args.permissions) && args.permissions.includes('scripting') && (args.origins || []).some(origin => origin.includes('meta.ai')),
      request: async () => false
    },
    tabs: {
      create: async () => ({ id: 1 }),
      query: async () => [{ id: 7, url: 'https://www.meta.ai/', status: 'complete' }],
      sendMessage: async () => ({ ok: true, text: 'Bản nháp Meta AI đã được tạo thành công.' })
    },
    scripting: { executeScript: async () => [{}] }
  };
  const context = { window, document, chrome, crypto, setTimeout, clearTimeout, Date, URL, Blob, navigator: { clipboard: { writeText: async () => {} } } };
  const appPath = path.join(__dirname, '..', 'src', 'app.js');
  vm.runInNewContext(fs.readFileSync(appPath, 'utf8'), context, { filename: 'src/app.js' });
  return { elements, listeners };
}

test('dashboard initializes and renders all 12 navigation modules', async () => {
  const { elements } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  const sidebar = elements['#sidebar'].innerHTML;
  assert.equal((sidebar.match(/data-nav=/g) || []).length, 13);
  assert.equal(elements['#pageTitle'].textContent, 'Quản lý nhóm và tương tác');
  assert.match(elements['#view'].innerHTML, /Thêm nhóm/);
  assert.match(elements['#view'].innerHTML, /Theo dõi tương tác/);
  assert.match(elements['#view'].innerHTML, /addEngagement/);
});

test('header distinguishes Meta AI Web status from Facebook Page API setup', async () => {
  const { elements, listeners } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.match(elements['#connectionStatus'].textContent, /Meta AI Web đã cấp quyền/);
  assert.match(elements['#connectionStatus'].textContent, /Facebook Page API chưa cấu hình/);
  assert.doesNotMatch(elements['#connectionStatus'].textContent, /chưa kết nối Facebook/);

  listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'ai' } } : null;
  } } });
  elements['#metaWebPrompt'] = { value: 'Hãy biên tập nội dung sau: {content}' };
  elements['#metaWebInput'] = { value: 'Viết lời giới thiệu ngắn.' };
  listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-action]' ? { dataset: { action: 'generateMetaWebDraft' } } : null;
  } } });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(elements['#connectionStatus'].textContent, /Meta AI Web hoạt động/);
  assert.match(elements['#connectionStatus'].textContent, /Facebook Page API chưa cấu hình/);
  assert.match(elements['#view'].innerHTML, /Đã nhận câu trả lời và lưu thành bản nháp/);
});

test('navigation opens the AI and sales modules without runtime errors', async () => {
  const { elements, listeners } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  const click = listeners['document:click'];
  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'ai' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Hồ sơ AI dùng chung');
  assert.match(elements['#view'].innerHTML, /Cấp quyền Gemini API/);
  assert.match(elements['#view'].innerHTML, /Cấp quyền và mở Meta AI/);
  assert.match(elements['#view'].innerHTML, /Gửi sang Meta AI Web và lưu nháp/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'sales' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Đăng bán');
  assert.match(elements['#view'].innerHTML, /Thông tin sản phẩm/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'pages' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Nuôi Page');
  assert.match(elements['#view'].innerHTML, /Page access token/);
  assert.match(elements['#view'].innerHTML, /Đăng ngay \/ lên lịch trên Page/);
  assert.match(elements['#view'].innerHTML, /pagePublishTime/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'share' } } : null;
  } } });
  assert.match(elements['#view'].innerHTML, /shareExternalOutput/);
  assert.match(elements['#view'].innerHTML, /Sao chép prompt/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'learn' } } : null;
  } } });
  assert.match(elements['#view'].innerHTML, /moduleOutput/);
  assert.match(elements['#view'].innerHTML, /Lưu kết quả AI thành nháp/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'schedule' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Lịch chạy');
  assert.match(elements['#view'].innerHTML, /taskDraftId/);
  assert.match(elements['#view'].innerHTML, /Lịch đăng Facebook Page/);
  assert.match(elements['#view'].innerHTML, /Lưu chỉnh sửa thành nháp/);

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'review' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Hàng đợi duyệt bài');
  assert.match(elements['#view'].innerHTML, /AI chỉ tạo bản nháp/);
  assert.match(elements['#view'].innerHTML, /reviewStatusFilter/);
});
