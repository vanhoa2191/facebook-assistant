(function () {
  'use strict';

  const INSTALL_KEY = '__faaMetaAiWebBridgeV1';
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = element => {
    if (!element || !element.isConnected) return false;
    const style = window.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' &&
      element.getClientRects().length > 0;
  };
  const textOf = element => String(element && (element.innerText || element.textContent) || '')
    .replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();

  function findComposer() {
    const candidates = Array.from(document.querySelectorAll(
      'textarea, input[type="text"], input[role="textbox"], [contenteditable="true"], [role="textbox"], [data-lexical-editor="true"]'
    )).filter(element => {
      if (!visible(element) || element.disabled || element.getAttribute('aria-disabled') === 'true') return false;
      if (element.tagName === 'INPUT' && /search|email|password/i.test(element.type + ' ' + element.placeholder)) return false;
      const descriptor = [
        element.getAttribute('aria-label'), element.getAttribute('placeholder'),
        element.getAttribute('data-placeholder'), element.getAttribute('role')
      ].join(' ').toLowerCase();
      return element.tagName === 'TEXTAREA' || element.isContentEditable ||
        element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('data-lexical-editor') === 'true' ||
        /message|ask|prompt|chat|nhắn|hỏi|trò chuyện/.test(descriptor);
    });
    const score = element => {
      const descriptor = [
        element.getAttribute('aria-label'), element.getAttribute('placeholder'),
        element.getAttribute('data-placeholder')
      ].join(' ').toLowerCase();
      return (element.isContentEditable || element.getAttribute('contenteditable') === 'true' ? 5 : 0) +
        (element.getAttribute('role') === 'textbox' ? 3 : 0) +
        (/message|ask|prompt|chat|nhắn|hỏi/.test(descriptor) ? 4 : 0) +
        (element.tagName === 'TEXTAREA' ? 1 : 0);
    };
    return candidates.sort((a, b) => score(b) - score(a))[0] || null;
  }

  function setComposerValue(element, value) {
    element.focus();
    if (element.isContentEditable || element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('data-lexical-editor') === 'true') {
      element.textContent = value;
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertText', data: value
      }));
    } else {
      const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, 'value');
      if (!setter || !setter.set) throw new Error('Không thể nhập văn bản vào ô chat của Meta AI.');
      setter.set.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function findSendButton(composer) {
    const form = composer.closest('form');
    if (form) {
      const submit = Array.from(form.querySelectorAll('button[type="submit"], input[type="submit"]'))
        .find(element => visible(element) && !element.disabled);
      if (submit) return submit;
    }
    const candidates = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter(element => visible(element) && !element.disabled &&
        element.getAttribute('aria-disabled') !== 'true');
    const scored = candidates.map(element => {
      const label = [
        element.getAttribute('aria-label'), element.getAttribute('title'),
        element.getAttribute('data-testid'), textOf(element)
      ].join(' ').toLowerCase();
      if (/stop|cancel|clear|delete|attach|upload|mic|voice|dừng|hủy|xóa|đính kèm/.test(label)) return { element, score: -1 };
      let score = 0;
      if (/^send$|^send message$|^gửi$|^gửi tin nhắn$/.test(label.trim())) score += 10;
      if (/send|submit|gửi/.test(label)) score += 5;
      if (/message|prompt|chat/.test(label)) score += 1;
      if (composer.parentElement && composer.parentElement.contains(element)) score += 3;
      if (composer.parentElement && composer.parentElement.parentElement &&
          composer.parentElement.parentElement.contains(element)) score += 1;
      return { element, score };
    }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
    return scored[0] && scored[0].element;
  }

  function collectAssistantTexts() {
    const primarySelector = [
      '[data-message-author-role="assistant"]',
      '[data-testid*="assistant-message"]',
      '[data-testid*="response"]',
      '[data-testid*="message-content"]'
    ].join(',');
    const primary = Array.from(document.querySelectorAll(primarySelector))
      .filter(visible).map(element => ({ element, text: textOf(element) }))
      .filter(item => item.text.length >= 20);
    if (primary.length) return primary;

    const fallbackSelector = 'main p, main li, main pre, main [dir="auto"]';
    return Array.from(document.querySelectorAll(fallbackSelector))
      .filter(visible).map(element => ({ element, text: textOf(element) }))
      .filter(item => item.text.length >= 20);
  }

  function isGenerating() {
    return Array.from(document.querySelectorAll('button, [role="button"], [aria-label]'))
      .filter(visible).some(element => {
        const label = [
          element.getAttribute('aria-label'), element.getAttribute('title'),
          element.getAttribute('data-testid'), textOf(element)
        ].join(' ').toLowerCase();
        return /stop generating|stop response|đang tạo|dừng tạo|ngừng tạo/.test(label);
      });
  }

  async function waitForResponse(beforeTexts, prompt) {
    const deadline = Date.now() + 180000;
    let lastText = '';
    let stableSince = 0;
    while (Date.now() < deadline) {
      await sleep(500);
      const all = collectAssistantTexts();
      const fresh = all.filter(item => !beforeTexts.has(item.text) &&
        item.text !== prompt.trim() && !item.text.includes(prompt.trim()));
      if (fresh.length) {
        const response = fresh.sort((a, b) => b.text.length - a.text.length)[0].text;
        if (response === lastText) {
          if (!stableSince) stableSince = Date.now();
        } else {
          lastText = response;
          stableSince = 0;
        }
        if (!isGenerating() && stableSince && Date.now() - stableSince >= 1500) return response.slice(0, 30000);
      }
    }
    throw new Error('Không phát hiện được câu trả lời hoàn chỉnh trong 3 phút. Hãy kiểm tra tab Meta AI và thử lại.');
  }

  async function generate(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) {
      throw new Error('Prompt phải có từ 1 đến 20.000 ký tự.');
    }
    const composer = findComposer();
    if (!composer) {
      throw new Error('Không tìm thấy ô chat Meta AI. Hãy mở meta.ai, đăng nhập nếu cần và đợi giao diện chat tải xong rồi thử lại.');
    }
    const beforeTexts = new Set(collectAssistantTexts().map(item => item.text));
    setComposerValue(composer, prompt.trim());
    await sleep(250);
    const sendButton = findSendButton(composer);
    if (!sendButton) {
      throw new Error('Không xác định được nút Gửi của Meta AI. Chưa gửi prompt để tránh thao tác nhầm; giao diện có thể đã thay đổi.');
    }
    sendButton.click();
    return waitForResponse(beforeTexts, prompt);
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== 'FAA_META_AI_WEB_GENERATE') return false;
    generate(message.prompt).then(text => sendResponse({ ok: true, text }))
      .catch(error => sendResponse({ ok: false, error: String(error && error.message || 'Lỗi Meta AI Web').slice(0, 500) }));
    return true;
  });
})();
