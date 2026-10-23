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
      isText(draft.url, 2048) && isText(draft.createdAt, 100) &&
      (draft.kind === undefined || ['source', 'share', 'ai'].includes(draft.kind)) &&
      (draft.targetGroupId === undefined || isText(draft.targetGroupId, 100)) &&
      (draft.targetGroupName === undefined || isText(draft.targetGroupName, 200)) &&
      (draft.targetGroupUrl === undefined || isSafeFacebookGroupUrl(draft.targetGroupUrl)) &&
      (draft.updatedAt === undefined || isText(draft.updatedAt, 100)))) return false;
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

  function parseCsv(input) {
    if (typeof input !== 'string' || input.length > 5000000) throw new Error('CSV không hợp lệ hoặc vượt quá 5 MB.');
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i += 1; }
          else quoted = false;
        } else field += ch;
      } else if (ch === '"') {
        if (field.length) throw new Error('CSV có dấu ngoặc kép không đúng vị trí.');
        quoted = true;
      } else if (ch === ',') {
        row.push(field); field = '';
      } else if (ch === '\r' || ch === '\n') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        row.push(field); field = '';
        if (row.some(value => value.length) || rows.length === 0) rows.push(row);
        row = [];
        if (rows.length > 10001) throw new Error('CSV có quá nhiều dòng.');
      } else field += ch;
    }
    if (quoted) throw new Error('CSV có dấu ngoặc kép chưa đóng.');
    if (field.length || row.length) {
      row.push(field);
      if (row.some(value => value.length)) rows.push(row);
    }
    if (rows.some(values => values.length > 20)) throw new Error('CSV có quá nhiều cột.');
    return rows;
  }

  function toCsv(rows) {
    return rows.map(row => row.map(value => {
      let text = String(value == null ? '' : value);
      if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
      return '"' + text.replace(/"/g, '""') + '"';
    }).join(',')).join('\r\n');
  }

  return { createDefaultState, escapeHtml, isSafeFacebookGroupUrl, isValidState, fillPrompt, parseCsv, toCsv };
});
