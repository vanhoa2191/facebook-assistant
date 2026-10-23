(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FAACore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_ITEMS = 10000;
  const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = (value, max) => typeof value === 'string' && value.length <= max;

  function createDefaultState() {
    return {
      settings: { language: 'vi', speed: 'normal', provider: 'demo', model: '', groupLimit: 10, delay: 30 },
      groups: [],
      profiles: [],
      tasks: [],
      logs: [],
      drafts: [],
      moduleNotes: {},
      prompts: {
        share: 'Viết lời dẫn ngắn, tự nhiên, phù hợp với {groupName}, dựa trên nội dung: {postText}. Không thêm thông tin chưa được xác minh.',
        general: 'Bạn là trợ lý biên tập. Hãy viết rõ ràng, tự nhiên, đúng ngữ cảnh. Không bịa dữ kiện. Nội dung đầu vào: {content}',
        comment: 'Soạn một bình luận hữu ích, lịch sự cho ngữ cảnh sau: {content}',
        sales: 'Viết bài giới thiệu sản phẩm rõ lợi ích, không phóng đại hoặc thêm dữ kiện chưa cung cấp: {content}',
        feed: 'Tạo một bản tin ngắn dựa hoàn toàn trên thông tin được cung cấp: {content}',
        summary: 'Tóm tắt các ý chính, không thêm thông tin ngoài nguồn: {content}'
      }
    };
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function isSafeFacebookGroupUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const facebookHost = host === 'facebook.com' || host.endsWith('.facebook.com');
      return url.protocol === 'https:' && facebookHost && !url.username && !url.password &&
        /^\/groups\/[^/]+(?:\/|$)/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function isBoundedArray(value) {
    return Array.isArray(value) && value.length <= MAX_ITEMS;
  }

  function isValidState(value) {
    if (!isObject(value) || !isObject(value.settings) || !isObject(value.prompts)) return false;
    const arrayKeys = ['groups', 'profiles', 'tasks', 'logs', 'drafts'];
    if (!arrayKeys.every(key => isBoundedArray(value[key]))) return false;
    if (!isObject(value.moduleNotes) && value.moduleNotes !== undefined) return false;

    const settings = value.settings;
    if (settings.language !== 'vi' || !['demo', 'gemini', 'meta'].includes(settings.provider) ||
        !isText(settings.model, 120) || !Number.isFinite(settings.groupLimit) ||
        settings.groupLimit < 1 || settings.groupLimit > 10000 ||
        !Number.isFinite(settings.delay) || settings.delay < 0 || settings.delay > 86400) return false;
    if (!isText(value.prompts.share, 20000)) return false;

    if (!value.groups.every(group => isObject(group) &&
      isText(group.id, 100) && group.id.length > 0 &&
      isText(group.name, 200) && group.name.trim().length > 0 &&
      isSafeFacebookGroupUrl(group.url) && typeof group.selected === 'boolean')) return false;

    if (!value.profiles.every(profile => isObject(profile) &&
      isText(profile.id, 100) && isText(profile.name, 200) &&
      ['demo', 'gemini', 'meta'].includes(profile.provider) &&
      (profile.model === undefined || isText(profile.model, 120)) &&
      (profile.prompt === undefined || isText(profile.prompt, 20000)))) return false;
    if (!value.tasks.every(task => isObject(task) &&
      isText(task.id, 100) && isText(task.name, 200) &&
      isText(task.time, 100) &&
      (task.status === undefined || ['scheduled', 'due', 'done', 'missed'].includes(task.status)))) return false;
    if (!value.logs.every(log => isObject(log) &&
      isText(log.at, 100) && isText(log.message, 2000))) return false;
    if (!value.drafts.every(draft => isObject(draft) &&
      isText(draft.id, 100) && isText(draft.text, 20000) &&
      isText(draft.url, 2048) && isText(draft.createdAt, 100))) return false;
    if (value.moduleNotes && !Object.entries(value.moduleNotes).every(entry =>
      isText(entry[0], 80) && isText(entry[1], 2000))) return false;
    return true;
  }

  function fillPrompt(template, variables) {
    const source = String(template == null ? '' : template);
    const values = variables || {};
    return source.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key) => {
      return values[key] == null ? match : String(values[key]);
    });
  }

  function toCsv(rows) {
    return rows.map(row => row.map(value => {
      let text = String(value == null ? '' : value);
      if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }

  return { createDefaultState, escapeHtml, isSafeFacebookGroupUrl, isValidState, fillPrompt, toCsv };
});
