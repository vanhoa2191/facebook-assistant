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
      settings: { language: 'vi', speed: 'normal', provider: 'meta', model: '', groupLimit: 10, delay: 0, pageId: '', graphVersion: 'v26.0' },
      groups: [],
      contacts: [],
      observations: [],
      weeklyReports: [],
      profiles: [],
      tasks: [],
      logs: [],
      drafts: [],
      pageSchedules: [],
      engagementItems: [],
      moduleNotes: {},
      prompts: {
        share: 'Viết lời dẫn ngắn, tự nhiên, phù hợp với {groupName}, dựa trên nội dung: {postText}. Không thêm thông tin chưa được xác minh.',
        general: 'Bạn là trợ lý biên tập. Hãy viết rõ ràng, tự nhiên, đúng ngữ cảnh. Không bịa dữ kiện. Nội dung đầu vào: {content}',
        connect: 'Soạn lời mời kết nối ngắn gọn, lịch sự, cá nhân hóa dựa trên thông tin đã cung cấp. Không bịa mối quan hệ và không tự gửi lời mời: {content}',
        comment: 'Soạn một bình luận hữu ích, lịch sự cho ngữ cảnh sau: {content}',
        sales: 'Viết bài giới thiệu sản phẩm rõ lợi ích, không phóng đại hoặc thêm dữ kiện chưa cung cấp: {content}',
        feed: 'Tạo một bản tin ngắn dựa hoàn toàn trên thông tin được cung cấp: {content}',
        summary: 'Tóm tắt các ý chính, không thêm thông tin ngoài nguồn: {content}',
        profileAnalysis: 'Phân tích nội dung được cung cấp trong ngữ cảnh. Nêu chủ đề chính, sắc thái và quan điểm được thể hiện trực tiếp, vấn đề lặp lại và mức độ tương tác chỉ khi có số liệu. Không suy đoán thuộc tính nhạy cảm hoặc thông tin cá nhân không được nêu trực tiếp. Phân biệt dữ kiện với nhận định và nêu rõ giới hạn của nguồn. Nội dung: {content}'
      }
    };
  }

  function migrateState(value) {
    const defaults = createDefaultState();
    if (!isObject(value)) return value;
    const migrated = {
      ...defaults,
      ...value,
      settings: { ...defaults.settings, ...(isObject(value.settings) ? value.settings : {}) },
      prompts: { ...defaults.prompts, ...(isObject(value.prompts) ? value.prompts : {}) },
      moduleNotes: isObject(value.moduleNotes) ? value.moduleNotes : {}
    };
    if (Array.isArray(value.tasks)) {
      migrated.tasks = value.tasks.map(task => isObject(task) && !task.status
        ? { ...task, status: 'scheduled' } : task);
    }
    if (Array.isArray(value.drafts)) {
      migrated.drafts = value.drafts.map(draft => {
        if (!isObject(draft)) return draft;
        const next = { ...draft };
        if (!next.reviewStatus) next.reviewStatus = 'draft';
        if (next.pageLink === undefined && ['scheduled', 'published'].includes(next.reviewStatus) &&
            next.pageId && next.postId) next.pageLink = next.url || '';
        return next;
      });
    }
    if (migrated.settings.provider === 'demo') migrated.settings.provider = 'meta';
    const groupLimit = Number(migrated.settings.groupLimit);
    migrated.settings.groupLimit = Number.isFinite(groupLimit) ? Math.min(10, Math.max(1, Math.floor(groupLimit))) : 10;
    const delay = Number(migrated.settings.delay);
    migrated.settings.delay = Number.isFinite(delay) ? Math.min(5, Math.max(0, Math.floor(delay))) : 0;
    return migrated;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
    });
  }

  function isSafeFacebookUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) return false;
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const facebookHosts = ['facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com'];
      return url.protocol === 'https:' && !url.port && facebookHosts.includes(host) &&
        !url.username && !url.password;
    } catch (_) {
      return false;
    }
  }

  function isSafeHttpsUrl(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2048) return false;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
    } catch (_) {
      return false;
    }
  }

  function isSafeFacebookGroupUrl(value) {
    if (!isSafeFacebookUrl(value)) return false;
    try {
      return /^\/groups\/[^/]+(?:\/|$)/i.test(new URL(value).pathname);
    } catch (_) {
      return false;
    }
  }


  function isBoundedArray(value) {
    return Array.isArray(value) && value.length <= MAX_ITEMS;
  }

  function isValidState(value) {
    if (!isObject(value) || !isObject(value.settings) || !isObject(value.prompts)) return false;
    const arrayKeys = ['groups', 'contacts', 'observations', 'weeklyReports', 'profiles', 'tasks', 'logs', 'drafts', 'pageSchedules', 'engagementItems'];
    if (!arrayKeys.every(key => isBoundedArray(value[key]))) return false;
    if (!isObject(value.moduleNotes) && value.moduleNotes !== undefined) return false;

    const settings = value.settings;
    if (settings.language !== 'vi' || !['demo', 'gemini', 'meta'].includes(settings.provider) ||
        !isText(settings.model, 120) || !Number.isFinite(settings.groupLimit) ||
        settings.groupLimit < 1 || settings.groupLimit > 10 ||
        !Number.isFinite(settings.delay) || settings.delay < 0 || settings.delay > 5 ||
        (settings.pageId !== undefined && settings.pageId !== '' && !/^[0-9]{5,30}$/.test(settings.pageId)) ||
        (settings.graphVersion !== undefined && !/^v[0-9]{1,2}\.0$/.test(settings.graphVersion))) return false;
    if (!isText(value.prompts.share, 20000) || !Object.entries(value.prompts).every(([key, prompt]) =>
      isText(key, 80) && isText(prompt, 20000))) return false;

    if (!value.groups.every(group => isObject(group) &&
      isText(group.id, 100) && group.id.length > 0 &&
      isText(group.name, 200) && group.name.trim().length > 0 &&
      isSafeFacebookGroupUrl(group.url) && typeof group.selected === 'boolean')) return false;
    if (value.observations.length > 1000 || value.weeklyReports.length > 104) return false;
    if (!value.contacts.every(contact => isObject(contact) &&
      isText(contact.id, 100) && contact.id.length > 0 &&
      isText(contact.name, 200) && contact.name.trim().length > 0 &&
      isSafeFacebookUrl(contact.url) && isText(contact.note, 1000) &&
      ['new', 'opened', 'request_sent', 'connected', 'follow_up', 'declined'].includes(contact.status) &&
      isText(contact.createdAt, 100) &&
      (contact.updatedAt === undefined || isText(contact.updatedAt, 100)))) return false;
    if (!value.observations.every(item => isObject(item) &&
      isText(item.id, 100) && item.id.length > 0 &&
      isSafeFacebookUrl(item.sourceUrl) &&
      isText(item.capturedAt, 100) && Number.isFinite(Date.parse(item.capturedAt)) &&
      isText(item.text, 50000) && item.text.trim().length > 0 &&
      (item.contactId === undefined || isText(item.contactId, 100)) &&
      (item.contactName === undefined || isText(item.contactName, 200)) &&
      (item.author === undefined || isText(item.author, 200)) &&
      (item.visibleArticleCount === undefined || (Number.isInteger(item.visibleArticleCount) && item.visibleArticleCount >= 0 && item.visibleArticleCount <= 100)) &&
      (item.analysisText === undefined || isText(item.analysisText, 20000)) &&
      (item.analysisAt === undefined || (isText(item.analysisAt, 100) && Number.isFinite(Date.parse(item.analysisAt)))))) return false;
    if (!value.weeklyReports.every(report => isObject(report) &&
      isText(report.id, 100) && report.id.length > 0 &&
      isText(report.periodStart, 100) && Number.isFinite(Date.parse(report.periodStart)) &&
      isText(report.periodEnd, 100) && Number.isFinite(Date.parse(report.periodEnd)) &&
      isText(report.createdAt, 100) && Number.isFinite(Date.parse(report.createdAt)) &&
      isText(report.summary, 20000) &&
      (report.aiSummary === undefined || isText(report.aiSummary, 20000)) &&
      Number.isInteger(report.observationsCount) && report.observationsCount >= 0 && report.observationsCount <= 1000 &&
      Number.isInteger(report.profilesCount) && report.profilesCount >= 0 && report.profilesCount <= 1000 &&
      Number.isInteger(report.previousObservationsCount) && report.previousObservationsCount >= 0 && report.previousObservationsCount <= 1000 &&
      (report.aiSummaryAt === undefined || (isText(report.aiSummaryAt, 100) && Number.isFinite(Date.parse(report.aiSummaryAt)))))) return false;
    if (!value.engagementItems.every(item => isObject(item) &&
      isText(item.id, 100) && item.id.length > 0 &&
      isText(item.name, 200) && item.name.trim().length > 0 &&
      isSafeFacebookUrl(item.url) &&
      ['like', 'love', 'support', 'comment', 'reply', 'followup'].includes(item.kind) &&
      isText(item.note, 1000) &&
      ['pending', 'done'].includes(item.status) &&
      isText(item.createdAt, 100))) return false;

    if (!value.profiles.every(profile => isObject(profile) &&
      isText(profile.id, 100) && isText(profile.name, 200) &&
      ['demo', 'gemini', 'meta'].includes(profile.provider) &&
      (profile.model === undefined || isText(profile.model, 120)) &&
      (profile.prompt === undefined || isText(profile.prompt, 20000)))) return false;
    if (!value.tasks.every(task => isObject(task) &&
      isText(task.id, 100) && isText(task.name, 200) &&
      isText(task.time, 100) && Number.isFinite(Date.parse(task.time)) &&
      (task.status === undefined || ['scheduled', 'due', 'done', 'missed'].includes(task.status)) &&
      (task.draftId === undefined || isText(task.draftId, 100)))) return false;
    if (!value.logs.every(log => isObject(log) &&
      isText(log.at, 100) && isText(log.message, 2000))) return false;
    if (!value.pageSchedules.every(item => isObject(item) &&
      isText(item.id, 100) && item.id.length > 0 &&
      isText(item.pageId, 30) && /^[0-9]{5,30}$/.test(item.pageId) &&
      isText(item.message, 60000) && item.message.trim().length > 0 &&
      isText(item.link, 2048) &&
      (!item.link || isSafeHttpsUrl(item.link)) &&
      isText(item.scheduledAt, 100) && Number.isFinite(Date.parse(item.scheduledAt)) &&
      isText(item.createdAt, 100) && Number.isFinite(Date.parse(item.createdAt)) &&
      (item.status === undefined || item.status === 'scheduled'))) return false;
    if (!value.drafts.every(draft => isObject(draft) &&
      isText(draft.id, 100) && isText(draft.text, 20000) &&
      isText(draft.url, 2048) && (!draft.url || isSafeHttpsUrl(draft.url)) &&
      (draft.pageLink === undefined || (isText(draft.pageLink, 2048) && (!draft.pageLink || isSafeHttpsUrl(draft.pageLink)))) &&
      (draft.sourceUrl === undefined || (isText(draft.sourceUrl, 2048) && (!draft.sourceUrl || isSafeHttpsUrl(draft.sourceUrl)))) &&
      isText(draft.createdAt, 100) &&
      (draft.kind === undefined || ['source', 'share', 'ai'].includes(draft.kind)) &&
      (draft.targetGroupId === undefined || isText(draft.targetGroupId, 100)) &&
      (draft.targetGroupName === undefined || isText(draft.targetGroupName, 200)) &&
      (draft.targetGroupUrl === undefined || isSafeFacebookGroupUrl(draft.targetGroupUrl)) &&
      (draft.updatedAt === undefined || isText(draft.updatedAt, 100)) &&
      (draft.reviewStatus === undefined || ['draft', 'approved', 'rejected', 'scheduled', 'published', 'failed'].includes(draft.reviewStatus)) &&
      (draft.approvedAt === undefined || isText(draft.approvedAt, 100)) &&
      (draft.publishedAt === undefined || isText(draft.publishedAt, 100)) &&
      (draft.scheduledAt === undefined || isText(draft.scheduledAt, 100)) &&
      (draft.postId === undefined || isText(draft.postId, 100)) &&
      (draft.pageId === undefined || (isText(draft.pageId, 30) && /^[0-9]{5,30}$/.test(draft.pageId))) &&
      (draft.publishError === undefined || isText(draft.publishError, 1000)) &&
      (draft.rejectionReason === undefined || isText(draft.rejectionReason, 500)))) return false;
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
    let closedQuote = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"') {
          if (input[i + 1] === '"') { field += '"'; i += 1; }
          else { quoted = false; closedQuote = true; }
        } else field += ch;
      } else if (closedQuote) {
        if (ch === ',') { row.push(field); field = ''; closedQuote = false; }
        else if (ch === '\r' || ch === '\n') {
          if (ch === '\r' && input[i + 1] === '\n') i += 1;
          row.push(field); field = ''; closedQuote = false;
          if (row.some(value => value.length) || rows.length === 0) rows.push(row);
          row = [];
          if (rows.length > 10001) throw new Error('CSV có quá nhiều dòng.');
        } else if (ch === ' ' || ch === '\t') {
          continue;
        } else throw new Error('CSV có ký tự sau dấu ngoặc kép đóng.');
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

  function buildWeeklyReport(state, nowValue) {
    const now = Number.isFinite(nowValue) ? nowValue : Date.now();
    const periodEnd = new Date(now);
    const periodStart = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const previousStart = new Date(now - 14 * 24 * 60 * 60 * 1000);
    const observations = Array.isArray(state && state.observations) ? state.observations : [];
    const current = observations.filter(item => {
      const time = Date.parse(item.capturedAt);
      return Number.isFinite(time) && time >= periodStart.getTime() && time <= now;
    });
    const previous = observations.filter(item => {
      const time = Date.parse(item.capturedAt);
      return Number.isFinite(time) && time >= previousStart.getTime() && time < periodStart.getTime();
    });
    const groups = new Map();
    for (const item of current) {
      const key = String(item.contactId || item.contactName || 'unassigned');
      const label = String(item.contactName || (item.contactId ? 'Hồ sơ ' + item.contactId : 'Chưa gán hồ sơ')).slice(0, 200);
      const entry = groups.get(key) || { label, count: 0 };
      entry.count += 1;
      groups.set(key, entry);
    }
    const ordered = Array.from(groups.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const delta = current.length - previous.length;
    const trend = delta > 0 ? 'tăng ' + delta + ' quan sát' : delta < 0 ? 'giảm ' + Math.abs(delta) + ' quan sát' : 'không đổi';
    const profileSummary = ordered.length
      ? ordered.slice(0, 10).map(item => item.label + ': ' + item.count).join('; ')
      : 'Chưa có hồ sơ được gán';
    const summary = current.length
      ? 'Báo cáo 7 ngày (' + periodStart.toLocaleDateString('vi-VN') + ' – ' + periodEnd.toLocaleDateString('vi-VN') + '): ' + current.length + ' quan sát từ ' + groups.size + ' hồ sơ/nhóm định danh; ' + trend + ' so với 7 ngày trước (' + previous.length + ' quan sát). Phân bổ: ' + profileSummary + '. Báo cáo chỉ dựa trên nội dung người dùng chủ động thu thập và không suy đoán thuộc tính nhạy cảm.'
      : 'Báo cáo 7 ngày (' + periodStart.toLocaleDateString('vi-VN') + ' – ' + periodEnd.toLocaleDateString('vi-VN') + '): chưa có quan sát nào trong kỳ. Có ' + previous.length + ' quan sát trong 7 ngày liền trước. Hãy mở một bài viết Facebook và chủ động thu thập nội dung hiển thị nếu bạn có quyền truy cập.';
    return {
      id: 'weekly-' + periodStart.toISOString().replace(/[:.]/g, '-'),
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      createdAt: periodEnd.toISOString(),
      observationsCount: current.length,
      profilesCount: groups.size,
      previousObservationsCount: previous.length,
      summary,
      aiSummary: ''
    };
  }

  return { createDefaultState, migrateState, escapeHtml, isSafeHttpsUrl, isSafeFacebookUrl, isSafeFacebookGroupUrl, isValidState, fillPrompt, parseCsv, toCsv, buildWeeklyReport };
});
