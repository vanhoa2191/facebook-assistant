'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Facebook = require('../src/facebook-provider.js');

test('rejects invalid Page ID, token, message, version, and link before calling API', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => ({ id: '123_456' }) }; };
  const base = { pageId: '12345678', accessToken: 'test-page-token-12345', message: 'Hello Page', fetchImpl };
  await assert.rejects(Facebook.publishPagePost({ ...base, pageId: 'not-a-number' }), /Page ID/);
  await assert.rejects(Facebook.publishPagePost({ ...base, accessToken: 'short' }), /token/);
  await assert.rejects(Facebook.publishPagePost({ ...base, message: ' ' }), /Nội dung/);
  await assert.rejects(Facebook.publishPagePost({ ...base, version: 'latest' }), /phiên bản/i);
  await assert.rejects(Facebook.publishPagePost({ ...base, link: 'javascript:alert(1)' }), /HTTPS/);
  assert.equal(calls, 0);
});

test('publishes a Page post using a POST body and never puts the token in the URL', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: '12345678_98765432' }) };
  };
  const result = await Facebook.publishPagePost({
    pageId: '12345678',
    accessToken: 'test-page-token-12345',
    message: 'A reviewed Page post',
    link: 'https://example.com/news',
    version: 'v26.0',
    fetchImpl
  });
  assert.deepEqual(result, { id: '12345678_98765432', pageId: '12345678', version: 'v26.0', scheduled: false, scheduledAt: null });
  assert.equal(request.options.method, 'POST');
  assert.match(request.url, /v26\.0\/12345678\/feed$/);
  assert.equal(request.url.includes('test-page-token-12345'), false);
  const body = new URLSearchParams(request.options.body);
  assert.equal(body.get('access_token'), 'test-page-token-12345');
  assert.equal(body.get('message'), 'A reviewed Page post');
  assert.equal(body.get('link'), 'https://example.com/news');
});

test('normalizes permission and rate-limit failures', async () => {
  const forbidden = async () => ({ ok: false, status: 403, json: async () => ({ error: { code: 200, message: 'permission denied' } }) });
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345', message: 'hello', fetchImpl: forbidden
  }), /pages_manage_posts/);
  const rateLimit = async () => ({ ok: false, status: 400, json: async () => ({ error: { code: 613, message: 'limit' } }) });
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345', message: 'hello', fetchImpl: rateLimit
  }), /giới hạn/);
});

test('handles network failure, timeout, and responses without post IDs', async () => {
  const network = async () => { throw new Error('internal token details'); };
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345', message: 'hello', fetchImpl: network
  }), /Không thể kết nối/);
  const empty = async () => ({ ok: true, status: 200, json: async () => ({}) });
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345', message: 'hello', fetchImpl: empty
  }), /không trả về ID/);
  const slow = (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345', message: 'hello', fetchImpl: slow, timeoutMs: 1000
  }), /hết thời gian chờ/);
});


test('schedules a Page post in Meta using published=false and a Unix timestamp', async () => {
  let request;
  const scheduledPublishAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({ id: '12345678_22222222' }) };
  };
  const result = await Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345',
    message: 'Scheduled Page post', scheduledPublishAt, version: 'v26.0', fetchImpl
  });
  const body = new URLSearchParams(request.options.body);
  assert.equal(body.get('published'), 'false');
  assert.equal(Number(body.get('scheduled_publish_time')), Math.floor(Date.parse(scheduledPublishAt) / 1000));
  assert.equal(result.scheduled, true);
  assert.equal(result.id, '12345678_22222222');
});

test('rejects Page scheduling less than 10 minutes or more than 30 days ahead', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ id: '12345678_1' }) });
  const base = { pageId: '12345678', accessToken: 'test-page-token-12345', message: 'Schedule me', fetchImpl };
  await assert.rejects(Facebook.publishPagePost({
    ...base, scheduledPublishAt: new Date(Date.now() + 2 * 60 * 1000).toISOString()
  }), /ít nhất 10 phút/);
  await assert.rejects(Facebook.publishPagePost({
    ...base, scheduledPublishAt: new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString()
  }), /tối đa 30 ngày/);
});


test('rejects HTTPS links that embed credentials before calling Facebook', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, status: 200, json: async () => ({ id: '123_456' }) }; };
  await assert.rejects(Facebook.publishPagePost({
    pageId: '12345678', accessToken: 'test-page-token-12345',
    message: 'A safe post', link: 'https://user:password@example.com/path', fetchImpl
  }), /không chứa thông tin đăng nhập/);
  assert.equal(calls, 0);
});
