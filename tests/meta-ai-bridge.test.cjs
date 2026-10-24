'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function loadBridge(options) {
  const settings = options || {};
  const listeners = [];
  const assistantMessages = [];
  let sentPrompt = '';
  let visibleComposer = settings.visibleComposer !== false;

  const textareaPrototype = {};
  const inputPrototype = {};
  for (const prototype of [textareaPrototype, inputPrototype]) {
    Object.defineProperty(prototype, 'value', {
      get() { return this._value || ''; },
      set(value) { this._value = value; }
    });
  }

  const composer = Object.create(settings.composerType === 'input' ? inputPrototype : textareaPrototype);
  Object.assign(composer, {
    tagName: settings.composerType === 'input' ? 'INPUT' : 'TEXTAREA',
    isConnected: true,
    disabled: false,
    isContentEditable: false,
    parentElement: null,
    getAttribute(name) {
      return ({ placeholder: 'Ask Meta AI', role: 'textbox', 'aria-label': 'Message Meta AI' })[name] || null;
    },
    getClientRects() { return visibleComposer ? [1] : []; },
    focus() {},
    dispatchEvent() { return true; },
    closest() { return null; }
  });

  const sendButton = {
    tagName: 'BUTTON',
    disabled: false,
    isConnected: true,
    parentElement: null,
    getAttribute(name) { return ({ 'aria-label': 'Send' })[name] || null; },
    getClientRects() { return [1]; },
    click() {
      sentPrompt = composer.value;
      assistantMessages.push({
        isConnected: true,
        innerText: 'Meta AI response: This is a complete, reviewed answer generated for the supplied prompt.',
        textContent: 'Meta AI response: This is a complete, reviewed answer generated for the supplied prompt.',
        getClientRects() { return [1]; }
      });
    }
  };

  const document = {
    querySelectorAll(selector) {
      if (selector.startsWith('textarea, input[type="text"]')) return visibleComposer ? [composer] : [];
      if (selector.startsWith('[data-message-author-role')) return assistantMessages;
      if (selector === 'button, [role="button"]') return [sendButton];
      if (selector === 'button, [role="button"], [aria-label]') return [sendButton];
      if (selector === 'main p, main li, main pre, main [dir="auto"]') return assistantMessages;
      return [];
    }
  };
  const window = {
    getComputedStyle() { return { display: 'block', visibility: 'visible' }; }
  };
  const chrome = {
    runtime: {
      onMessage: { addListener(listener) { listeners.push(listener); } }
    }
  };
  function Event() {}
  function InputEvent() {}
  function HTMLTextAreaElement() {}
  HTMLTextAreaElement.prototype = textareaPrototype;
  function HTMLInputElement() {}
  HTMLInputElement.prototype = inputPrototype;

  const context = {
    window, document, chrome, Event, InputEvent, HTMLTextAreaElement, HTMLInputElement,
    setTimeout, clearTimeout, Date, Promise, Array, String, RegExp, Error, Set
  };
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'meta-ai-bridge.js'), 'utf8');
  vm.runInNewContext(source, context, { filename: 'src/meta-ai-bridge.js' });
  return { listeners, composer, getSentPrompt: () => sentPrompt };
}

test('Meta AI Web bridge fills the visible composer, clicks Send, and returns the answer', async () => {
  const bridge = loadBridge();
  assert.equal(bridge.listeners.length, 1);
  const response = await new Promise(resolve => {
    const keepChannelOpen = bridge.listeners[0]({
      type: 'FAA_META_AI_WEB_GENERATE',
      prompt: 'Write a useful caption.'
    }, {}, resolve);
    assert.equal(keepChannelOpen, true);
  });
  assert.equal(response.ok, true);
  assert.match(response.text, /complete, reviewed answer/);
  assert.match(bridge.getSentPrompt(), /Write a useful caption/);
});

test('Meta AI Web bridge does not send when the chat composer cannot be found', async () => {
  const bridge = loadBridge({ visibleComposer: false });
  const response = await new Promise(resolve => {
    bridge.listeners[0]({
      type: 'FAA_META_AI_WEB_GENERATE',
      prompt: 'Do not send without a composer.'
    }, {}, resolve);
  });
  assert.equal(response.ok, false);
  assert.match(response.error, /Không tìm thấy ô chat/);
  assert.equal(bridge.getSentPrompt(), '');
});

test('Meta AI Web bridge rejects empty and oversized prompts', async () => {
  const bridge = loadBridge();
  const empty = await new Promise(resolve => {
    bridge.listeners[0]({ type: 'FAA_META_AI_WEB_GENERATE', prompt: ' ' }, {}, resolve);
  });
  assert.equal(empty.ok, false);
  assert.match(empty.error, /1 đến 20.000/);

  const oversized = await new Promise(resolve => {
    bridge.listeners[0]({ type: 'FAA_META_AI_WEB_GENERATE', prompt: 'x'.repeat(20001) }, {}, resolve);
  });
  assert.equal(oversized.ok, false);
  assert.match(oversized.error, /1 đến 20.000/);
});


test('Meta AI Web bridge also supports a visible text input composer', async () => {
  const bridge = loadBridge({ composerType: 'input' });
  const response = await new Promise(resolve => {
    bridge.listeners[0]({
      type: 'FAA_META_AI_WEB_GENERATE',
      prompt: 'Write from a text input.'
    }, {}, resolve);
  });
  assert.equal(response.ok, true);
  assert.match(bridge.getSentPrompt(), /Write from a text input/);
});
