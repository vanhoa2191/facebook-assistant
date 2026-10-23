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
      contains: async () => false,
      request: async () => false
    },
    tabs: { create: async () => ({ id: 1 }) }
  };
  const context = { window, document, chrome, crypto, navigator: { clipboard: { writeText: async () => {} } } };
  const appPath = path.join(__dirname, '..', 'src', 'app.js');
  vm.runInNewContext(fs.readFileSync(appPath, 'utf8'), context, { filename: 'src/app.js' });
  return { elements, listeners };
}

test('dashboard initializes and renders all 12 navigation modules', async () => {
  const { elements } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  const sidebar = elements['#sidebar'].innerHTML;
  assert.equal((sidebar.match(/data-nav=/g) || []).length, 12);
  assert.equal(elements['#pageTitle'].textContent, 'Quản lý nhóm và tương tác');
  assert.match(elements['#view'].innerHTML, /Thêm nhóm/);
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
  assert.match(elements['#view'].innerHTML, /Đăng bài lên Page/);

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
});
