(function () {
  'use strict';

  const INSTALL_KEY = '__FAA_FACEBOOK_PAGE_BRIDGE_V1__';
  const MESSAGE_TYPE = 'FAA_CAPTURE_VISIBLE_FACEBOOK_POST';
  const MAX_CAPTURE_CHARS = 50000;
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  function normalizeText(value, maxLength) {
    return String(value == null ? '' : value)
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, maxLength || MAX_CAPTURE_CHARS);
  }

  function isVisible(element) {
    if (!element || element.hidden || element.getAttribute('aria-hidden') === 'true') return false;
    try {
      const style = window.getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
    } catch (_) {}
    try {
      const rect = element.getBoundingClientRect();
      if (rect && rect.width === 0 && rect.height === 0) return false;
    } catch (_) {}
    return true;
  }

  function isPostPermalink(href) {
    try {
      const url = new URL(href);
      const host = url.hostname.toLowerCase();
      if (url.protocol !== 'https:' ||
          !['facebook.com', 'www.facebook.com', 'web.facebook.com', 'm.facebook.com'].includes(host)) return false;

      const numericId = value => /^[0-9]{3,30}$/.test(String(value || ''));
      const path = url.pathname.replace(/\\/+$/, '') || '/';
      const segments = path.split('/').filter(Boolean);

      // Story links must identify a specific story, not merely carry an arbitrary fbid query.
      if (numericId(url.searchParams.get('story_fbid'))) return true;

      // Photo URLs can identify the photo by query only on an explicitly photo-specific route.
      if (/^\\/(?:photo\\.php|photo)\\/?$/i.test(path) && numericId(url.searchParams.get('fbid'))) return true;

      // Watch URLs require a concrete video id; /watch/ alone is a listing route.
      if (/^\\/watch\\/?$/i.test(path) && numericId(url.searchParams.get('v'))) return true;

      // Explicit permalink routes require a concrete identifier at the end of the path.
      if (/(?:^|\\/)(?:posts|permalink|videos|reel|photos)\\/[0-9]{3,30}$/i.test(path)) return true;
      if (/^\\/share\\/p\\/[A-Za-z0-9_-]{5,}$/i.test(path)) return true;

      // Group posts use /groups/<group-id>/posts/<post-id>.
      if (/^\\/groups\\/[A-Za-z0-9.-]+\\/posts\\/[0-9]{3,30}$/i.test(path)) return true;

      // Profile/timeline posts can have a profile slug or numeric owner before /posts/<id>.
      if (/^\\/[^/]+\\/posts\\/[0-9]{3,30}$/i.test(path)) return true;

      // Reject generic feed, search, watch, photos and arbitrary ?fbid= URLs.
      return false;
    } catch (_) {
      return false;
    }
  }

  function captureVisiblePost() {
    const href = String(window.location && window.location.href || '');
    if (!isPostPermalink(href)) {
      return { ok: false, error: 'Hãy mở trang riêng của một bài viết Facebook trước khi thu thập. Không quét toàn bộ bảng tin.' };
    }

    const root = document.querySelector('[role="main"]') || document.querySelector('main') || document.body;
    if (!root || !isVisible(root)) {
      return { ok: false, error: 'Không tìm thấy vùng nội dung bài viết đang hiển thị.' };
    }

    const visibleText = normalizeText(root.innerText || root.textContent, MAX_CAPTURE_CHARS);
    if (visibleText.length < 20) {
      return { ok: false, error: 'Không đọc được nội dung bài viết. Hãy mở rộng phần bài viết/bình luận đang hiển thị rồi thử lại.' };
    }

    let articleTexts = [];
    try {
      articleTexts = Array.from(root.querySelectorAll('[role="article"]'))
        .filter(isVisible)
        .map((element) => normalizeText(element.innerText || element.textContent, 4000))
        .filter((value) => value.length >= 8);
    } catch (_) {}
    const seen = new Set();
    articleTexts = articleTexts.filter((value) => {
      const key = value.toLowerCase().replace(/\s+/g, ' ').slice(0, 500);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 80);

    const parts = [
      'Nguồn: ' + href,
      'Tiêu đề trang: ' + normalizeText(document.title, 300),
      'Nội dung đang hiển thị trong vùng chính:',
      visibleText
    ];
    if (articleTexts.length) {
      parts.push('Các khối bài viết/bình luận đang hiển thị (thứ tự DOM; có thể gồm nội dung lồng nhau):');
      articleTexts.forEach((value, index) => parts.push('[' + (index + 1) + '] ' + value));
    }

    return {
      ok: true,
      sourceUrl: href,
      title: normalizeText(document.title, 300),
      text: normalizeText(parts.join('\n\n'), MAX_CAPTURE_CHARS),
      visibleArticleCount: articleTexts.length,
      capturedAt: new Date().toISOString(),
      scope: 'visible-post-and-comments-only'
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!message || message.type !== MESSAGE_TYPE) return false;
    try {
      sendResponse(captureVisiblePost());
    } catch (_) {
      sendResponse({ ok: false, error: 'Không thể đọc nội dung đang hiển thị trên Facebook.' });
    }
    return false;
  });
})();
