'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const Core = require('../src/core.js');
const Gemini = require('../src/ai-provider.js');

function loadApp(options) {
  const settings = options || {};
  const listeners = {};
  const elements = {};
  const openedTabs = [];
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
    FAAFacebook: settings.facebookProvider || {
      publishPagePost: async options => ({
        id: '12345678_98765432', pageId: options.pageId, version: options.version,
        scheduled: Boolean(options.scheduledPublishAt), scheduledAt: options.scheduledPublishAt || null
      })
    },
    confirm: () => true,
    prompt: () => null
  };
  const chrome = {
    storage: {
      local: {
        get: async () => settings.initialState ? { 'faa.state': settings.initialState } : {},
        set: async () => ({})
      },
      session: {
        get: async key => {
          if (!settings.pageToken) return {};
          const token = { 'faa.facebookPageToken': 'test-page-token-12345' };
          if (Array.isArray(key)) return token;
          return key === 'faa.facebookPageToken' ? token : {};
        },
        set: async () => ({}),
        remove: async () => ({})
      }
    },
    permissions: {
      contains: async args => {
        if (Array.isArray(args.permissions)) return args.permissions.includes('scripting') && (args.origins || []).some(origin => origin.includes('meta.ai'));
        if ((args.origins || []).some(origin => origin.includes('graph.facebook.com'))) return Boolean(settings.graphPermission);
        return false;
      },
      request: async () => false
    },
    tabs: {
      create: async options => { openedTabs.push(options); return { id: openedTabs.length }; },
      query: async () => [{ id: 7, url: 'https://www.meta.ai/', status: 'complete' }],
      sendMessage: async () => ({ ok: true, text: 'Bản nháp Meta AI đã được tạo thành công.' })
    },
    scripting: { executeScript: async () => [{}] }
  };
  const context = { window, document, chrome, crypto, setTimeout, clearTimeout, Date, URL, Blob, navigator: { clipboard: { writeText: async () => {} } } };
  const appPath = path.join(__dirname, '..', 'src', 'app.js');
  vm.runInNewContext(fs.readFileSync(appPath, 'utf8'), context, { filename: 'src/app.js' });
  return { elements, listeners, openedTabs };
}

test('dashboard initializes and renders all 13 navigation modules', async () => {
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
    return selector === '[data-nav]' ? { dataset: { nav: 'connect' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Kết bạn');
  assert.match(elements['#view'].innerHTML, /contactUrl/);
  assert.match(elements['#view'].innerHTML, /không tự gửi lời mời kết bạn/i);

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
  assert.match(elements['#view'].innerHTML, /Lưu chỉnh sửa thành nháp/);

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

  click({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav: 'review' } } : null;
  } } });
  assert.equal(elements['#pageTitle'].textContent, 'Hàng đợi duyệt bài');
  assert.match(elements['#view'].innerHTML, /AI chỉ tạo bản nháp/);
  assert.match(elements['#view'].innerHTML, /reviewStatusFilter/);
});


test('Meta AI draft moves through review queue and saves edits without publishing', async () => {
  const { elements, listeners } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  const clickNav = nav => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav } } : null;
  } } });
  const clickAction = (action, id) => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-action]' ? { dataset: { action, id } } : null;
  } } });

  clickNav('scrape');
  elements['#moduleInput'] = { value: 'Tóm tắt nội dung bài viết tôi cung cấp.' };
  elements['#modulePrompt'] = { value: 'Tóm tắt ngắn gọn: {content}' };
  elements['#moduleSourceUrl'] = { value: 'https://www.facebook.com/posts/123' };
  clickAction('generateModuleDraft');
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.match(elements['#view'].innerHTML, /Mở liên kết/);
  assert.match(elements['#view'].innerHTML, /Chờ duyệt/);
  const match = elements['#view'].innerHTML.match(/data-action="reviewDraft" data-id="([^"]+)"/);
  assert.ok(match, 'generated draft should have a review action');
  const draftId = match[1];

  clickAction('reviewDraft', draftId);
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(elements['#pageTitle'].textContent, 'Nuôi Page');
  assert.match(elements['#view'].innerHTML, /Bản nháp đã được duyệt sơ bộ/);
  assert.match(elements['#view'].innerHTML, /Lưu chỉnh sửa thành nháp/);

  elements['#pageMessage'] = { value: 'Nội dung đã được người dùng chỉnh sửa.' };
  elements['#pageLink'] = { value: '' };
  clickAction('savePageDraft');
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.match(elements['#toast'].textContent, /Đã lưu bản nháp/);

  clickNav('review');
  assert.match(elements['#view'].innerHTML, /Nội dung đã được người dùng chỉnh sửa/);
  assert.match(elements['#view'].innerHTML, /Chờ duyệt/);
  assert.match(elements['#view'].innerHTML, /Mở liên kết/);
});


