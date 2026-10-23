'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Gemini = require('../src/ai-provider.js');

test('rejects invalid API key, model, and prompt before making a request', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return { ok: true, json: async () => ({}) }; };
  await assert.rejects(Gemini.generateContent({ apiKey: 'short', model: 'gemini-2.5-flash', prompt: 'hi', fetchImpl }), /API key/);
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: '../evil', prompt: 'hi', fetchImpl }), /model/);
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: '', fetchImpl }), /Prompt/);
  assert.equal(calls, 0);
});

test('sends Gemini key in header and extracts generated text', async () => {
  let request;
  const fetchImpl = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200, json: async () => ({
      candidates: [{ content: { parts: [{ text: 'Bản nháp ' }, { text: 'hoàn chỉnh.' }] } }]
    }) };
  };
  const output = await Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'Viết một câu.', fetchImpl });
  assert.equal(output, 'Bản nháp \nhoàn chỉnh.');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key-123456789');
  assert.equal(request.url.includes('test-key-123456789'), false);
  assert.equal(JSON.parse(request.options.body).contents[0].parts[0].text, 'Viết một câu.');
});

test('normalizes quota and permission failures', async () => {
  const quota = async () => ({ ok: false, status: 429 });
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'hello', fetchImpl: quota }), /hạn mức/);
  const forbidden = async () => ({ ok: false, status: 403 });
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'hello', fetchImpl: forbidden }), /API key/);
});

test('handles empty response and network failure without exposing credentials', async () => {
  const empty = async () => ({ ok: true, status: 200, json: async () => ({ candidates: [] }) });
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'hello', fetchImpl: empty }), /không trả về văn bản/);
  const network = async () => { throw new Error('secret internal detail'); };
  await assert.rejects(Gemini.generateContent({ apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'hello', fetchImpl: network }), /Không thể kết nối/);
});

test('aborts a request that exceeds its timeout', async () => {
  const fetchImpl = (_url, options) => new Promise((resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  await assert.rejects(Gemini.generateContent({
    apiKey: 'test-key-123456789', model: 'gemini-2.5-flash', prompt: 'hello', fetchImpl, timeoutMs: 1000
  }), /hết thời gian chờ/);
});
