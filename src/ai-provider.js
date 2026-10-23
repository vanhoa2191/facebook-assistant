(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FAAAI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const API_ORIGIN = 'https://generativelanguage.googleapis.com';
  const MAX_PROMPT_LENGTH = 30000;

  async function generateContent(options) {
    const settings = options || {};
    const apiKey = typeof settings.apiKey === 'string' ? settings.apiKey.trim() : '';
    const model = typeof settings.model === 'string' ? settings.model.trim() : '';
    const prompt = typeof settings.prompt === 'string' ? settings.prompt.trim() : '';
    const fetchImpl = settings.fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
    const timeoutMs = Number.isFinite(settings.timeoutMs) ? Math.min(120000, Math.max(1000, settings.timeoutMs)) : 45000;

    if (apiKey.length < 10 || apiKey.length > 500) throw new Error('API key chưa hợp lệ. Hãy kiểm tra khóa Gemini.');
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model)) throw new Error('Tên model không hợp lệ.');
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH) throw new Error('Prompt phải có nội dung và không vượt quá 30.000 ký tự.');
    if (!fetchImpl) throw new Error('Môi trường hiện tại không hỗ trợ fetch.');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const endpoint = API_ORIGIN + '/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1200 }
        }),
        signal: controller.signal
      });
    } catch (_) {
      if (controller.signal.aborted) throw new Error('Yêu cầu Gemini đã hết thời gian chờ.');
      throw new Error('Không thể kết nối Gemini API. Hãy kiểm tra mạng và quyền truy cập.');
    } finally {
      clearTimeout(timer);
    }

    if (!response || !response.ok) {
      const status = response ? response.status : 0;
      if (status === 401 || status === 403) throw new Error('Gemini từ chối yêu cầu. Kiểm tra API key, quyền và cấu hình dự án.');
      if (status === 429) throw new Error('Gemini đang giới hạn lưu lượng hoặc hạn mức đã hết. Hãy thử lại sau.');
      if (status >= 500) throw new Error('Gemini đang gặp sự cố phía máy chủ. Hãy thử lại sau.');
      throw new Error('Gemini trả về lỗi HTTP ' + status + '. Kiểm tra model và nội dung yêu cầu.');
    }

    let data;
    try { data = await response.json(); }
    catch (_) { throw new Error('Gemini trả về dữ liệu không đọc được.'); }
    const candidates = data && Array.isArray(data.candidates) ? data.candidates : [];
    const parts = candidates[0] && candidates[0].content && Array.isArray(candidates[0].content.parts)
      ? candidates[0].content.parts : [];
    const text = parts.map(part => part && typeof part.text === 'string' ? part.text : '').filter(Boolean).join('\n').trim();
    if (!text) throw new Error('Gemini không trả về văn bản. Nội dung có thể bị chặn hoặc không có kết quả.');
    return text.slice(0, 20000);
  }

  return { generateContent, API_ORIGIN, MAX_PROMPT_LENGTH };
});