test('confirmed Page publishing records the result in the review queue', async () => {
  const { elements, listeners } = loadApp({ graphPermission: true, pageToken: true });
  await new Promise(resolve => setTimeout(resolve, 10));
  const clickNav = nav => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav } } : null;
  } } });
  const clickAction = (action, id) => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-action]' ? { dataset: { action, id } } : null;
  } } });

  clickNav('pages');
  elements['#pageId'] = { value: '12345678' };
  elements['#graphVersion'] = { value: 'v26.0' };
  elements['#pageMessage'] = { value: 'A reviewed Page post.' };
  elements['#pageLink'] = { value: '' };
  elements['#pagePublishTime'] = { value: '' };
  clickAction('publishPagePost');
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.match(elements['#view'].innerHTML, /Đăng thành công/);
  assert.match(elements['#view'].innerHTML, /12345678_98765432/);

  clickNav('review');
  clickAction('clearReviewFilter');
  assert.match(elements['#view'].innerHTML, /Đã đăng/);
  assert.match(elements['#view'].innerHTML, /12345678_98765432/);
});


test('connect module can generate a reviewed invitation draft with its source URL', async () => {
  const { elements, listeners } = loadApp();
  await new Promise(resolve => setTimeout(resolve, 10));
  const clickNav = nav => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav } } : null;
  } } });
  const clickAction = action => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-action]' ? { dataset: { action } } : null;
  } } });

  clickNav('connect');
  assert.match(elements['#view'].innerHTML, /Soạn lời mời bằng Meta AI Web/);
  elements['#moduleInput'] = { value: 'Người nhận viết về giáo dục tiểu học; tôi muốn kết nối để trao đổi kinh nghiệm.' };
  elements['#modulePrompt'] = { value: 'Viết lời mời ngắn, không bịa quan hệ: {content}' };
  elements['#moduleSourceUrl'] = { value: 'https://www.facebook.com/profile.php?id=123456' };
  clickAction('generateModuleDraft');
  await new Promise(resolve => setTimeout(resolve, 30));

  assert.match(elements['#view'].innerHTML, /Chờ duyệt/);
  assert.match(elements['#view'].innerHTML, /Mở liên kết/);
  assert.match(elements['#view'].innerHTML, /Người nhận viết về giáo dục tiểu học/);
  assert.match(elements['#view'].innerHTML, /không gửi lời mời/i);
});

test('opening selected groups respects the configured batch limit', async () => {
  const initialState = Core.createDefaultState();
  initialState.settings.groupLimit = 2;
  initialState.settings.delay = 0;
  initialState.groups = [
    { id: 'g1', name: 'Group One', url: 'https://www.facebook.com/groups/one', selected: true },
    { id: 'g2', name: 'Group Two', url: 'https://www.facebook.com/groups/two', selected: true },
    { id: 'g3', name: 'Group Three', url: 'https://www.facebook.com/groups/three', selected: true }
  ];
  const { elements, listeners, openedTabs } = loadApp({ initialState });
  await new Promise(resolve => setTimeout(resolve, 10));
  const clickNav = nav => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-nav]' ? { dataset: { nav } } : null;
  } } });
  const clickAction = action => listeners['document:click']({ target: { closest(selector) {
    return selector === '[data-action]' ? { dataset: { action } } : null;
  } } });

  clickNav('groups');
  clickAction('openSelectedGroups');
  await new Promise(resolve => setTimeout(resolve, 20));
  assert.equal(openedTabs.length, 2);
  assert.equal(openedTabs[0].url, 'https://www.facebook.com/groups/one');
  assert.equal(openedTabs[1].url, 'https://www.facebook.com/groups/two');
  assert.match(elements['#toast'].textContent, /Đã mở 2 tab nhóm/);
});
