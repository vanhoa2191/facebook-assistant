(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FAAFacebook = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const API_ORIGIN = 'https://graph.facebook.com';
  const DEFAULT_VERSION = 'v26.0';
  const MAX_MESSAGE_LENGTH = 60000;

  async function publishPagePost(options) {
    const settings = options || {};
    const pageId = typeof settings.pageId === 'string' ? settings.pageId.trim() : '';
    const accessToken = typeof settings.accessToken === 'string' ? settings.accessToken.trim() : '';
    const message = typeof settings.message === 'string' ? settings.message.trim() : '';
    const link = typeof settings.link === 'string' ? settings.link.trim() : '';
    const version = typeof settings.version === 'string' ? settings.version.trim() : DEFAULT_VERSION;
    const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const timeoutMs = Number.isFinite(settings.timeoutMs) ? Math.min(120000, Math.max(1000, settings.timeoutMs)) : 45000;

    if (!/^[0-9]{5,30}$/.test(pageId)) throw new Error('Page ID phải là dãy số hợp lệ.');
    if (accessToken.length < 10 || accessToken.length > 500) throw new Error('Page access token chưa hợp lệ.');
    if (!message || message.length > MAX_MESSAGE_LENGTH) throw new Error('Nội dung bài viết phải có từ 1 đến 60.000 ký tự.');
    if (!/^v[0-9]{1,2}\.0$/.test(version)) throw new Error('Phiên bản Graph API không hợp lệ, ví dụ v26.0.');
    if (link && (link.length > 2048 || !/^https:\/\/[^\s]+$/i.test(link))) throw new Error('Link đính kèm phải là URL HTTPS hợp lệ.');
    if (!fetchImpl) throw new Error('Môi trường hiện tại không hỗ trợ fetch.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = API_ORIGIN + '/' + version + '/' + encodeURIComponent(pageId) + '/feed';
    const body = new URLSearchParams({ message, access_token: accessToken });
    if (link) body.set('link', link);

    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
        body: body.toString(),
        signal: controller.signal
      });
    } catch (_) {
      if (controller.signal.aborted) throw new Error('Yêu cầu Facebook Graph API đã hết thời gian chờ.');
      throw new Error('Không thể kết nối Facebook Graph API. Hãy kiểm tra mạng và quyền truy cập.');
    } finally {
      clearTimeout(timer);
    }

    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response || !response.ok || (data && data.error)) {
      const graphError = data && data.error ? data.error : {};
      const code = Number(graphError.code || 0);
      if (response && response.status === 401 || response && response.status === 403 || code === 190) {
        throw new Error('Facebook từ chối token hoặc quyền. Hãy kiểm tra Page access token và quyền pages_manage_posts.');
      }
      if (response && response.status === 429 || [4, 17, 32, 613].includes(code)) {
        throw new Error('Facebook đang giới hạn lưu lượng. Hãy chờ trước khi thử lại.');
      }
      if (graphError.message && typeof graphError.message === 'string') {
        throw new Error('Facebook Graph API: ' + graphError.message.slice(0, 300));
      }
      throw new Error('Facebook Graph API trả về lỗi HTTP ' + (response ? response.status : 0) + '.');
    }
    if (!data || typeof data.id !== 'string' || !data.id) {
      throw new Error('Facebook không trả về ID bài viết; hãy kiểm tra kết quả trong Page.');
    }
    return { id: data.id, pageId, version };
  }

  return { publishPagePost, API_ORIGIN, DEFAULT_VERSION, MAX_MESSAGE_LENGTH };
});
