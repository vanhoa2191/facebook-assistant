'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadBridge(options) {
  const settings = options || {};
  const listeners = [];
  const articles = (settings.articles || []).map(value => ({
    innerText: value,
    textContent: value,
    hidden: false,
    getAttribute(name) { return name === 'aria-hidden' ? 'false' : null; },
    getBoundingClientRect() { return { width: 200, height: 30 }; }
  }));
  const main = {
    innerText: settings.mainText || '',
    textContent: settings.mainText || '',
    hidden: false,
    getAttribute(name) { return name === 'aria-hidden' ? 'false' : null; },
    getBoundingClientRect() { return { width: 800, height: 700 }; },
    querySelectorAll(selector) { return selector === '[role="article"]' ? articles : []; }
  };
  const document = {
    title: settings.title || 'Facebook post',
    body: main,
    querySelector(selector) {
      if (selector === '[role="main"]' || selector === 'main') return main;
      return null;
    }
  };
  const window = {
    location: { href: settings.href || 'https://www.facebook.com/groups/123/posts/456' },
    getComputedStyle() { return { display: 'block', visibility: 'visible', opacity: '1' }; }
  };
  const chrome = { runtime: { onMessage: { addListener(callback) { listeners.push(callback); } } } };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'facebook-page-bridge.js'), 'utf8'), {
    window, document, chrome, URL, Date, Array, String
  }, { filename: 'src/facebook-page-bridge.js' });
  return {
    listener: listeners[0],
    capture(messageType) {
      let response;
      listeners[0]({ type: messageType || 'FAA_CAPTURE_VISIBLE_FACEBOOK_POST' }, {}, value => { response = value; });
      return response;
    }
  };
}

test('Facebook page bridge rejects the general feed and only captures a post permalink', () => {
  const bridge = loadBridge({ href: 'https://www.facebook.com/' });
  const result = bridge.capture();
  assert.equal(result.ok, false);
  assert.match(result.error, /trang riêng của một bài viết/);
});

test('Facebook page bridge captures only visible main content and article/comment blocks', () => {
  const bridge = loadBridge({
    href: 'https://www.facebook.com/groups/123/posts/456',
    title: 'Post title',
    mainText: 'Bài viết chính\\nMột bình luận\\nMột phản hồi lồng nhau',
    articles: ['Bài viết chính', 'Một bình luận', 'Một phản hồi lồng nhau']
  });
  const result = bridge.capture();
  assert.equal(result.ok, true);
  assert.equal(result.sourceUrl, 'https://www.facebook.com/groups/123/posts/456');
  assert.equal(result.visibleArticleCount, 3);
  assert.match(result.text, /Bài viết chính/);
  assert.match(result.text, /Một bình luận/);
  assert.match(result.text, /Một phản hồi lồng nhau/);
  assert.match(result.text, /thứ tự DOM/);
  assert.equal(result.scope, 'visible-post-and-comments-only');
});

test('Facebook page bridge rejects a non-Facebook source', () => {
  const bridge = loadBridge({ href: 'https://evil.example/posts/123', mainText: 'A post' });
  const result = bridge.capture();
  assert.equal(result.ok, false);
});

test('Facebook page bridge caps large visible text to the documented limit', () => {
  const bridge = loadBridge({
    href: 'https://www.facebook.com/posts/123',
    mainText: 'x'.repeat(60000)
  });
  const result = bridge.capture();
  assert.equal(result.ok, true);
  assert.ok(result.text.length <= 50000);
});
