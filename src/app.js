'use strict';

(function () {
  const Core = window.FAACore;
  const Gemini = window.FAAAI;
  const Facebook = window.FAAFacebook;
  const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/*';
  const GEMINI_KEY = 'faa.geminiApiKey';
  const GRAPH_ORIGIN = 'https://graph.facebook.com/*';
  const PAGE_TOKEN_KEY = 'faa.facebookPageToken';
  const META_AI_ORIGINS = ['https://meta.ai/*', 'https://www.meta.ai/*'];
  const FACEBOOK_CAPTURE_ORIGINS = ['https://www.facebook.com/*', 'https://web.facebook.com/*', 'https://m.facebook.com/*'];
  const NAV = [
    ['connect', '♧', 'Kết bạn'], ['scrape', '▤', 'Cào bài'], ['groups', '♧', 'Nhóm'],
    ['pages', '⚑', 'Nuôi Page'], ['share', '↗', 'Share bài'], ['sales', '▣', 'Đăng bán'],
    ['learn', '▥', 'Học nhóm'], ['feed', '◉', 'Bản tin & AI'], ['engage', '♡', 'Lấy lại tương tác'],
    ['ai', '⚙', 'AI chung'], ['review', '✓', 'Duyệt bài'], ['analytics', '▥', 'Phân tích'], ['schedule', '▦', 'Lịch chạy'], ['logs', '▤', 'Nhật ký']
  ];
  const TITLES = {
    connect: 'Kết bạn', scrape: 'Cào bài', groups: 'Quản lý nhóm và tương tác', pages: 'Nuôi Page',
    share: 'Share bài vào nhóm đã tham gia', sales: 'Đăng bán', learn: 'Học nhóm',
    feed: 'Bản tin & AI', engage: 'Lấy lại tương tác', ai: 'Hồ sơ AI dùng chung',
    review: 'Hàng đợi duyệt bài', analytics: 'Phân tích & báo cáo', schedule: 'Lịch chạy', logs: 'Nhật ký'
  };
  const DESCS = {
    groups: 'Quản lý nhóm đã tham gia, lựa chọn nhóm và chuẩn bị nội dung.',
    ai: 'Cấu hình AI Provider, prompt và hồ sơ theo từng chức năng.',
    logs: 'Theo dõi thao tác, lỗi và xuất dữ liệu.',
    review: 'Kiểm tra, duyệt hoặc từ chối bản nháp trước khi đăng.',
    analytics: 'Theo dõi lịch sử quan sát, tổng hợp báo cáo 7 ngày và xuất CSV mở bằng Excel.',
    share: 'Chuẩn bị nội dung chia sẻ với lời dẫn theo từng nhóm.'
  };
  const $ = selector => document.querySelector(selector);
  const esc = Core.escapeHtml;
  let state = Core.createDefaultState();
  let page = 'groups';
  let toastTimer = null;
  let toastSequence = 0;
  let aiKeyPresent = false;
  let aiPermissionPresent = false;
  let aiOutput = '';
  let pageTokenPresent = false;
  let graphPermissionPresent = false;
  let metaWebPermissionPresent = false;
  let notificationPermissionPresent = false;
  let metaWebLastSuccess = false;
  let metaWebStatus = '';
  let pageComposerDraft = '';
  let pageComposerLink = '';
  let pageComposerSchedule = '';
  let activePageDraftId = null;
  let reviewStatusFilter = 'draft';
  let pagePublishStatus = '';
  let draftQuery = '';
  let draftKindFilter = 'all';

  function field(label, id, value, type) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(label) + '</label><input id="' + esc(id) + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"></div>';
  }
  function button(label, action, extra, id) {
    return '<button type="button" class="btn ' + (extra || '') + '" data-action="' + esc(action) + '"' +
      (id == null ? '' : ' data-id="' + esc(id) + '"') + '>' + esc(label) + '</button>';
  }
  function groupList() {
    if (!state.groups.length) return '<div class="placeholder">Chưa có nhóm. Thêm nhóm thủ công bằng tên và URL để bắt đầu.</div>';
    return '<div class="group-list">' + state.groups.map(group =>
      '<div class="group"><input type="checkbox" aria-label="Chọn ' + esc(group.name) + '" class="group-check" data-id="' + esc(group.id) + '" ' + (group.selected ? 'checked' : '') + '><span class="pill">Nhóm</span><span class="group-name">' + esc(group.name) + '</span>' +
      button('Mở', 'openGroup', '', group.id) + button('Xóa', 'deleteGroup', 'warn compact', group.id) + '</div>'
    ).join('') + '</div>';
  }

  function draftList(limit) {
    const drafts = state.drafts.slice().reverse().slice(0, limit || 10);
    if (!drafts.length) return '<div class="placeholder">Chưa có bản nháp.</div>';
    return '<div class="draft-list">' + drafts.map(draft =>
      '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><span class="pill">' + esc(reviewStatusLabel(draft.reviewStatus)) + '</span><time>' + esc(draft.createdAt) + '</time></div>' +
      (draft.targetGroupName ? '<div class="draft-target">Nhóm đích: ' + esc(draft.targetGroupName) + '</div>' : '') +
      '<p class="draft-text">' + esc(draft.text.slice(0, 700)) + (draft.text.length > 700 ? '…' : '') + '</p>' +
      '<div class="btnrow">' + button('Sao chép', 'copyDraft', '', draft.id) + button('Sửa', 'editDraft', '', draft.id) +
      (Core.isSafeHttpsUrl(draft.sourceUrl || draft.url) ? button('Mở liên kết', 'openDraftSource', '', draft.id) : '') +
      (draft.targetGroupUrl ? button('Mở nhóm', 'openDraftGroup', '', draft.id) : '') +
      button('Duyệt bài', 'reviewDraft', '', draft.id) + button('Dùng cho Page', 'useDraftForPage', '', draft.id) +
      button('Xóa', 'deleteDraft', 'warn', draft.id) + '</div></article>'
    ).join('') + '</div>';
  }


  function modulePromptKey() {
    return ({
      connect: 'connect',
      scrape: 'summary',
      pages: 'feed',
      sales: 'sales',
      learn: 'summary',
      feed: 'feed',
      engage: 'comment'
    })[page] || 'general';
  }

  function generic(title, description) {
    const note = state.moduleNotes[page] || '';
    const promptKey = modulePromptKey();
    const prompt = state.prompts[promptKey] || state.prompts.general || 'Hãy xử lý nội dung sau: {content}';
    const inputLabel = page === 'scrape' || page === 'learn'
      ? 'Nội dung bài viết / trao đổi bạn được phép sử dụng'
      : page === 'sales' ? 'Thông tin sản phẩm hoặc dịch vụ' : 'Yêu cầu hoặc nội dung đầu vào';
    const safetyNote = page === 'scrape' || page === 'learn'
      ? 'Dán nội dung bạn được phép truy cập. Extension không tự quét hoặc thu thập dữ liệu Facebook.'
      : page === 'connect'
        ? 'Chỉ tạo bản nháp tin nhắn. Extension không tự gửi lời mời kết bạn.'
        : page === 'pages'
          ? 'Dùng để lên ý tưởng và soạn nội dung. Chưa tự đăng lên Page.'
          : page === 'sales'
            ? 'Kiểm tra giá, đặc tính và tuyên bố sản phẩm trước khi sử dụng.'
            : page === 'engage'
              ? 'Bản nháp chỉ dùng để người dùng xem lại; không tự bình luận hoặc gửi tin nhắn.'
              : 'Nội dung được lưu thành bản nháp để xem lại.';
    return '<div class="grid"><section class="panel blue"><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p>' +
      '<div class="field"><label for="modulePrompt">Prompt</label><textarea id="modulePrompt" maxlength="20000">' + esc(prompt) + '</textarea></div>' +
      '<div class="field"><label for="moduleInput">' + esc(inputLabel) + '</label><textarea id="moduleInput" maxlength="20000" placeholder="Dán nội dung hoặc nhập yêu cầu..."></textarea></div>' +
      field(page === 'connect' ? 'Link hồ sơ Facebook (không gửi lời mời)' : page === 'scrape' ? 'Link bài viết Facebook (không tự cào)' : 'Link nguồn HTTPS (không bắt buộc)', 'moduleSourceUrl', '') +
      '<div class="btnrow">' + button(state.settings.provider === 'gemini' ? 'Tạo nháp bằng Gemini' : 'Tạo nháp bằng Meta AI Web', 'generateModuleDraft', 'primary') + button('Sao chép prompt', 'copyModulePrompt') + '</div>' +
      '<div class="field"><label for="moduleOutput">Kết quả từ Meta AI hoặc AI bên ngoài</label><textarea id="moduleOutput" maxlength="20000" placeholder="Dán kết quả AI đã tạo ở bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả AI thành nháp', 'saveModuleOutputDraft') + button('Lưu nội dung nguồn', 'saveModuleDraft') + '</div>' +
      '<div class="banner">' + esc(safetyNote) + ' Bạn có thể tạo trực tiếp bằng Meta AI Web sau khi cấp quyền, hoặc dùng sao chép/dán thủ công khi giao diện Meta AI thay đổi.</div><h3>Nháp gần đây</h3>' + draftList(4) +
      '</section><section class="panel blue"><h2>Ghi chú nghiệp vụ</h2><div class="field"><label for="moduleNote">Ghi chú nội bộ</label><textarea id="moduleNote" maxlength="2000" placeholder="Ghi yêu cầu cho module này...">' + esc(note) + '</textarea></div>' +
      button('Lưu ghi chú', 'saveNote', 'primary') + '</section></div>';
  }
  function facebookIdFromUrl(value) {
    if (!Core.isSafeFacebookUrl(value)) return '';
    try {
      const url = new URL(value);
      const queryId = url.searchParams.get('id') || url.searchParams.get('profile_id');
      if (queryId && /^[0-9]{1,30}$/.test(queryId)) return queryId;
      const match = url.pathname.match(/^\/(\d{1,30})(?:\/|$)/);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }
  function normalizeProfileUrl(value) {
    if (!Core.isSafeFacebookUrl(value)) return '';
    const facebookId = facebookIdFromUrl(value);
    if (facebookId) return 'facebook-id:' + facebookId;
    try {
      const url = new URL(value);
      return url.hostname.toLowerCase().replace(/^www\./, '') + url.pathname.replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }
  async function importContactsCsvFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (file.size > 5000000) { toast('Tệp CSV vượt quá 5 MB.'); event.target.value = ''; return; }
    try {
      const rows = Core.parseCsv((await file.text()).replace(/^\uFEFF/, ''));
      if (!rows.length) throw new Error('CSV trống.');
      const normalizeHeader = value => String(value || '').trim().toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
      const headers = rows[0].map(normalizeHeader);
      const findHeader = aliases => headers.findIndex(value => aliases.includes(value));
      const nameIndex = findHeader(['name', 'full name', 'profile name', 'ten', 'ho ten', 'ten nguoi', 'ten nguoi lien he']);
      const urlIndex = findHeader(['url', 'profile url', 'facebook url', 'link', 'duong dan', 'link ho so']);
      const idIndex = findHeader(['facebook id', 'profile id', 'id facebook', 'id', 'ma facebook']);
      const hasHeader = nameIndex >= 0 || urlIndex >= 0 || idIndex >= 0;
      const start = hasHeader ? 1 : 0;
      const ni = nameIndex >= 0 ? nameIndex : 0;
      const ui = urlIndex >= 0 ? urlIndex : 1;
      const ii = idIndex >= 0 ? idIndex : 2;
      state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
      let added = 0;
      let updated = 0;
      let skipped = 0;
      for (const row of rows.slice(start)) {
        let name = String(row[ni] || '').trim().slice(0, 200);
        let url = String(row[ui] || '').trim().slice(0, 2048);
        let facebookId = String(row[ii] || '').trim().slice(0, 100);
        if (facebookId && !/^[0-9]{1,30}$/.test(facebookId)) { skipped += 1; continue; }
        if (url && !Core.isSafeFacebookUrl(url)) { skipped += 1; continue; }
        if (!facebookId && url) facebookId = facebookIdFromUrl(url);
        if (!url && facebookId) url = 'https://www.facebook.com/profile.php?id=' + encodeURIComponent(facebookId);
        if (!url) { skipped += 1; continue; }
        if (!name) name = facebookId ? 'Facebook ID ' + facebookId : 'Hồ sơ Facebook';
        const urlKey = normalizeProfileUrl(url);
        let contact = state.contacts.find(item => urlKey && normalizeProfileUrl(item.url) === urlKey);
        if (!contact && facebookId) contact = state.contacts.find(item =>
          item.facebookId === facebookId || facebookIdFromUrl(item.url) === facebookId);
        // Name is only a fallback when neither side has a stable Facebook identity.
        // Never overwrite a different profile merely because the display names match.
        if (!contact && !facebookId && name) contact = state.contacts.find(item =>
          !item.facebookId && !facebookIdFromUrl(item.url) &&
          item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
        if (contact) {
          contact.name = name || contact.name;
          contact.url = url;
          if (facebookId) contact.facebookId = facebookId;
          contact.updatedAt = new Date().toISOString();
          updated += 1;
        } else {
          if (state.contacts.length >= 1000) { skipped += 1; continue; }
          state.contacts.push({
            id: crypto.randomUUID(), name, url, facebookId,
            note: 'Nhập từ danh sách đối chiếu CSV',
            status: 'new', createdAt: new Date().toISOString()
          });
          added += 1;
        }
      }
      log('Đối chiếu liên hệ CSV: thêm ' + added + ', cập nhật ' + updated + ', bỏ qua ' + skipped + '.');
      await save();
      render();
      toast('Đối chiếu xong: thêm ' + added + ', cập nhật ' + updated + ', bỏ qua ' + skipped + '.');
    } catch (error) {
      toast('Không thể nhập CSV: ' + error.message);
    } finally {
      event.target.value = '';
    }
  }

  function renderConnect() {
    const statusNames = { new: 'Chưa liên hệ', opened: 'Đã mở hồ sơ', request_sent: 'Đã gửi lời mời (đánh dấu thủ công)', connected: 'Đã kết nối', follow_up: 'Cần theo dõi', declined: 'Không tiếp tục' };
    const contacts = (state.contacts || []).slice().reverse();
    const list = contacts.length ? contacts.map(contact =>
      '<article class="draft"><div class="draft-meta"><strong>' + esc(contact.name) + '</strong><span class="pill">' + esc(statusNames[contact.status] || contact.status) + '</span></div>' +
      '<p class="draft-text">' + esc(contact.note || 'Chưa có ghi chú.') + '</p><small>' + esc(contact.url) + '</small>' +
      '<div class="btnrow">' + button('Mở hồ sơ', 'openContact', 'primary', contact.id) +
      (contact.status !== 'request_sent' ? button('Đã gửi lời mời', 'markContactSent', '', contact.id) : '') +
      (contact.status !== 'connected' ? button('Đã kết nối', 'markContactConnected', '', contact.id) : '') +
      (contact.status !== 'follow_up' ? button('Theo dõi lại', 'markContactFollowUp', '', contact.id) : '') +
      button('Không tiếp tục', 'markContactDeclined', '', contact.id) + button('Xóa', 'deleteContact', 'warn', contact.id) + '</div></article>'
    ).join('') : '<div class="placeholder">Chưa có hồ sơ nào. Thêm người cần liên hệ để theo dõi thủ công.</div>';
    const connectPrompt = state.prompts.connect || 'Soạn lời mời kết nối ngắn gọn, lịch sự dựa trên thông tin được cung cấp: {content}';
    return '<div class="grid"><section class="panel blue"><h2>Danh sách liên hệ</h2><p>Quản lý hồ sơ và trạng thái liên hệ thủ công</p>' +
      field('Tên người liên hệ', 'contactName', '') + field('URL hồ sơ Facebook', 'contactUrl', '') + field('Facebook ID (không bắt buộc)', 'contactFacebookId', '') +
      '<div class="field"><label for="contactNote">Ghi chú / lý do kết nối</label><textarea id="contactNote" maxlength="1000" placeholder="Bối cảnh, mối quan tâm chung, việc cần theo dõi..."></textarea></div>' +
      button('Thêm vào danh sách', 'addContact', 'primary full') +
      '<input id="contactImportFile" type="file" accept=".csv,text/csv" style="display:none">' +
      '<div class="btnrow">' + button('Nhập danh sách đối chiếu CSV', 'importContacts') + button('Xuất danh sách liên hệ CSV', 'exportContactsCsv') + '</div>' +
      '<div class="banner">Tệp Excel (.xlsx) cần được lưu thành CSV UTF-8 trước khi nhập. Đối chiếu ưu tiên URL/ID hồ sơ rồi mới đến tên.</div>' +
      '<div class="banner">Extension không tự gửi lời mời kết bạn. Mở hồ sơ và gửi lời mời thủ công trên Facebook; sau đó cập nhật trạng thái tại đây.</div></section>' +
      '<section class="panel purple"><h2>Soạn lời mời bằng AI</h2><p>Tạo lời mời lịch sự dựa trên thông tin bạn cung cấp. Không gửi tự động.</p>' +
      '<div class="field"><label for="modulePrompt">Prompt</label><textarea id="modulePrompt" maxlength="20000">' + esc(connectPrompt) + '</textarea></div>' +
      '<div class="field"><label for="moduleInput">Thông tin về người nhận và bối cảnh kết nối</label><textarea id="moduleInput" maxlength="20000" placeholder="Nêu thông tin công khai liên quan và lý do bạn muốn kết nối..."></textarea></div>' +
      field('URL hồ sơ tham chiếu (không bắt buộc)', 'moduleSourceUrl', '') +
      '<div class="btnrow">' + button(state.settings.provider === 'gemini' ? 'Soạn lời mời bằng Gemini' : 'Soạn lời mời bằng Meta AI Web', 'generateModuleDraft', 'primary') + button('Sao chép prompt', 'copyModulePrompt') + '</div>' +
      '<div class="field"><label for="moduleOutput">Kết quả AI bên ngoài (nếu cần)</label><textarea id="moduleOutput" maxlength="20000" placeholder="Dán lời mời đã tạo bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả AI thành nháp', 'saveModuleOutputDraft') + button('Lưu nội dung đầu vào', 'saveModuleDraft') + '</div>' +
      '<div class="banner">Kiểm tra thông tin và giọng điệu trước khi sử dụng. Extension không gửi lời mời, tin nhắn hoặc yêu cầu kết bạn.</div><h3>Nháp gần đây</h3>' + draftList(5) + '</section>' +
      '<section class="panel"><h2>Hồ sơ đã lưu</h2><p>' + contacts.length + ' liên hệ</p>' + list + '</section></div>';
  }
  function renderScrape() {
    const contacts = (state.contacts || []).slice().sort((a, b) => a.name.localeCompare(b.name));
    const contactOptions = '<option value="">Chưa gán hồ sơ</option>' + contacts.map(contact =>
      '<option value="' + esc(contact.id) + '">' + esc(contact.name) + '</option>'
    ).join('');
    const observations = (state.observations || []).slice().reverse();
    const cards = observations.length ? observations.slice(0, 30).map(item =>
      '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(item.contactName || 'Chưa gán hồ sơ') + '</span><time>' + esc(item.capturedAt) + '</time></div>' +
      '<p class="draft-text">' + esc(item.text.slice(0, 600)) + (item.text.length > 600 ? '…' : '') + '</p>' +
      (item.analysisText ? '<div class="banner"><strong>Phân tích AI:</strong> ' + esc(item.analysisText.slice(0, 700)) + (item.analysisText.length > 700 ? '…' : '') + '</div>' : '') +
      '<div class="btnrow">' + button(item.analysisText ? 'Phân tích lại' : 'Phân tích bằng AI', 'analyzeObservation', 'primary', item.id) +
      button('Mở nguồn', 'openObservationSource', '', item.id) + button('Xóa quan sát', 'deleteObservation', 'warn', item.id) + '</div></article>'
    ).join('') : '<div class="placeholder">Chưa có quan sát. Mở một bài viết Facebook riêng, rồi bấm nút thu thập để lưu phần đang hiển thị.</div>';
    return '<div class="grid"><section class="panel blue"><h2>Thu thập bài viết đang mở</h2><p>Chỉ đọc nội dung hiển thị của bài viết riêng mà bạn chủ động mở, gồm các bình luận/phản hồi đang được tải trên trang.</p>' +
      '<div class="field"><label for="observationContactId">Gán quan sát vào hồ sơ liên hệ</label><select id="observationContactId">' + contactOptions + '</select></div>' +
      button('Thu thập bài đang mở', 'captureCurrentFacebookPost', 'primary full') +
      '<div class="banner">Không quét toàn bộ bảng tin, không tự cuộn để tải thêm, không đọc cookie/token và không vượt qua quyền truy cập. Hãy mở bài viết riêng và tự tải các bình luận cần phân tích trước khi thu thập.</div>' +
      '<h3>Phân tích văn bản bạn cung cấp</h3><div class="field"><label for="modulePrompt">Prompt tóm tắt</label><textarea id="modulePrompt" maxlength="20000">' + esc(state.prompts.summary || 'Tóm tắt nội dung sau: {content}') + '</textarea></div>' +
      '<div class="field"><label for="moduleInput">Nội dung bài viết/bình luận</label><textarea id="moduleInput" maxlength="20000" placeholder="Dán nội dung bạn được phép xem..."></textarea></div>' +
      field('URL nguồn HTTPS (không bắt buộc)', 'moduleSourceUrl', '') +
      '<div class="btnrow">' + button(state.settings.provider === 'gemini' ? 'Tạo nháp tóm tắt bằng Gemini' : 'Tạo nháp tóm tắt bằng Meta AI Web', 'generateModuleDraft', 'primary') + button('Sao chép prompt', 'copyModulePrompt') + '</div>' +
      '<div class="field"><label for="moduleOutput">Kết quả AI bên ngoài (nếu cần)</label><textarea id="moduleOutput" maxlength="20000" placeholder="Dán kết quả AI..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả AI thành nháp', 'saveModuleOutputDraft') + button('Lưu nội dung nguồn', 'saveModuleDraft') + '</div></section>' +
      '<section class="panel"><h2>Lịch sử quan sát</h2><p>' + observations.length + ' quan sát đã lưu · ' + contacts.length + ' hồ sơ có thể gán</p>' + cards + '</section></div>';
  }

  function renderAnalytics() {
    const preview = Core.buildWeeklyReport(state, Date.now());
    const observations = (state.observations || []).slice().reverse();
    const reports = (state.weeklyReports || []).slice().reverse();
    const reportCards = reports.length ? reports.map(report =>
      '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(report.observationsCount + ' quan sát · ' + report.profilesCount + ' hồ sơ') + '</span><time>' + esc(report.createdAt) + '</time></div>' +
      '<p class="draft-text">' + esc(report.summary) + '</p>' +
      (report.aiSummary ? '<div class="banner"><strong>Tóm tắt AI:</strong> ' + esc(report.aiSummary) + '</div>' : '') +
      '<div class="btnrow">' + button(report.aiSummary ? 'Tạo lại tóm tắt AI' : 'Tạo tóm tắt AI', 'generateWeeklyAiSummary', 'primary', report.id) +
      button('Xuất báo cáo CSV', 'exportWeeklyReport', '', report.id) + button('Xóa báo cáo', 'deleteWeeklyReport', 'warn', report.id) + '</div></article>'
    ).join('') : '<div class="placeholder">Chưa có báo cáo. Có thể tạo báo cáo thống kê ngay cả khi kỳ hiện tại chưa có dữ liệu.</div>';
    return '<div class="grid"><section class="panel blue"><h2>Phân tích & báo cáo 7 ngày</h2><p>Báo cáo định kỳ chạy cục bộ; tóm tắt AI chỉ gửi dữ liệu đi khi bạn chủ động bấm nút.</p>' +
      '<div class="metric"><div><small>Quan sát đang lưu</small><span>' + observations.length + '</span></div><div><small>Hồ sơ đã gán</small><span>' + new Set(observations.map(item => item.contactId || item.contactName).filter(Boolean)).size + '</span></div><div><small>Báo cáo đã lưu</small><span>' + reports.length + '</span></div><div><small>Kỳ gần nhất</small><span>' + preview.observationsCount + '</span></div></div>' +
      '<div class="banner">' + esc(preview.summary) + '</div>' +
      '<div class="btnrow">' + button('Tổng hợp ngay bằng AI', 'summarizeNow', 'primary') + button('Tạo báo cáo thống kê', 'createWeeklyReportNow') + '</div>' +
      '<div class="btnrow">' + button('Xuất báo cáo CSV (Excel)', 'exportWeeklyReportsCsv') + button('Xuất lịch sử quan sát CSV (Excel)', 'exportObservationsCsv') + '</div>' +
      '<div class="banner">Báo cáo tự động hàng tuần chỉ tổng hợp số liệu và nội dung đã lưu. Để phân tích sắc thái/quan điểm theo ngữ cảnh, hãy dùng nút AI; không suy đoán thuộc tính nhạy cảm.</div></section>' +
      '<section class="panel"><h2>Báo cáo đã tạo</h2>' + reportCards + '</section>' +
      '<section class="panel"><h2>Quan sát gần đây</h2>' + (observations.slice(0, 10).map(item =>
        '<div class="task"><div><strong>' + esc(item.contactName || 'Chưa gán hồ sơ') + '</strong><time>' + esc(item.capturedAt) + '</time><p class="task-draft">' + esc(item.text.slice(0, 140)) + '</p></div>' +
        button('Mở nguồn', 'openObservationSource', 'primary', item.id) + '</div>'
      ).join('') || '<div class="placeholder">Chưa có dữ liệu.</div>') + '</section></div>';
  }

  function renderGroups() {
    const kindNames = { like: 'Thích', love: 'Yêu thích', support: 'Ủng hộ', comment: 'Bình luận', reply: 'Trả lời', followup: 'Theo dõi lại' };
    const engagementList = (state.engagementItems || []).slice().reverse().slice(0, 8);
    const engagementHtml = engagementList.length
      ? engagementList.map(item => '<div class="log"><strong>' + esc(item.name) + '</strong> <span class="pill">' + esc(kindNames[item.kind] || item.kind) + '</span> <span class="pill">' + (item.status === 'done' ? 'Đã xử lý' : 'Chờ xử lý') + '</span>' +
          '<p>' + esc(item.note || '') + '</p><div class="btnrow">' + button('Mở bài', 'openEngagement', '', item.id) +
          button(item.status === 'done' ? 'Đánh dấu chờ' : 'Đánh dấu xong', 'toggleEngagement', '', item.id) +
          button('Xóa', 'deleteEngagement', 'warn', item.id) + '</div></div>').join('')
      : '<div class="placeholder">Chưa có mục nào. Thêm URL để theo dõi và xử lý thủ công.</div>';
    return '<div class="grid four">' +
      '<section class="panel"><h2>Quản lý nhóm</h2><p>Danh sách nhóm do bạn nhập thủ công</p><div class="metric"><div><small>Tổng nhóm</small>' + state.groups.length + '</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div>' +
      groupList() + '<div class="btnrow">' + button('Mở nhóm đã chọn (theo cấu hình)', 'openSelectedGroups') + button('Chọn tất cả', 'selectAll') + button('Bỏ chọn', 'deselectAll') + '</div>' +
      '<div class="btnrow">' + button('Nhập CSV', 'importGroups') + button('Xuất CSV', 'exportGroups') + '</div>' +
      field('Số nhóm mỗi đợt (1–10)', 'groupLimit', state.settings.groupLimit, 'number') + field('Khoảng cách mở tab (0–5 giây)', 'delay', state.settings.delay, 'number') +
      '<div class="banner">Chỉ mở tab nhóm để bạn tự xem và thao tác. Extension không tự đăng, bình luận hoặc gửi lời mời.</div>' + button('Lưu cấu hình', 'saveSettings', 'primary full') + '</section>' +
      '<section class="panel"><h2>Theo dõi tương tác</h2><p>Danh sách thủ công để bạn tự mở bài và xử lý</p>' +
      field('Tên người / bài viết', 'engagementName', '') + field('URL Facebook', 'engagementUrl', '') +
      '<div class="field"><label for="engagementKind">Loại việc</label><select id="engagementKind">' +
      [['like','Thích'],['love','Yêu thích'],['support','Ủng hộ'],['comment','Bình luận'],['reply','Trả lời'],['followup','Theo dõi lại']].map(item => '<option value="' + item[0] + '">' + item[1] + '</option>').join('') +
      '</select></div>' + field('Ghi chú', 'engagementNote', '') + button('Thêm vào danh sách', 'addEngagement', 'primary full') +
      '<div class="banner">Chỉ theo dõi công việc thủ công. Extension không tự like, bình luận hoặc gửi tin nhắn.</div>' + engagementHtml + '</section>' +
      '<section class="panel"><h2>Bình luận AI</h2><p>Tạo nháp từ nội dung do bạn cung cấp</p><div class="metric"><div><small>Nháp AI</small>' + state.drafts.filter(d => d.kind === 'ai' || d.kind === 'share').length + '</div><div><small>Đã gửi</small>0</div></div>' +
      '<div class="placeholder">Dán ngữ cảnh ở module Lấy lại tương tác, tạo bình luận nháp rồi xem lại trước khi tự đăng.</div>' + button('Soạn bình luận AI', 'goEngage', 'primary full') + '</section>' +
      '<section class="panel"><h2>Thêm nhóm</h2><p>Nhập tên và URL nhóm Facebook</p>' + field('Tên nhóm', 'groupName', '') + field('URL nhóm Facebook', 'groupUrl', '') + button('Thêm nhóm vào danh sách', 'addGroup', 'primary full') + '<div class="banner">Chỉ thêm nhóm thủ công. Không tự tìm hoặc tham gia nhóm.</div></section></div>';
  }

  function renderAI() {
    const options = [['meta', 'Meta AI Web (giao diện trình duyệt, không API)'], ['gemini', 'Gemini API (tùy chọn)']];
    const prompt = state.prompts.general || 'Hãy biên tập nội dung sau, không thêm dữ kiện: {content}';
    return '<div class="grid"><section class="panel blue"><h2>Hồ sơ AI dùng chung</h2><p>Chọn AI mặc định cho các module soạn nội dung</p><div class="field"><label for="provider">AI Provider</label><select id="provider">' + options.map(o => '<option value="' + o[0] + '" ' + (state.settings.provider === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      field('Model Gemini (chỉ dùng khi chọn Gemini)', 'model', state.settings.model || 'gemini-2.5-flash') +
      '<div class="field"><label for="geminiApiKey">Gemini API key (không bắt buộc)</label><input id="geminiApiKey" type="password" maxlength="500" autocomplete="new-password" placeholder="Chỉ cần nếu chọn Gemini API"></div>' +
      '<div class="btnrow">' + button('Lưu khóa Gemini', 'saveGeminiKey', 'primary') + button('Xóa khóa Gemini', 'clearGeminiKey', 'warn') + '</div>' +
      '<div class="btnrow">' + button('Cấp quyền Gemini API', 'requestGeminiPermission') + button('Kiểm tra Gemini', 'testGemini') + '</div>' +
      '<div class="status-box"><span class="pill">' + (aiPermissionPresent ? 'Gemini đã được cấp quyền' : 'Gemini chưa cấp quyền') + '</span> <span class="pill">' + (aiKeyPresent ? 'Đã có khóa Gemini' : 'Chưa có khóa Gemini') + '</span></div>' +
      '<div class="banner">Meta AI Web là lựa chọn mặc định, không cần API key. Gemini là tùy chọn riêng. Chỉ gửi dữ liệu khi bạn bấm nút tạo nội dung.</div>' +
      '<h3>Meta AI Web — tự động qua giao diện trình duyệt</h3><p>Extension sẽ mở meta.ai, điền prompt, gửi trong cuộc trò chuyện đang mở và đọc câu trả lời để lưu thành nháp. Bạn cần đăng nhập Meta AI trước nếu được yêu cầu.</p>' +
      '<div class="status-box"><span class="pill">' + (metaWebPermissionPresent ? 'Đã cấp quyền Meta AI Web' : 'Chưa cấp quyền Meta AI Web') + '</span></div>' +
      '<div class="btnrow">' + button('Cấp quyền và mở Meta AI', 'requestMetaWebPermission', 'primary') + button('Mở Meta AI Web', 'openMetaAiWeb') + '</div>' +
      '<div class="field"><label for="metaWebPrompt">Prompt Meta AI Web — có thể dùng {content}</label><textarea id="metaWebPrompt" maxlength="20000">' + esc(prompt) + '</textarea></div>' +
      '<div class="field"><label for="metaWebInput">Nội dung / yêu cầu đầu vào</label><textarea id="metaWebInput" maxlength="20000" placeholder="Mô tả bài viết hoặc yêu cầu cho Meta AI..."></textarea></div>' +
      '<div class="btnrow">' + button('Gửi sang Meta AI Web và lưu nháp', 'generateMetaWebDraft', 'primary') + button('Sao chép prompt', 'copyMetaWebPrompt') + '</div>' +
      '<div class="placeholder output">' + esc(metaWebStatus || 'Chưa có kết quả Meta AI Web.') + '</div>' +
      '<h3>Hồ sơ theo chức năng</h3>' + (state.profiles.map(p => '<div class="log"><strong>' + esc(p.name) + '</strong> · ' + esc(p.provider) + (p.model ? ' · ' + esc(p.model) : '') + ' ' + button('Dùng hồ sơ', 'useProfile', 'primary compact', p.id) + ' ' + button('Xóa', 'deleteProfile', 'warn compact', p.id) + '</div>').join('') || '<div class="placeholder">Chưa có hồ sơ.</div>') +
      field('Tên hồ sơ mới', 'profileName', '') + button('Thêm hồ sơ', 'addProfile') +
      '</section><section class="panel purple"><h2>Soạn nội dung với AI</h2><p>Kết quả được lưu thành bản nháp để bạn duyệt</p>' +
      '<div class="field"><label for="aiPrompt">Prompt</label><textarea id="aiPrompt" maxlength="20000">' + esc(prompt) + '</textarea></div>' +
      '<div class="field"><label for="aiInput">Nội dung đầu vào</label><textarea id="aiInput" maxlength="20000" placeholder="Dán nội dung, chủ đề hoặc yêu cầu..."></textarea></div>' +
      '<div class="btnrow">' + button(state.settings.provider === 'gemini' ? 'Tạo nháp bằng Gemini' : 'Tạo nháp bằng Meta AI Web', 'generateAiDraft', 'primary') + button('Sao chép prompt', 'copyAiPrompt') + '</div>' +
      '<div class="field"><label for="aiExternalOutput">Kết quả AI bên ngoài (nếu cần)</label><textarea id="aiExternalOutput" maxlength="20000" placeholder="Có thể dán kết quả thủ công..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả thành nháp', 'saveExternalAiDraft') + button('Lưu nguyên văn đầu vào', 'saveAiDraft') + '</div>' +
      '<h3>Nháp gần đây</h3>' + draftList(5) + '</section></div>';
  }
  function renderReviewQueue() {
    const drafts = state.drafts.slice().reverse();
    const counts = {
      draft: drafts.filter(item => (item.reviewStatus || 'draft') === 'draft').length,
      approved: drafts.filter(item => item.reviewStatus === 'approved').length,
      scheduled: drafts.filter(item => item.reviewStatus === 'scheduled').length,
      published: drafts.filter(item => item.reviewStatus === 'published').length,
      rejected: drafts.filter(item => item.reviewStatus === 'rejected').length,
      failed: drafts.filter(item => item.reviewStatus === 'failed').length
    };
    const filtered = drafts.filter(item => reviewStatusFilter === 'all' || (item.reviewStatus || 'draft') === reviewStatusFilter);
    const cards = filtered.length ? filtered.map(draft => {
      const status = draft.reviewStatus || 'draft';
      const canReview = !['published', 'scheduled'].includes(status);
      return '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><span class="pill">' + esc(reviewStatusLabel(status)) + '</span><time>' + esc(draft.updatedAt || draft.createdAt) + '</time></div>' +
        (draft.targetGroupName ? '<div class="draft-target">Nhóm đích: ' + esc(draft.targetGroupName) + '</div>' : '') +
        (draft.pageLink ? '<div class="draft-target">Link đính kèm Page: ' + esc(draft.pageLink) + '</div>' : '') +
        (draft.publishError ? '<div class="banner">Lỗi lần đăng trước: ' + esc(draft.publishError) + '</div>' : '') +
        (draft.rejectionReason ? '<div class="banner">Lý do từ chối: ' + esc(draft.rejectionReason) + '</div>' : '') +
        '<p class="draft-text">' + esc(draft.text.slice(0, 1600)) + (draft.text.length > 1600 ? '…' : '') + '</p>' +
        (draft.postId ? '<small>Post ID: ' + esc(draft.postId) + (draft.pageId ? ' · Page ID: ' + esc(draft.pageId) : '') + '</small>' : '') +
        '<div class="btnrow">' + (Core.isSafeHttpsUrl(draft.sourceUrl || draft.url) ? button('Mở liên kết', 'openDraftSource', '', draft.id) : '') + button('Sao chép', 'copyDraft', '', draft.id) + (!['published', 'scheduled'].includes(status) ? button('Sửa', 'editDraft', '', draft.id) : '') +
        (canReview ? button(status === 'approved' ? 'Tiếp tục duyệt Page' : 'Duyệt & soạn Page', 'reviewDraft', 'primary', draft.id) : '') +
        (['draft', 'approved', 'failed'].includes(status) ? button('Từ chối', 'rejectDraft', 'warn', draft.id) : '') +
        (['rejected', 'failed'].includes(status) ? button('Đưa về chờ duyệt', 'reopenDraft', '', draft.id) : '') +
        button('Xóa', 'deleteDraft', 'warn', draft.id) + '</div></article>';
    }).join('') : '<div class="placeholder">Không có bản nháp ở trạng thái này.</div>';
    return '<section class="panel blue"><h2>Hàng đợi duyệt bài</h2><p>AI chỉ tạo bản nháp. Không bài nào được đăng khi chưa có thao tác duyệt riêng.</p>' +
      '<div class="metric"><div><small>Chờ duyệt</small><span>' + counts.draft + '</span></div><div><small>Đã duyệt</small><span>' + counts.approved + '</span></div><div><small>Đã lên lịch</small><span>' + counts.scheduled + '</span></div><div><small>Đã đăng</small><span>' + counts.published + '</span></div></div>' +
      '<div class="field"><label for="reviewStatusFilter">Lọc theo trạng thái</label><select id="reviewStatusFilter">' +
      [['draft','Chờ duyệt'],['approved','Đã duyệt · chờ đăng'],['failed','Đăng thất bại'],['scheduled','Đã lên lịch'],['published','Đã đăng'],['rejected','Đã từ chối'],['all','Tất cả']].map(item => '<option value="' + item[0] + '" ' + (reviewStatusFilter === item[0] ? 'selected' : '') + '>' + item[1] + '</option>').join('') +
      '</select></div><div class="btnrow">' + button('Áp dụng bộ lọc', 'filterReviewQueue', 'primary') + button('Hiện tất cả', 'clearReviewFilter') + '</div>' +
      '<div class="banner">Duyệt & soạn Page chỉ chuyển nội dung vào trình soạn. Bước đăng công khai vẫn yêu cầu bạn kiểm tra và xác nhận riêng. Nhóm Facebook vẫn phải đăng thủ công.</div>' +
      '<p>' + filtered.length + ' bản nháp · Từ chối: ' + counts.rejected + ' · Lỗi: ' + counts.failed + '</p><div class="draft-list">' + cards + '</div></section>';
  }
  function renderPages() {
    return '<div class="grid"><section class="panel blue"><h2>Đăng bài lên Facebook Page</h2><p>Sử dụng Meta Graph API chính thức với Page access token của bạn</p>' +
      field('Page ID (chỉ số)', 'pageId', state.settings.pageId || '') +
      field('Graph API version', 'graphVersion', state.settings.graphVersion || 'v26.0') +
      '<div class="field"><label for="pageToken">Page access token (chỉ lưu trong phiên Chrome)</label><input id="pageToken" type="password" maxlength="500" autocomplete="new-password" placeholder="Dán Page access token"></div>' +
      '<div class="btnrow">' + button('Lưu token trong phiên', 'savePageToken', 'primary') + button('Xóa token', 'clearPageToken', 'warn') + '</div>' +
      '<div class="btnrow">' + button('Cấp quyền Graph API', 'requestGraphPermission') + '</div>' +
      '<div class="status-box"><span class="pill">' + (graphPermissionPresent ? 'Đã cấp quyền Graph API' : 'Chưa cấp quyền Graph API') + '</span> <span class="pill">' + (pageTokenPresent ? 'Đã có token trong phiên' : 'Chưa lưu token') + '</span></div>' +
      '<div class="banner">Cần Page access token hợp lệ và quyền pages_manage_posts do Meta cấp cho ứng dụng của bạn. Token không được xuất ra file cấu hình hoặc ghi vào nhật ký. Khi đăng bài, nội dung được gửi tới Meta.</div>' +
      '<div class="field"><label for="pageAiBrief">Mô tả để Meta AI soạn bài</label><textarea id="pageAiBrief" maxlength="10000" placeholder="Mục tiêu, đối tượng, ý chính, ưu đãi..."></textarea></div>' +
      button('Soạn bài bằng Meta AI Web', 'generateMetaPageDraft', 'primary full') +
      '<div class="field"><label for="pageMessage">Nội dung bài viết — xem lại trước khi duyệt đăng</label><textarea id="pageMessage" maxlength="20000" placeholder="Kiểm tra kỹ nội dung trước khi đăng công khai...">' + esc(pageComposerDraft) + '</textarea></div>' +
      field('Link đính kèm (không bắt buộc, HTTPS)', 'pageLink', pageComposerLink) +
      field('Thời điểm đăng (để trống để đăng ngay)', 'pagePublishTime', pageComposerSchedule, 'datetime-local') +
      '<div class="btnrow">' + button('Lưu chỉnh sửa thành nháp', 'savePageDraft') + button('Đăng ngay / lên lịch trên Page', 'publishPagePost', 'primary') + '</div>' +
      '<div class="placeholder output">' + esc(pagePublishStatus || 'Chưa có kết quả đăng bài.') + '</div>' +
      '</section><section class="panel purple"><h2>Quy trình an toàn</h2><ol><li>Nhập Page ID và Page access token.</li><li>Cấp quyền truy cập Graph API khi Chrome hỏi.</li><li>Soạn bài và xem lại nội dung.</li><li>Xác nhận lần cuối trước khi đăng công khai.</li><li>Kiểm tra ID bài đăng trong nhật ký.</li></ol>' +
      '<div class="banner">Tích hợp này chỉ đăng lên Page được token cho phép. Không đăng lên trang cá nhân hoặc nhóm. Việc dùng API phụ thuộc vào quyền, cấu hình và xét duyệt ứng dụng Meta.</div>' +
      '<h3>Nháp gần đây</h3>' + draftList(5) + '</section></div>';
  }
  function renderShare() {
    return '<div class="grid"><section class="panel blue"><h2>Chia sẻ bài vào nhóm</h2><p>Tạo lời dẫn phù hợp với nhóm; chưa tự đăng</p>' +
      field('Link bài viết Facebook (không bắt buộc)', 'postUrl', '') +
      '<div class="field"><label for="sharePrompt">Prompt — dùng {postText} và {groupName}</label><textarea id="sharePrompt" maxlength="20000">' + esc(state.prompts.share) + '</textarea></div>' +
      '<div class="field"><label for="postText">Nội dung bài gốc</label><textarea id="postText" maxlength="20000" placeholder="Dán nội dung bạn được phép sử dụng"></textarea></div>' +
      '<div class="btnrow">' + button(state.settings.provider === 'gemini' ? 'Tạo lời dẫn bằng Gemini' : 'Tạo lời dẫn bằng Meta AI Web', 'generateShareDraft', 'primary') + button('Sao chép prompt', 'copySharePrompt') + '</div>' +
      '<div class="field"><label for="shareExternalOutput">Kết quả từ Meta AI hoặc AI bên ngoài</label><textarea id="shareExternalOutput" maxlength="20000" placeholder="Dán lời dẫn đã tạo ở bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả thành nháp chia sẻ', 'saveExternalShareDraft') + button('Lưu nội dung nguồn', 'saveShare') + '</div>' +
      '<div class="banner">Tạo tối đa 5 bản nháp mỗi lượt để kiểm soát chi phí AI. Mỗi bản nháp gắn với một nhóm; bạn cần tự xem lại và đăng thủ công.</div></section>' +
      '<section class="panel"><h2>Chọn nhóm nhận bài</h2>' + groupList() + button('Mở nhóm đã chọn (theo cấu hình)', 'openSelectedGroups') + ' ' + button('Chọn tất cả', 'selectAll') + ' ' + button('Bỏ chọn', 'deselectAll') +
      '<h3>Thư viện bản nháp</h3>' + draftList(10) + '</section></div>';
  }

  function renderSchedule() {
    const tasks = state.tasks.slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const statusText = { scheduled: 'Đã lên lịch nhắc', due: 'Đến hạn', done: 'Đã hoàn thành', missed: 'Đã bỏ qua' };
    const draftOptions = '<option value="">Không gắn bản nháp</option>' + state.drafts.slice().reverse().map(draft =>
      '<option value="' + esc(draft.id) + '">' + esc((draft.kind || 'source') + ' · ' + draft.text.slice(0, 70)) + '</option>'
    ).join('');
    const pageSchedules = (state.pageSchedules || []).slice().sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));
    return '<div class="grid"><section class="panel purple"><h2>Lịch nhắc việc</h2><p>Nhắc việc cục bộ bằng Chrome Alarms</p>' +
      '<div class="status-box"><span class="pill">' + (notificationPermissionPresent ? 'Đã bật thông báo trên máy' : 'Chưa cấp quyền thông báo') + '</span></div>' + button('Cấp quyền thông báo', 'requestNotificationPermission', 'primary') +
      field('Tên công việc', 'taskName', '') + field('Ngày giờ nhắc', 'taskTime', '', 'datetime-local') +
      '<div class="field"><label for="taskDraftId">Gắn bản nháp (không bắt buộc)</label><select id="taskDraftId">' + draftOptions + '</select></div>' +
      button('Lưu nhắc việc', 'addTask', 'primary full') + '<div class="banner">Nhắc việc chỉ nhắc người dùng; không tự thực thi hành động Facebook. Có thể gắn bản nháp để mở nhanh khi đến hạn.</div></section><section class="panel"><h2>Nhắc việc đã lưu</h2>' +
      (tasks.map(t => {
        const draft = t.draftId ? state.drafts.find(item => item.id === t.draftId) : null;
        return '<div class="task"><div><strong>' + esc(t.name) + '</strong><time>' + esc(t.time) + '</time><span class="pill">' + esc(statusText[t.status || 'scheduled'] || 'Đã lên lịch nhắc') + '</span>' +
          (draft ? '<p class="task-draft">Bản nháp: ' + esc(draft.text.slice(0, 100)) + '</p>' : '') + '</div><div class="btnrow">' +
          (draft ? button('Mở nháp', 'openTaskDraft', 'primary', t.id) : '') +
          (t.status === 'due' ? button('Hoàn thành', 'completeTask', 'primary', t.id) : '') + button('Xóa', 'deleteTask', 'warn', t.id) + '</div></div>';
      }).join('') || '<div class="placeholder">Chưa có nhắc việc.</div>') + '</section>' +
      '<section class="panel blue"><h2>Lịch đăng Facebook Page</h2><p>' + pageSchedules.length + ' lịch đã được Meta xác nhận nhận lịch</p>' +
      (pageSchedules.map(item => '<div class="task"><div><strong>' + esc(item.message.slice(0, 120)) + '</strong><time>' + esc(item.scheduledAt) + '</time><span class="pill">Đã gửi lịch tới Meta</span><small>Page ID: ' + esc(item.pageId) + ' · Post ID: ' + esc(item.id) + '</small></div>' +
        button('Mở Planner', 'openPagePlanner', 'primary', item.id) + '</div>').join('') || '<div class="placeholder">Chưa có lịch đăng Page do extension tạo.</div>') +
      '<div class="banner">Meta quản lý thời điểm xuất bản sau khi API xác nhận lịch. Danh sách này là bản ghi cục bộ, không phải trạng thái trực tiếp từ Meta.</div></section></div>';
  }
  function renderLogs() {
    const query = draftQuery.trim().toLowerCase();
    const filtered = state.drafts.slice().reverse().filter(draft => {
      const kind = draft.kind || 'source';
      const matchesKind = draftKindFilter === 'all' || kind === draftKindFilter;
      const matchesQuery = !query || draft.text.toLowerCase().includes(query) ||
        String(draft.targetGroupName || '').toLowerCase().includes(query) ||
        String(draft.url || '').toLowerCase().includes(query) || String(draft.sourceUrl || '').toLowerCase().includes(query);
      return matchesKind && matchesQuery;
    });
    const library = filtered.length
      ? '<div class="draft-list">' + filtered.map(draft =>
          '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><time>' + esc(draft.createdAt) + '</time></div>' +
          (draft.targetGroupName ? '<div class="draft-target">Nhóm đích: ' + esc(draft.targetGroupName) + '</div>' : '') +
          '<p class="draft-text">' + esc(draft.text.slice(0, 700)) + (draft.text.length > 700 ? '…' : '') + '</p>' +
          '<div class="btnrow">' + button('Sao chép', 'copyDraft', '', draft.id) + button('Sửa', 'editDraft', '', draft.id) +
          (Core.isSafeHttpsUrl(draft.sourceUrl || draft.url) ? button('Mở liên kết', 'openDraftSource', '', draft.id) : '') +
      (draft.targetGroupUrl ? button('Mở nhóm', 'openDraftGroup', '', draft.id) : '') +
          button('Xóa', 'deleteDraft', 'warn', draft.id) + '</div></article>'
        ).join('') + '</div>'
      : '<div class="placeholder">Không tìm thấy bản nháp phù hợp.</div>';
    return '<div class="grid"><section class="panel"><h2>Nhật ký hoạt động</h2><p>Lịch sử thao tác trong extension</p><div class="btnrow">' + button('Xuất nhật ký CSV', 'exportLogs', 'primary') + button('Xóa nhật ký', 'clearLogs', 'warn') + '</div>' +
      (state.logs.slice().reverse().map(log => '<div class="log"><time>' + esc(log.at) + '</time>' + esc(log.message) + '</div>').join('') || '<div class="placeholder">Chưa có nhật ký.</div>') +
      '</section><section class="panel blue"><h2>Thư viện bản nháp</h2><p>' + filtered.length + ' bản nháp phù hợp</p>' +
      '<div class="field"><label for="draftQuery">Tìm nội dung, nhóm hoặc URL</label><input id="draftQuery" value="' + esc(draftQuery) + '" maxlength="200" placeholder="Nhập từ khóa..."></div>' +
      '<div class="field"><label for="draftKindFilter">Loại bản nháp</label><select id="draftKindFilter">' +
      [['all','Tất cả'],['source','Nguồn'],['share','Chia sẻ'],['ai','AI']].map(item => '<option value="' + item[0] + '" ' + (draftKindFilter === item[0] ? 'selected' : '') + '>' + item[1] + '</option>').join('') +
      '</select></div><div class="btnrow">' + button('Tìm kiếm', 'filterDrafts', 'primary') + button('Xóa bộ lọc', 'clearDraftFilter') + '</div>' +
      '<div class="banner">Bản nháp chỉ được lưu cục bộ. Kiểm tra nội dung trước khi sao chép hoặc sử dụng bên ngoài.</div>' + library + '</section></div>';
  }
  function renderPage() {
    if (page === 'connect') return renderConnect();
    if (page === 'scrape') return renderScrape();
    if (page === 'analytics') return renderAnalytics();
    if (page === 'groups') return renderGroups();
    if (page === 'pages') return renderPages();
    if (page === 'review') return renderReviewQueue();
    if (page === 'ai') return renderAI();
    if (page === 'share') return renderShare();
    if (page === 'schedule') return renderSchedule();
    if (page === 'logs') return renderLogs();
    const descriptions = {
      connect: 'Quản lý ghi chú và yêu cầu cho quy trình kết nối; chưa gửi lời mời tự động.',
      scrape: 'Lưu yêu cầu phân tích nội dung mà bạn được phép truy cập.',
      pages: 'Tích hợp Page qua API và quyền chính thức khi được cấp phép.',
      sales: 'Chuẩn bị nội dung bán hàng và thư viện mẫu.',
      learn: 'Tóm tắt chủ đề và bài viết do người dùng cung cấp.',
      feed: 'Soạn nội dung và bình luận nháp có xác nhận.',
      engage: 'Theo dõi nội dung và tương tác được phép quản lý.'
    };
    return generic(TITLES[page], descriptions[page] || 'Module đang chuẩn bị triển khai.');
  }
  function updateConnectionStatus() {
    const status = $('#connectionStatus');
    if (!status) return;
    let aiStatus;
    if (state.settings.provider === 'gemini') {
      aiStatus = aiKeyPresent && aiPermissionPresent ? 'Gemini API đã cấu hình' : 'Gemini API chưa cấu hình';
    } else if (metaWebLastSuccess) {
      aiStatus = 'Meta AI Web hoạt động';
    } else if (metaWebPermissionPresent) {
      aiStatus = 'Meta AI Web đã cấp quyền';
    } else {
      aiStatus = 'Meta AI Web chưa kiểm tra';
    }
    const pageStatus = pageTokenPresent && graphPermissionPresent
      ? 'Facebook Page API đã cấu hình'
      : 'Facebook Page API chưa cấu hình';
    status.textContent = '● Chạy cục bộ · ' + aiStatus + ' · ' + pageStatus;
    status.title = 'Meta AI Web và Facebook Page API là hai kết nối riêng. Cấu hình Page API chưa có nghĩa token đã được xác minh với Meta.';
  }
  function render() {
    $('#sidebar').innerHTML = NAV.map(item =>
      '<button type="button" class="nav ' + (page === item[0] ? 'active' : '') + '" data-nav="' + item[0] + '"><span class="symbol" aria-hidden="true">' + item[1] + '</span><span>' + esc(item[2]) + '</span></button>'
    ).join('');
    $('#pageTitle').textContent = TITLES[page];
    $('#pageDesc').textContent = DESCS[page] || 'Module đang chuẩn bị kết nối và kiểm thử.';
    $('#view').innerHTML = renderPage();
    updateConnectionStatus();
  }
  function log(message) {
    state.logs.push({ at: new Date().toLocaleString('vi-VN'), message: String(message).slice(0, 2000) });
    if (state.logs.length > 500) state.logs.shift();
  }
  async function save() {
    await chrome.storage.local.set({ 'faa.state': state });
  }
  async function refreshAiStatus() {
    try {
      const stored = await chrome.storage.session.get([GEMINI_KEY, PAGE_TOKEN_KEY]);
      aiKeyPresent = typeof stored[GEMINI_KEY] === 'string' && stored[GEMINI_KEY].length > 0;
      pageTokenPresent = typeof stored[PAGE_TOKEN_KEY] === 'string' && stored[PAGE_TOKEN_KEY].length > 0;
      aiPermissionPresent = await chrome.permissions.contains({ origins: [GEMINI_ORIGIN] });
      graphPermissionPresent = await chrome.permissions.contains({ origins: [GRAPH_ORIGIN] });
      metaWebPermissionPresent = await chrome.permissions.contains({ permissions: ['scripting'], origins: META_AI_ORIGINS });
      notificationPermissionPresent = await chrome.permissions.contains({ permissions: ['notifications'] });
    } catch (_) {
      aiKeyPresent = false;
      pageTokenPresent = false;
      aiPermissionPresent = false;
      graphPermissionPresent = false;
      metaWebPermissionPresent = false;
      notificationPermissionPresent = false;
    }
  }
  function waitForTabReady(tabId, timeoutMs, label) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, tab) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        if (error) reject(error); else resolve(tab);
      };
      const onUpdated = (updatedId, changeInfo, tab) => {
        if (updatedId === tabId && changeInfo.status === 'complete') finish(null, tab);
      };
      const siteLabel = label || 'Trang';
      const timer = setTimeout(() => finish(new Error(siteLabel + ' chưa tải xong. Hãy kiểm tra tab và thử lại.')), timeoutMs || 45000);
      chrome.tabs.onUpdated.addListener(onUpdated);
      chrome.tabs.get(tabId).then(tab => {
        if (tab.status === 'complete') finish(null, tab);
      }).catch(() => {});
    });
  }

  async function ensureMetaAiWebTab() {
    const permission = await chrome.permissions.contains({ permissions: ['scripting'], origins: META_AI_ORIGINS });
    if (!permission) throw new Error('Hãy bấm “Cấp quyền và mở Meta AI” trước khi tự động gửi prompt.');
    let tabs = await chrome.tabs.query({ url: META_AI_ORIGINS });
    let tab = tabs.find(item => item.id != null && /^https:\/\/(www\.)?meta\.ai\//i.test(item.url || ''));
    if (!tab) {
      tab = await chrome.tabs.create({ url: 'https://www.meta.ai/' });
      tab = await waitForTabReady(tab.id, 45000, 'Meta AI Web');
    } else if (tab.status !== 'complete') {
      tab = await waitForTabReady(tab.id, 45000, 'Meta AI Web');
    }
    if (!tab || !tab.id || !/^https:\/\/(www\.)?meta\.ai\//i.test(tab.url || '')) {
      throw new Error('Tab chưa ở trên meta.ai. Hãy mở trang Meta AI chính thức rồi thử lại.');
    }
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/meta-ai-bridge.js'] });
    return tab.id;
  }

  async function generateWithMetaAiWeb(prompt) {
    if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 20000) {
      throw new Error('Prompt Meta AI phải có từ 1 đến 20.000 ký tự.');
    }
    const tabId = await ensureMetaAiWebTab();
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'FAA_META_AI_WEB_GENERATE',
      prompt: 'Xử lý yêu cầu sau như một tác vụ độc lập. Không tham chiếu hoặc dựa vào các yêu cầu trước trong cuộc trò chuyện nếu không được nêu lại.\n\n' + prompt.trim()
    });
    if (!response || !response.ok || typeof response.text !== 'string' || !response.text.trim()) {
      throw new Error(response && response.error || 'Không nhận được câu trả lời từ Meta AI Web.');
    }
    return response.text.trim().slice(0, 20000);
  }

  async function geminiRequest(prompt) {
    if (state.settings.provider !== 'gemini') { toast('Hãy chọn Gemini API trong Provider trước.'); return null; }
    if (!await chrome.permissions.contains({ origins: [GEMINI_ORIGIN] })) { toast('Hãy cấp quyền Gemini API trước khi gửi yêu cầu.'); return null; }
    const stored = await chrome.storage.session.get(GEMINI_KEY);
    const apiKey = stored[GEMINI_KEY];
    if (!apiKey) { toast('Hãy lưu Gemini API key trong phiên Chrome trước.'); return null; }
    const model = ($('#model') ? $('#model').value.trim() : '') || state.settings.model || 'gemini-2.5-flash';
    if (!/^[a-zA-Z0-9._:-]{1,100}$/.test(model)) { toast('Tên model không hợp lệ.'); return null; }
    state.settings.model = model;
    return Gemini.generateContent({ apiKey, model, prompt });
  }
  function addDraft(text, url, kind, group) {
    const draft = { id: crypto.randomUUID(), text: String(text).slice(0, 20000), url: String(url || '').slice(0, 2048), createdAt: new Date().toISOString(), kind: kind || 'source', reviewStatus: 'draft' };
    if (group) { draft.targetGroupId = group.id; draft.targetGroupName = group.name; draft.targetGroupUrl = group.url; }
    state.drafts.push(draft);
    if (state.drafts.length > 1000) state.drafts.shift();
    return draft;
  }
  function upsertWeeklyReport(report) {
    state.weeklyReports = Array.isArray(state.weeklyReports) ? state.weeklyReports : [];
    const index = state.weeklyReports.findIndex(item => item.id === report.id);
    if (index >= 0) {
      const previous = state.weeklyReports[index];
      // Rebuilding statistics must not erase an AI summary already saved for this report.
      if (!report.aiSummary && previous.aiSummary) report.aiSummary = previous.aiSummary;
      if (!report.aiSummaryAt && previous.aiSummaryAt) report.aiSummaryAt = previous.aiSummaryAt;
      state.weeklyReports[index] = report;
    } else state.weeklyReports.push(report);
    if (state.weeklyReports.length > 104) state.weeklyReports.splice(0, state.weeklyReports.length - 104);
    return report;
  }
  function weeklyAiPrompt(report) {
    const start = Date.parse(report.periodStart);
    const end = Date.parse(report.periodEnd);
    const observations = (state.observations || []).filter(item => {
      const time = Date.parse(item.capturedAt);
      return Number.isFinite(time) && time >= start && time <= end;
    }).slice(-20);
    const evidence = observations.map((item, index) =>
      '[' + (index + 1) + '] Thời gian: ' + item.capturedAt +
      '\nHồ sơ: ' + (item.contactName || 'Chưa gán hồ sơ') +
      '\nNguồn: ' + item.sourceUrl +
      '\nNội dung/quan sát: ' + item.text.slice(0, 1200) +
      (item.analysisText ? '\nPhân tích trước đó: ' + item.analysisText.slice(0, 600) : '')
    ).join('\n\n').slice(0, 18000);
    return Core.fillPrompt(state.prompts.profileAnalysis, {
      content: report.summary + '\n\nDữ liệu nguồn đã lưu trong kỳ (tối đa 20 quan sát gần nhất):\n' +
        (evidence || 'Không có nội dung nguồn trong kỳ.')
    });
  }
  function reviewStatusLabel(status) {
    return ({ draft: 'Chờ duyệt', approved: 'Đã duyệt · chờ đăng', rejected: 'Đã từ chối', scheduled: 'Đã lên lịch', published: 'Đã đăng', failed: 'Đăng thất bại' })[status || 'draft'] || 'Chờ duyệt';
  }
  function toast(message) {
    toastSequence += 1;
    const element = $('#toast');
    element.textContent = message;
    element.style.display = 'block';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { element.style.display = 'none'; }, 2600);
  }
  function download(name, content, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function action(name, id) {
    const toastSequenceAtStart = toastSequence;
    switch (name) {
      case 'saveSettings': {
        const groupLimit = Number($('#groupLimit') ? $('#groupLimit').value : state.settings.groupLimit);
        const delay = Number($('#delay') ? $('#delay').value : state.settings.delay);
        if (!Number.isFinite(groupLimit) || groupLimit < 1 || groupLimit > 10 ||
            !Number.isFinite(delay) || delay < 0 || delay > 5) {
          toast('Số nhóm mỗi đợt phải từ 1–10 và khoảng cách mở tab từ 0–5 giây.');
          return;
        }
        state.settings.groupLimit = Math.floor(groupLimit);
        state.settings.delay = Math.floor(delay);
        state.settings.provider = $('#provider') ? $('#provider').value : state.settings.provider;
        state.settings.model = $('#model') ? $('#model').value.trim().slice(0, 120) : state.settings.model;
        log('Đã lưu cấu hình');
        break;
      }
      case 'generateMetaPageDraft': {
        const brief = $('#pageAiBrief').value.trim();
        if (!brief || brief.length > 10000) { toast('Nhập mô tả bài viết cho Meta AI trước.'); return; }
        const prompt = 'Hãy viết một bài đăng Facebook Page bằng tiếng Việt dựa trên thông tin đã cung cấp. Không bịa dữ kiện, không tự thêm giá hoặc cam kết chưa được nêu. Viết rõ ràng, tự nhiên, có lời kêu gọi hành động phù hợp nhưng không gây hiểu lầm. Trả về chỉ nội dung bài đăng, không giải thích quy trình.\n\nThông tin đầu vào:\n' + brief;
        pagePublishStatus = 'Đang nhờ Meta AI Web soạn bản nháp...';
        try {
          const output = await generateWithMetaAiWeb(prompt);
          metaWebLastSuccess = true;
          pageComposerDraft = output;
          const pageDraft = addDraft(output, '', 'ai');
          activePageDraftId = pageDraft.id;
          pagePublishStatus = 'Meta AI đã tạo bản nháp. Hãy xem lại nội dung trong ô bài viết; chưa có gì được đăng.';
          log('Đã tạo bản nháp Page bằng Meta AI Web');
          await save();
          render();
          toast('Đã tạo nháp Page bằng Meta AI. Chưa đăng bài.');
        } catch (error) {
          pagePublishStatus = error.message;
          log('Soạn bài Page bằng Meta AI Web thất bại: ' + error.message);
          await save();
          render();
          toast(error.message);
        }
        return;
      }
      case 'filterReviewQueue':
        reviewStatusFilter = $('#reviewStatusFilter') ? $('#reviewStatusFilter').value : 'draft';
        render();
        return;
      case 'clearReviewFilter':
        reviewStatusFilter = 'all';
        render();
        return;
      case 'reviewDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp.'); return; }
        if (['published', 'scheduled'].includes(draft.reviewStatus)) { toast('Bản nháp này đã đăng hoặc đã lên lịch.'); return; }
        draft.reviewStatus = 'approved';
        draft.approvedAt = new Date().toISOString();
        draft.publishError = '';
        activePageDraftId = draft.id;
        pageComposerDraft = draft.text;
        pageComposerLink = draft.pageLink || '';
        pageComposerSchedule = '';
        pagePublishStatus = 'Bản nháp đã được duyệt sơ bộ. Hãy kiểm tra lần cuối trước khi đăng.';
        page = 'pages';
        log('Đã duyệt bản nháp để chuyển sang trình soạn Page: ' + draft.id);
        break;
      }
      case 'rejectDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp.'); return; }
        if (['published', 'scheduled'].includes(draft.reviewStatus)) { toast('Không thể từ chối nội dung đã đăng hoặc đã lên lịch.'); return; }
        const reason = window.prompt('Lý do từ chối (không bắt buộc):', '');
        if (reason === null) return;
        draft.reviewStatus = 'rejected';
        draft.approvedAt = '';
        draft.rejectionReason = String(reason).slice(0, 500);
        draft.updatedAt = new Date().toISOString();
        log('Đã từ chối bản nháp: ' + draft.id);
        break;
      }
      case 'reopenDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft || !['rejected', 'failed'].includes(draft.reviewStatus)) { toast('Bản nháp không ở trạng thái có thể mở lại.'); return; }
        draft.reviewStatus = 'draft';
        draft.publishError = '';
        draft.rejectionReason = '';
        draft.updatedAt = new Date().toISOString();
        log('Đã đưa bản nháp về trạng thái chờ duyệt: ' + draft.id);
        break;
      }
      case 'useDraftForPage': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp.'); return; }
        if (['published', 'scheduled'].includes(draft.reviewStatus)) { toast('Bản nháp này đã đăng hoặc đã lên lịch.'); return; }
        pageComposerDraft = draft.text;
        pageComposerLink = draft.pageLink || '';
        pageComposerSchedule = '';
        activePageDraftId = draft.id;
        draft.reviewStatus = 'approved';
        draft.approvedAt = new Date().toISOString();
        draft.publishError = '';
        page = 'pages';
        render();
        toast('Đã đưa bản nháp vào trình soạn Page. Hãy kiểm tra và duyệt trước khi đăng.');
        return;
      }
      case 'savePageToken': {
        const pageId = $('#pageId').value.trim();
        const token = $('#pageToken').value.trim();
        const version = $('#graphVersion').value.trim() || 'v26.0';
        if (!/^[0-9]{5,30}$/.test(pageId)) { toast('Page ID phải là dãy số hợp lệ.'); return; }
        if (token.length < 10 || token.length > 500) { toast('Page access token phải có từ 10 đến 500 ký tự.'); return; }
        if (!/^v[0-9]{1,2}\.0$/.test(version)) { toast('Phiên bản Graph API không hợp lệ, ví dụ v26.0.'); return; }
        await chrome.storage.session.set({ [PAGE_TOKEN_KEY]: token });
        state.settings.pageId = pageId;
        state.settings.graphVersion = version;
        pageTokenPresent = true;
        log('Đã lưu Page access token trong phiên Chrome');
        await save();
        render();
        toast('Đã lưu token tạm thời; token không được ghi vào nhật ký.');
        return;
      }
      case 'clearPageToken':
        await chrome.storage.session.remove(PAGE_TOKEN_KEY);
        pageTokenPresent = false;
        log('Đã xóa Page access token khỏi phiên Chrome');
        await save();
        render();
        toast('Đã xóa token khỏi phiên hiện tại');
        return;
      case 'requestGraphPermission': {
        const granted = await chrome.permissions.request({ origins: [GRAPH_ORIGIN] });
        graphPermissionPresent = granted;
        if (granted) log('Đã cấp quyền Facebook Graph API');
        await save();
        render();
        toast(granted ? 'Đã cấp quyền Graph API' : 'Chưa cấp quyền Graph API');
        return;
      }
      case 'savePageDraft': {
        const message = $('#pageMessage').value.trim();
        const link = $('#pageLink').value.trim();
        if (!message || message.length > 20000) { toast('Bản nháp phải có từ 1 đến 20.000 ký tự.'); return; }
        if (link && !Core.isSafeHttpsUrl(link)) { toast('Link phải là HTTPS hợp lệ, không chứa thông tin đăng nhập.'); return; }
        let draft = activePageDraftId ? state.drafts.find(item => item.id === activePageDraftId) : null;
        if (draft) {
          draft.text = message;
          draft.pageLink = link;
          draft.updatedAt = new Date().toISOString();
          draft.reviewStatus = 'draft';
          draft.approvedAt = '';
          draft.publishError = '';
        } else {
          draft = addDraft(message, '', 'ai');
          draft.pageLink = link;
          activePageDraftId = draft.id;
        }
        pageComposerDraft = message;
        pageComposerLink = link;
        pageComposerSchedule = '';
        log('Đã lưu nội dung Page thành bản nháp chờ duyệt: ' + draft.id);
        await save();
        render();
        toast('Đã lưu bản nháp. Chưa có nội dung nào được đăng.');
        return;
      }
      case 'publishPagePost': {
        const pageId = $('#pageId').value.trim();
        const version = $('#graphVersion').value.trim() || 'v26.0';
        const message = $('#pageMessage').value.trim();
        const link = $('#pageLink').value.trim();
        const scheduleValue = $('#pagePublishTime') ? $('#pagePublishTime').value : pageComposerSchedule;
        pageComposerLink = link;
        pageComposerSchedule = scheduleValue;
        let scheduledPublishAt = '';
        if (scheduleValue) {
          const scheduleDate = new Date(scheduleValue);
          const scheduleMs = scheduleDate.getTime();
          const now = Date.now();
          if (!Number.isFinite(scheduleMs)) { toast('Thời điểm đăng không hợp lệ.'); return; }
          if (scheduleMs < now + 10 * 60 * 1000) { toast('Hãy chọn thời điểm ít nhất 10 phút trong tương lai.'); return; }
          if (scheduleMs > now + 30 * 24 * 60 * 60 * 1000) { toast('Bản hiện tại chỉ cho phép lên lịch tối đa 30 ngày.'); return; }
          scheduledPublishAt = scheduleDate.toISOString();
        }
        if (!/^[0-9]{5,30}$/.test(pageId)) { toast('Nhập Page ID hợp lệ trước khi đăng.'); return; }
        if (!message || message.length > 20000) { toast('Nội dung bài viết phải có từ 1 đến 20.000 ký tự.'); return; }
        if (link) {
          let validLink = false;
          validLink = Core.isSafeHttpsUrl(link);
          if (!validLink) { toast('Link đính kèm phải là HTTPS hợp lệ.'); return; }
        }
        if (!/^v[0-9]{1,2}\.0$/.test(version)) { toast('Phiên bản Graph API không hợp lệ.'); return; }
        if (!await chrome.permissions.contains({ origins: [GRAPH_ORIGIN] })) { toast('Hãy cấp quyền Graph API trước khi đăng.'); return; }
        const stored = await chrome.storage.session.get(PAGE_TOKEN_KEY);
        const token = stored[PAGE_TOKEN_KEY];
        if (!token) { toast('Hãy lưu Page access token trong phiên Chrome trước.'); return; }
        const confirmText = scheduledPublishAt
          ? 'Bạn đang lên lịch đăng công khai lên Facebook Page ' + pageId + ' vào ' + scheduledPublishAt + '. Meta sẽ quản lý thời điểm đăng sau khi xác nhận. Tiếp tục?'
          : 'Bạn đang đăng công khai lên Facebook Page ' + pageId + '. Sau khi xác nhận, bài viết sẽ được gửi tới Meta. Tiếp tục?';
        if (!window.confirm(confirmText)) return;
        if (!activePageDraftId) {
          const draft = addDraft(message, '', 'source');
          draft.pageLink = link;
          activePageDraftId = draft.id;
          draft.reviewStatus = 'approved';
          draft.approvedAt = new Date().toISOString();
        }
        state.settings.pageId = pageId;
        state.settings.graphVersion = version;
        pageComposerDraft = message;
        try {
          const result = await Facebook.publishPagePost({ pageId, accessToken: token, message, link, version, scheduledPublishAt: scheduledPublishAt || undefined });
          if (result.scheduled) {
            state.pageSchedules = Array.isArray(state.pageSchedules) ? state.pageSchedules : [];
            state.pageSchedules.push({
              id: result.id, pageId, message, link,
              scheduledAt: result.scheduledAt || scheduledPublishAt,
              createdAt: new Date().toISOString(), status: 'scheduled'
            });
            if (state.pageSchedules.length > 500) state.pageSchedules.shift();
            if (activePageDraftId) {
              const draft = state.drafts.find(item => item.id === activePageDraftId);
              if (draft) { draft.text = message; draft.pageLink = link; draft.reviewStatus = 'scheduled'; draft.scheduledAt = result.scheduledAt || scheduledPublishAt; draft.pageId = pageId; draft.postId = result.id; draft.publishError = ''; draft.updatedAt = new Date().toISOString(); }
            }
            pagePublishStatus = 'Đã gửi lịch đăng tới Meta. Post ID: ' + result.id;
            log('Đã lên lịch đăng Page ' + pageId + ' vào ' + (result.scheduledAt || scheduledPublishAt) + '; Post ID: ' + result.id);
          } else {
            if (activePageDraftId) {
              const draft = state.drafts.find(item => item.id === activePageDraftId);
              if (draft) { draft.text = message; draft.pageLink = link; draft.reviewStatus = 'published'; draft.publishedAt = new Date().toISOString(); draft.pageId = pageId; draft.postId = result.id; draft.publishError = ''; draft.updatedAt = new Date().toISOString(); }
            }
            pagePublishStatus = 'Đăng thành công. Post ID: ' + result.id;
            log('Đã đăng bài lên Page ' + pageId + '; Post ID: ' + result.id);
          }
          activePageDraftId = null;
          pageComposerDraft = '';
          pageComposerLink = '';
          pageComposerSchedule = '';
          await save();
          render();
          toast(result.scheduled ? 'Đã gửi lịch đăng tới Meta.' : 'Đã đăng bài lên Page.');
        } catch (error) {
          pagePublishStatus = error.message;
          if (activePageDraftId) {
            const draft = state.drafts.find(item => item.id === activePageDraftId);
            if (draft) { draft.reviewStatus = 'failed'; draft.publishError = String(error.message).slice(0, 1000); draft.updatedAt = new Date().toISOString(); }
          }
          log('Đăng bài Page thất bại: ' + error.message);
          await save();
          render();
          toast(error.message);
        }
        return;
      }
      case 'goEngage':
        page = 'engage';
        render();
        return;
      case 'addEngagement': {
        const name = $('#engagementName').value.trim();
        const url = $('#engagementUrl').value.trim();
        const kind = $('#engagementKind').value;
        const note = $('#engagementNote').value.trim();
        if (!name || name.length > 200) { toast('Nhập tên người hoặc bài viết.'); return; }
        if (!Core.isSafeFacebookUrl(url)) { toast('URL phải thuộc Facebook và sử dụng HTTPS.'); return; }
        if (note.length > 1000) { toast('Ghi chú không được vượt quá 1.000 ký tự.'); return; }
        state.engagementItems = Array.isArray(state.engagementItems) ? state.engagementItems : [];
        state.engagementItems.push({ id: crypto.randomUUID(), name, url, kind, note, status: 'pending', createdAt: new Date().toISOString() });
        if (state.engagementItems.length > 1000) state.engagementItems.shift();
        log('Đã thêm mục theo dõi tương tác: ' + name);
        break;
      }
      case 'openEngagement': {
        const item = (state.engagementItems || []).find(entry => entry.id === id);
        if (!item || !Core.isSafeFacebookUrl(item.url)) { toast('URL Facebook không hợp lệ.'); return; }
        await chrome.tabs.create({ url: item.url });
        log('Đã mở mục theo dõi tương tác: ' + item.name);
        break;
      }
      case 'toggleEngagement': {
        const item = (state.engagementItems || []).find(entry => entry.id === id);
        if (!item) { toast('Không tìm thấy mục theo dõi.'); return; }
        item.status = item.status === 'done' ? 'pending' : 'done';
        log('Đã cập nhật trạng thái tương tác: ' + item.name);
        break;
      }
      case 'deleteEngagement':
        state.engagementItems = (state.engagementItems || []).filter(entry => entry.id !== id);
        log('Đã xóa mục theo dõi tương tác');
        break;
      case 'addContact': {
        const name = $('#contactName').value.trim();
        let url = $('#contactUrl').value.trim();
        let facebookId = $('#contactFacebookId') ? $('#contactFacebookId').value.trim() : '';
        const note = $('#contactNote').value.trim();
        if (!name || name.length > 200) { toast('Nhập tên người liên hệ hợp lệ.'); return; }
        if (facebookId && !/^[0-9]{1,30}$/.test(facebookId)) { toast('Facebook ID phải gồm 1–30 chữ số.'); return; }
        if (url && !Core.isSafeFacebookUrl(url)) { toast('URL hồ sơ phải thuộc Facebook và sử dụng HTTPS.'); return; }
        if (!facebookId && url) facebookId = facebookIdFromUrl(url);
        if (!url && facebookId) url = 'https://www.facebook.com/profile.php?id=' + encodeURIComponent(facebookId);
        if (!url) { toast('Nhập URL hồ sơ Facebook hoặc Facebook ID.'); return; }
        if (note.length > 1000) { toast('Ghi chú không được vượt quá 1.000 ký tự.'); return; }
        state.contacts = Array.isArray(state.contacts) ? state.contacts : [];
        const urlKey = normalizeProfileUrl(url);
        if (state.contacts.some(contact => (urlKey && normalizeProfileUrl(contact.url) === urlKey) || (facebookId && (contact.facebookId === facebookId || facebookIdFromUrl(contact.url) === facebookId)))) { toast('Hồ sơ này đã có trong danh sách theo URL/ID.'); return; }
        if (state.contacts.length >= 1000) { toast('Danh sách đã đạt giới hạn 1.000 hồ sơ.'); return; }
        state.contacts.push({ id: crypto.randomUUID(), name, url, ...(facebookId ? { facebookId } : {}), note, status: 'new', createdAt: new Date().toISOString() });
        log('Đã thêm hồ sơ liên hệ: ' + name);
        break;
      }
      case 'importContacts': {
        const input = $('#contactImportFile');
        if (!input) { toast('Không tìm thấy ô chọn tệp CSV.'); return; }
        input.click();
        return;
      }
      case 'exportContactsCsv': {
        const rows = [['Tên', 'URL hồ sơ Facebook', 'Facebook ID', 'Trạng thái', 'Ghi chú', 'Ngày tạo', 'Cập nhật']];
        for (const contact of state.contacts || []) rows.push([contact.name, contact.url, contact.facebookId || facebookIdFromUrl(contact.url), contact.status, contact.note, contact.createdAt, contact.updatedAt || '']);
        download('facebook-ai-contacts.csv', '\ufeff' + Core.toCsv(rows), 'text/csv;charset=utf-8');
        toast('Đã xuất danh sách liên hệ CSV để mở bằng Excel.');
        return;
      }
      case 'openContact': {
        const contact = (state.contacts || []).find(item => item.id === id);
        if (!contact || !Core.isSafeFacebookUrl(contact.url)) { toast('URL hồ sơ không hợp lệ.'); return; }
        await chrome.tabs.create({ url: contact.url });
        if (contact.status === 'new') contact.status = 'opened';
        contact.updatedAt = new Date().toISOString();
        log('Đã mở hồ sơ liên hệ: ' + contact.name);
        break;
      }
      case 'markContactSent':
      case 'markContactConnected':
      case 'markContactFollowUp':
      case 'markContactDeclined': {
        const contact = (state.contacts || []).find(item => item.id === id);
        if (!contact) { toast('Không tìm thấy hồ sơ liên hệ.'); return; }
        contact.status = ({
          markContactSent: 'request_sent',
          markContactConnected: 'connected',
          markContactFollowUp: 'follow_up',
          markContactDeclined: 'declined'
        })[name];
        contact.updatedAt = new Date().toISOString();
        log('Đã cập nhật trạng thái liên hệ: ' + contact.name + ' · ' + contact.status);
        break;
      }
      case 'deleteContact':
        state.contacts = (state.contacts || []).filter(contact => contact.id !== id);
        log('Đã xóa hồ sơ liên hệ');
        break;
      case 'addGroup': {
        const nameValue = $('#groupName').value.trim();
        const urlValue = $('#groupUrl').value.trim();
        if (!nameValue || nameValue.length > 200 || !Core.isSafeFacebookGroupUrl(urlValue)) {
          toast('Nhập tên nhóm và URL HTTPS dạng facebook.com/groups/...');
          return;
        }
        if (state.groups.some(group => group.url === urlValue)) {
          toast('Nhóm đã tồn tại');
          return;
        }
        state.groups.push({ id: crypto.randomUUID(), name: nameValue, url: urlValue, selected: false });
        log('Đã thêm nhóm: ' + nameValue);
        break;
      }
      case 'selectAll':
        state.groups.forEach(group => { group.selected = true; });
        log('Đã chọn tất cả nhóm');
        break;
      case 'deselectAll':
        state.groups.forEach(group => { group.selected = false; });
        log('Đã bỏ chọn nhóm');
        break;
      case 'importGroups':
        $('#groupImportFile').click();
        return;
      case 'exportGroups': {
        const rows = [['name', 'url', 'selected']].concat(state.groups.map(group => [group.name, group.url, group.selected ? 'true' : 'false']));
        download('facebook-groups.csv', '\ufeff' + Core.toCsv(rows), 'text/csv;charset=utf-8');
        log('Đã xuất danh sách ' + state.groups.length + ' nhóm ra CSV');
        await save();
        toast('Đã xuất danh sách nhóm');
        return;
      }
      case 'openGroup': {
        const group = state.groups.find(item => item.id === id);
        if (!group || !Core.isSafeFacebookGroupUrl(group.url)) { toast('URL nhóm không hợp lệ'); return; }
        await chrome.tabs.create({ url: group.url });
        log('Đã mở nhóm trong tab mới: ' + group.name);
        break;
      }
      case 'openDraftSource': {
        const draft = state.drafts.find(item => item.id === id);
        const sourceUrl = draft && (draft.sourceUrl || draft.url);
        if (!draft || !Core.isSafeHttpsUrl(sourceUrl)) { toast('Bản nháp chưa có URL HTTPS hợp lệ.'); return; }
        await chrome.tabs.create({ url: sourceUrl });
        log('Đã mở bài gốc của bản nháp');
        break;
      }
      case 'openDraftGroup': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft || !Core.isSafeFacebookGroupUrl(draft.targetGroupUrl)) { toast('Bản nháp chưa có URL nhóm hợp lệ'); return; }
        await chrome.tabs.create({ url: draft.targetGroupUrl });
        log('Đã mở nhóm đích của bản nháp: ' + (draft.targetGroupName || 'Nhóm'));
        break;
      }
      case 'openSelectedGroups': {
        const selected = state.groups.filter(group => group.selected && Core.isSafeFacebookGroupUrl(group.url));
        if (!selected.length) { toast('Hãy chọn ít nhất một nhóm'); return; }
        const limit = Math.min(10, Math.max(1, Number(state.settings.groupLimit) || 5));
        const batch = selected.slice(0, limit);
        const delaySeconds = Math.min(5, Math.max(0, Number(state.settings.delay) || 0));
        const moreText = selected.length > batch.length ? ' Chỉ mở ' + batch.length + ' nhóm đầu tiên trong ' + selected.length + ' nhóm đã chọn.' : '';
        if (!window.confirm('Mở ' + batch.length + ' tab nhóm Facebook để bạn thao tác thủ công?' + moreText + (delaySeconds ? ' Khoảng cách mở tab: ' + delaySeconds + ' giây.' : ''))) return;
        for (let index = 0; index < batch.length; index += 1) {
          if (index > 0 && delaySeconds) await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
          await chrome.tabs.create({ url: batch[index].url, active: false });
        }
        log('Đã mở ' + batch.length + ' tab nhóm đã chọn');
        toast('Đã mở ' + batch.length + ' tab nhóm');
        break;
      }
      case 'addProfile': {
        const nameValue = $('#profileName').value.trim();
        if (!nameValue || nameValue.length > 200) { toast('Nhập tên hồ sơ hợp lệ'); return; }
        state.profiles.push({ id: crypto.randomUUID(), name: nameValue, provider: $('#provider').value, model: $('#model').value.trim().slice(0, 120), prompt: $('#aiPrompt').value.slice(0, 20000) });
        log('Đã thêm hồ sơ ' + nameValue);
        break;
      }
      case 'saveShare': {
        const promptValue = $('#sharePrompt').value;
        const postText = $('#postText').value.trim();
        const postUrl = $('#postUrl').value.trim();
        if (!postText || postText.length > 20000) { toast('Nhập nội dung bài gốc hợp lệ'); return; }
        if (postUrl && (!Core.isSafeFacebookUrl(postUrl) || postUrl.length > 2048)) {
          toast('Link bài viết phải là HTTPS trên facebook.com');
          return;
        }
        state.prompts.share = promptValue.slice(0, 20000);
        addDraft(postText, postUrl, 'share');
        log('Đã lưu nháp chia sẻ');
        break;
      }
      case 'deleteGroup':
        state.groups = state.groups.filter(group => group.id !== id);
        log('Đã xóa một nhóm khỏi danh sách');
        break;
      case 'useProfile': {
        const profile = state.profiles.find(item => item.id === id);
        if (!profile) { toast('Không tìm thấy hồ sơ AI'); return; }
        state.settings.provider = profile.provider === 'gemini' ? 'gemini' : 'meta';
        state.settings.model = profile.model || state.settings.model;
        if (profile.prompt) state.prompts.general = profile.prompt;
        log('Đã áp dụng hồ sơ AI: ' + profile.name);
        break;
      }
      case 'deleteProfile':
        state.profiles = state.profiles.filter(profile => profile.id !== id);
        log('Đã xóa hồ sơ AI');
        break;
      case 'requestMetaWebPermission': {
        const granted = await chrome.permissions.request({ permissions: ['scripting'], origins: META_AI_ORIGINS });
        metaWebPermissionPresent = granted;
        if (!granted) { toast('Chưa cấp quyền Meta AI Web.'); return; }
        try {
          const tabs = await chrome.tabs.query({ url: META_AI_ORIGINS });
          if (tabs.length) {
            await chrome.tabs.update(tabs[0].id, { active: true });
          } else {
            await chrome.tabs.create({ url: 'https://www.meta.ai/' });
          }
          log('Đã cấp quyền và mở Meta AI Web');
          await save();
          toast('Đã mở Meta AI Web. Hãy đăng nhập nếu được yêu cầu; sau đó quay lại extension để tạo nội dung.');
        } catch (_) {
          toast('Đã cấp quyền nhưng không mở được Meta AI Web.');
        }
        render();
        return;
      }
      case 'openMetaAiWeb':
        await chrome.tabs.create({ url: 'https://www.meta.ai/' });
        toast('Đã mở Meta AI Web trong tab mới.');
        return;
      case 'copyMetaWebPrompt': {
        const template = $('#metaWebPrompt').value.trim();
        const input = $('#metaWebInput').value.trim();
        let prompt = Core.fillPrompt(template, { content: input });
        if (input && !template.includes('{content}')) prompt += '\n\nNội dung đầu vào:\n' + input;
        try {
          await navigator.clipboard.writeText(prompt);
          toast('Đã sao chép prompt Meta AI Web.');
        } catch (_) { toast('Không sao chép được prompt.'); }
        return;
      }
      case 'generateMetaWebDraft': {
        const template = $('#metaWebPrompt').value.trim();
        const input = $('#metaWebInput').value.trim();
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào trước khi gửi Meta AI.'); return; }
        let prompt = Core.fillPrompt(template, { content: input });
        if (!template.includes('{content}')) prompt += '\n\nNội dung đầu vào:\n' + input;
        metaWebStatus = 'Đang gửi yêu cầu tới Meta AI Web...';
        render();
        try {
          const output = await generateWithMetaAiWeb(prompt);
          metaWebLastSuccess = true;
          addDraft(output, '', 'ai');
          metaWebStatus = 'Đã nhận câu trả lời và lưu thành bản nháp. Hãy xem lại trước khi sử dụng.';
          log('Đã nhận và lưu bản nháp từ Meta AI Web');
          await save();
          render();
          toast('Meta AI đã trả lời; bản nháp đã được lưu.');
        } catch (error) {
          metaWebStatus = error.message;
          log('Meta AI Web thất bại: ' + error.message);
          await save();
          render();
          toast(error.message);
        }
        return;
      }
      case 'saveGeminiKey': {
        const input = $('#geminiApiKey').value.trim();
        if (input.length < 10 || input.length > 500) { toast('API key phải có từ 10 đến 500 ký tự'); return; }
        await chrome.storage.session.set({ [GEMINI_KEY]: input });
        state.settings.provider = 'gemini';
        state.settings.model = ($('#model').value.trim() || state.settings.model || 'gemini-2.5-flash').slice(0, 120);
        aiKeyPresent = true;
        log('Đã lưu khóa Gemini trong phiên Chrome');
        await save();
        render();
        toast('Đã lưu khóa tạm thời trong phiên Chrome; khóa không được đưa vào nhật ký.');
        return;
      }
      case 'clearGeminiKey':
        await chrome.storage.session.remove(GEMINI_KEY);
        aiKeyPresent = false;
        log('Đã xóa khóa Gemini khỏi phiên Chrome');
        await save();
        render();
        toast('Đã xóa khóa khỏi phiên hiện tại');
        return;
      case 'requestGeminiPermission': {
        const granted = await chrome.permissions.request({ origins: [GEMINI_ORIGIN] });
        aiPermissionPresent = granted;
        if (granted) {
          state.settings.provider = 'gemini';
          if ($('#model')) state.settings.model = $('#model').value.trim() || state.settings.model;
          log('Đã cấp quyền Gemini API');
          await save();
        }
        render();
        toast(granted ? 'Đã cấp quyền truy cập Gemini API' : 'Chưa cấp quyền Gemini API');
        return;
      }
      case 'testGemini': {
        try {
          const output = await geminiRequest('Trả lời chính xác bằng tiếng Việt: Kết nối Gemini hoạt động.');
          if (!output) return;
          aiOutput = output;
          log('Kiểm tra kết nối Gemini thành công');
          await save();
          render();
          toast('Gemini đã phản hồi');
        } catch (error) {
          aiOutput = error.message;
          log('Kiểm tra Gemini thất bại: ' + error.message);
          await save();
          render();
          toast(error.message);
        }
        return;
      }
      case 'generateAiDraft': {
        const input = $('#aiInput').value.trim();
        const template = $('#aiPrompt').value.trim();
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        state.prompts.general = template.slice(0, 20000);
        let prompt = Core.fillPrompt(state.prompts.general, { content: input });
        if (!state.prompts.general.includes('{content}')) prompt += '\n\nNội dung cần xử lý:\n' + input;
        try {
          const output = state.settings.provider === 'gemini'
            ? await geminiRequest(prompt)
            : await generateWithMetaAiWeb(prompt);
          if (!output) return;
          addDraft(output, '', 'ai');
          aiOutput = output;
          if (state.settings.provider !== 'gemini') metaWebLastSuccess = true;
          metaWebStatus = state.settings.provider === 'gemini' ? aiOutput : 'Đã nhận và lưu bản nháp từ Meta AI Web.';
          log(state.settings.provider === 'gemini' ? 'Đã tạo nháp bằng Gemini' : 'Đã tạo nháp bằng Meta AI Web');
          break;
        } catch (error) {
          log((state.settings.provider === 'gemini' ? 'Gemini' : 'Meta AI Web') + ' lỗi khi tạo nháp: ' + error.message);
          await save();
          toast(error.message);
          return;
        }
      }
      case 'generateShareDraft': {
        const postText = $('#postText').value.trim();
        const postUrl = $('#postUrl').value.trim();
        if (!postText || postText.length > 20000) { toast('Nhập nội dung bài gốc hợp lệ'); return; }
        if (postUrl && (!Core.isSafeFacebookUrl(postUrl) || postUrl.length > 2048)) {
          toast('Link bài viết phải là HTTPS trên facebook.com'); return;
        }
        state.prompts.share = $('#sharePrompt').value.slice(0, 20000);
        const selected = state.groups.filter(group => group.selected && Core.isSafeFacebookGroupUrl(group.url));
        const targets = selected.length ? selected.slice(0, 5) : [{ id: '', name: 'Chưa chọn nhóm', url: '' }];
        if (selected.length > 5 && !window.confirm('Đã chọn ' + selected.length + ' nhóm. Tạo nháp cho 5 nhóm đầu tiên trong lượt này?')) return;
        if (!window.confirm('Gửi nội dung đầu vào tới ' + (state.settings.provider === 'gemini' ? 'Gemini' : 'Meta AI Web') + ' để tạo ' + targets.length + ' bản nháp? Không có nội dung nào được đăng tự động.')) return;
        let created = 0;
        for (const group of targets) {
          let prompt = Core.fillPrompt(state.prompts.share, { postText, groupName: group.name });
          if (!state.prompts.share.includes('{postText}')) prompt += '\n\nNội dung bài gốc:\n' + postText;
          if (!state.prompts.share.includes('{groupName}')) prompt += '\n\nNgữ cảnh nhóm: ' + group.name;
          try {
            const output = state.settings.provider === 'gemini'
              ? await geminiRequest(prompt)
              : await generateWithMetaAiWeb(prompt);
            if (!output) return;
            addDraft(output, postUrl, 'share', group.url ? group : null);
            if (state.settings.provider !== 'gemini') metaWebLastSuccess = true;
            created += 1;
            log('Đã tạo nháp lời dẫn' + (group.url ? ' cho nhóm ' + group.name : ''));
            await save();
          } catch (error) {
            log((state.settings.provider === 'gemini' ? 'Gemini' : 'Meta AI Web') + ' lỗi khi tạo lời dẫn: ' + error.message);
            await save();
            toast('Đã tạo ' + created + ' nháp trước khi gặp lỗi: ' + error.message);
            render();
            return;
          }
        }
        if (created) toast('Đã tạo ' + created + ' bản nháp. Hãy kiểm tra trước khi đăng.');
        break;
      }

      case 'copyAiPrompt': {
        const input = $('#aiInput').value.trim();
        const template = $('#aiPrompt').value.trim();
        state.prompts.general = template.slice(0, 20000);
        let prompt = Core.fillPrompt(template, { content: input });
        if (input && !template.includes('{content}')) prompt += '\n\nNội dung cần xử lý:\n' + input;
        try {
          await navigator.clipboard.writeText(prompt);
          log('Đã sao chép prompt AI chung');
          await save();
          toast('Đã sao chép prompt. Bạn có thể dán vào Meta AI hoặc AI khác.');
        } catch (_) { toast('Không sao chép được prompt.'); }
        return;
      }
      case 'saveExternalAiDraft': {
        const output = $('#aiExternalOutput').value.trim();
        if (!output || output.length > 20000) { toast('Dán kết quả AI hợp lệ trước khi lưu'); return; }
        state.prompts.general = $('#aiPrompt').value.slice(0, 20000);
        addDraft(output, '', 'ai');
        log('Đã lưu kết quả từ AI bên ngoài');
        break;
      }
      case 'copyModulePrompt': {
        const input = $('#moduleInput').value.trim();
        const template = $('#modulePrompt').value.trim();
        const promptKey = modulePromptKey();
        state.prompts[promptKey] = template.slice(0, 20000);
        let prompt = Core.fillPrompt(template, { content: input });
        if (input && !template.includes('{content}')) prompt += '\n\nNội dung được cung cấp:\n' + input;
        try {
          await navigator.clipboard.writeText(prompt);
          log('Đã sao chép prompt: ' + TITLES[page]);
          await save();
          toast('Đã sao chép prompt cho ' + TITLES[page]);
        } catch (_) { toast('Không sao chép được prompt.'); }
        return;
      }
      case 'saveModuleOutputDraft': {
        const output = $('#moduleOutput').value.trim();
        const sourceUrl = $('#moduleSourceUrl') ? $('#moduleSourceUrl').value.trim() : '';
        if (!output || output.length > 20000) { toast('Dán kết quả AI hợp lệ trước khi lưu'); return; }
        if (sourceUrl) {
          let validSource = false;
          validSource = Core.isSafeHttpsUrl(sourceUrl);
          if (!validSource) { toast('Link nguồn phải là HTTPS hợp lệ.'); return; }
        }
        const externalDraft = addDraft(output, '', 'ai');
        if (sourceUrl) externalDraft.sourceUrl = sourceUrl;
        log('Đã lưu kết quả AI bên ngoài: ' + TITLES[page]);
        break;
      }
      case 'copySharePrompt': {
        const postText = $('#postText').value.trim();
        const selected = state.groups.filter(group => group.selected && Core.isSafeFacebookGroupUrl(group.url));
        const groupName = selected.length ? selected[0].name : 'nhóm phù hợp';
        const template = $('#sharePrompt').value.trim();
        state.prompts.share = template.slice(0, 20000);
        let prompt = Core.fillPrompt(template, { postText, groupName });
        if (postText && !template.includes('{postText}')) prompt += '\n\nNội dung bài gốc:\n' + postText;
        if (!template.includes('{groupName}')) prompt += '\n\nNgữ cảnh nhóm: ' + groupName;
        try {
          await navigator.clipboard.writeText(prompt);
          log('Đã sao chép prompt chia sẻ');
          await save();
          toast('Đã sao chép prompt chia sẻ');
        } catch (_) { toast('Không sao chép được prompt.'); }
        return;
      }
      case 'saveExternalShareDraft': {
        const output = $('#shareExternalOutput').value.trim();
        const postUrl = $('#postUrl').value.trim();
        if (!output || output.length > 20000) { toast('Dán kết quả AI hợp lệ trước khi lưu'); return; }
        if (postUrl && (!Core.isSafeFacebookUrl(postUrl) || postUrl.length > 2048)) {
          toast('Link bài viết phải là HTTPS trên facebook.com'); return;
        }
        const selected = state.groups.filter(group => group.selected && Core.isSafeFacebookGroupUrl(group.url));
        state.prompts.share = $('#sharePrompt').value.slice(0, 20000);
        addDraft(output, postUrl, 'share', selected.length ? selected[0] : null);
        log('Đã lưu lời dẫn chia sẻ từ AI bên ngoài');
        break;
      }
      case 'saveAiDraft': {
        const input = $('#aiInput').value.trim();
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        state.prompts.general = $('#aiPrompt').value.slice(0, 20000);
        addDraft(input, '', 'source');
        log('Đã lưu nguyên văn nội dung thành nháp');
        break;
      }
      case 'copyDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp'); return; }
        try {
          await navigator.clipboard.writeText(draft.text);
          log('Đã sao chép bản nháp');
          await save();
          toast('Đã sao chép nội dung');
        } catch (_) { toast('Không sao chép được. Hãy sao chép thủ công.'); }
        return;
      }
      case 'editDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp'); return; }
        if (['published', 'scheduled'].includes(draft.reviewStatus)) { toast('Không thể sửa bản đã đăng hoặc đã lên lịch. Hãy tạo bản nháp mới.'); return; }
        const edited = window.prompt('Chỉnh sửa bản nháp', draft.text);
        if (edited === null) return;
        if (!edited.trim() || edited.length > 20000) { toast('Nội dung nháp phải có từ 1 đến 20.000 ký tự'); return; }
        draft.text = edited.trim();
        draft.updatedAt = new Date().toISOString();
        if (['approved', 'rejected', 'failed'].includes(draft.reviewStatus)) draft.reviewStatus = 'draft';
        draft.approvedAt = '';
        draft.publishError = '';
        log('Đã chỉnh sửa bản nháp');
        break;
      }
      case 'deleteDraft': {
        const draft = state.drafts.find(item => item.id === id);
        if (!draft) { toast('Không tìm thấy bản nháp.'); return; }
        if (['published', 'scheduled'].includes(draft.reviewStatus) &&
            !window.confirm('Xóa bản ghi theo dõi cục bộ? Bài đã đăng hoặc lịch Meta đã nhận sẽ không bị xóa khỏi Facebook.')) return;
        state.drafts = state.drafts.filter(item => item.id !== id);
        log('Đã xóa bản nháp hoặc bản ghi theo dõi cục bộ');
        break;
      }
      case 'openPagePlanner': {
        const item = (state.pageSchedules || []).find(schedule => schedule.id === id);
        if (!item || !/^[0-9]{5,30}$/.test(item.pageId)) { toast('Không tìm thấy lịch Page hợp lệ.'); return; }
        await chrome.tabs.create({ url: 'https://business.facebook.com/latest/planner?asset_id=' + encodeURIComponent(item.pageId) });
        log('Đã mở Meta Business Suite Planner cho Page ' + item.pageId);
        return;
      }
      case 'openTaskDraft': {
        const task = state.tasks.find(item => item.id === id);
        const draft = task && task.draftId ? state.drafts.find(item => item.id === task.draftId) : null;
        if (!draft) { toast('Không tìm thấy bản nháp được gắn với nhắc việc.'); return; }
        draftQuery = draft.text.slice(0, 100);
        draftKindFilter = 'all';
        page = 'logs';
        render();
        toast('Đã mở thư viện và lọc theo bản nháp của nhắc việc.');
        return;
      }
      case 'completeTask': {
        const task = state.tasks.find(item => item.id === id);
        if (task) { task.status = 'done'; log('Đã hoàn thành nhắc việc: ' + task.name); }
        break;
      }
      case 'deleteTask':
        state.tasks = state.tasks.filter(task => task.id !== id);
        log('Đã xóa nhắc việc');
        break;
      case 'requestNotificationPermission': {
        const granted = await chrome.permissions.request({ permissions: ['notifications'] });
        notificationPermissionPresent = Boolean(granted);
        if (granted) {
          log('Đã cấp quyền thông báo nhắc việc');
          toast('Đã bật thông báo khi nhắc việc đến hạn.');
        } else {
          toast('Chưa cấp quyền thông báo. Extension vẫn hiển thị số nhắc việc đến hạn trên biểu tượng.');
        }
        await save();
        render();
        return;
      }
      case 'addTask': {
        const nameValue = $('#taskName').value.trim();
        const timeValue = $('#taskTime').value;
        if (!nameValue || nameValue.length > 200 || !timeValue || !Number.isFinite(Date.parse(timeValue))) {
          toast('Nhập tên công việc và thời gian hợp lệ');
          return;
        }
        if (Date.parse(timeValue) <= Date.now()) { toast('Thời điểm nhắc phải ở trong tương lai.'); return; }
        const draftId = $('#taskDraftId') ? $('#taskDraftId').value : '';
        state.tasks.push({ id: crypto.randomUUID(), name: nameValue, time: timeValue, status: 'scheduled', ...(draftId ? { draftId } : {}) });
        log('Đã lưu nhắc việc: ' + nameValue);
        break;
      }
      case 'captureCurrentFacebookPost': {
        const granted = await chrome.permissions.request({ permissions: ['scripting'], origins: FACEBOOK_CAPTURE_ORIGINS });
        if (!granted) { toast('Chưa cấp quyền đọc bài viết Facebook đang mở.'); return; }
        let tabs = [];
        try { tabs = await chrome.tabs.query({ url: FACEBOOK_CAPTURE_ORIGINS }); } catch (_) {}
        const tab = tabs.filter(item => item && item.id != null && Core.isSafeFacebookUrl(item.url))
          .sort((a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0))[0];
        if (!tab) { toast('Hãy mở một bài viết Facebook riêng trong tab khác rồi thử lại.'); return; }
        try {
          if (tab.status && tab.status !== 'complete') await waitForTabReady(tab.id, 45000, 'Facebook');
          await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['src/facebook-page-bridge.js'] });
          const result = await chrome.tabs.sendMessage(tab.id, { type: 'FAA_CAPTURE_VISIBLE_FACEBOOK_POST' });
          if (!result || !result.ok) { toast(result && result.error ? result.error : 'Không đọc được bài viết đang hiển thị.'); return; }
          if (!Core.isSafeFacebookUrl(result.sourceUrl) || !result.text || result.text.length < 20) {
            toast('Dữ liệu trả về không hợp lệ; chưa lưu quan sát.');
            return;
          }
          const contactId = $('#observationContactId') ? $('#observationContactId').value : '';
          const contact = (state.contacts || []).find(item => item.id === contactId);
          const observation = {
            id: crypto.randomUUID(),
            sourceUrl: result.sourceUrl,
            capturedAt: result.capturedAt && Number.isFinite(Date.parse(result.capturedAt)) ? result.capturedAt : new Date().toISOString(),
            text: String(result.text).slice(0, 50000),
            visibleArticleCount: Number.isInteger(result.visibleArticleCount) ? Math.max(0, Math.min(100, result.visibleArticleCount)) : 0,
            ...(contact ? { contactId: contact.id, contactName: contact.name } : {})
          };
          state.observations = Array.isArray(state.observations) ? state.observations : [];
          state.observations.push(observation);
          if (state.observations.length > 1000) state.observations.shift();
          const sourceDraft = addDraft(observation.text.slice(0, 20000), '', 'source');
          sourceDraft.sourceUrl = observation.sourceUrl;
          log('Đã thu thập nội dung bài viết/bình luận đang hiển thị: ' + observation.sourceUrl);
          await save();
          render();
          toast('Đã lưu quan sát và bản nháp nguồn. Chưa gửi dữ liệu cho AI.');
        } catch (error) {
          log('Thu thập bài Facebook thất bại: ' + error.message);
          toast(error.message || 'Không thể thu thập bài viết đang mở.');
        }
        return;
      }
      case 'analyzeObservation': {
        const observation = (state.observations || []).find(item => item.id === id);
        if (!observation) { toast('Không tìm thấy quan sát.'); return; }
        const content = 'Thời điểm thu thập: ' + observation.capturedAt +
          '\nHồ sơ được gán: ' + (observation.contactName || 'Chưa gán hồ sơ') +
          '\nNguồn: ' + observation.sourceUrl +
          '\nNội dung đang hiển thị:\n' + observation.text.slice(0, 18000);
        const prompt = Core.fillPrompt(state.prompts.profileAnalysis, { content });
        try {
          const output = state.settings.provider === 'gemini'
            ? await geminiRequest(prompt)
            : await generateWithMetaAiWeb(prompt);
          if (!output) return;
          observation.analysisText = output.slice(0, 20000);
          observation.analysisAt = new Date().toISOString();
          const analysisDraft = addDraft(observation.analysisText, '', 'ai');
          analysisDraft.sourceUrl = observation.sourceUrl;
          log('Đã phân tích quan sát theo ngữ cảnh: ' + observation.id);
          if (state.settings.provider !== 'gemini') metaWebLastSuccess = true;
          await save();
          render();
          toast('Đã lưu phân tích AI. Hãy kiểm tra nhận định trước khi sử dụng.');
        } catch (error) {
          log('Phân tích quan sát thất bại: ' + error.message);
          await save();
          toast(error.message || 'Không thể phân tích quan sát.');
        }
        return;
      }
      case 'openObservationSource': {
        const observation = (state.observations || []).find(item => item.id === id);
        if (!observation || !Core.isSafeFacebookUrl(observation.sourceUrl)) { toast('Không tìm thấy nguồn Facebook hợp lệ.'); return; }
        await chrome.tabs.create({ url: observation.sourceUrl });
        return;
      }
      case 'deleteObservation': {
        const observation = (state.observations || []).find(item => item.id === id);
        if (!observation) { toast('Không tìm thấy quan sát.'); return; }
        if (!window.confirm('Xóa quan sát và nội dung phân tích đã lưu cục bộ?')) return;
        state.observations = state.observations.filter(item => item.id !== id);
        log('Đã xóa quan sát cục bộ: ' + id);
        break;
      }
      case 'createWeeklyReportNow': {
        const report = Core.buildWeeklyReport(state, Date.now());
        upsertWeeklyReport(report);
        log('Đã tổng hợp báo cáo thống kê 7 ngày.');
        await save();
        render();
        toast('Đã tạo báo cáo thống kê cục bộ.');
        return;
      }
      case 'summarizeNow':
      case 'generateWeeklyAiSummary': {
        let report = name === 'summarizeNow'
          ? Core.buildWeeklyReport(state, Date.now())
          : (state.weeklyReports || []).find(item => item.id === id);
        if (!report) { toast('Không tìm thấy báo cáo.'); return; }
        upsertWeeklyReport(report);
        if (!report.observationsCount) {
          await save();
          render();
          toast('Báo cáo đã lưu nhưng chưa có quan sát trong 7 ngày để tóm tắt bằng AI.');
          return;
        }
        try {
          const prompt = weeklyAiPrompt(report);
          const output = state.settings.provider === 'gemini'
            ? await geminiRequest(prompt)
            : await generateWithMetaAiWeb(prompt);
          if (!output) return;
          report.aiSummary = output.slice(0, 20000);
          report.aiSummaryAt = new Date().toISOString();
          const reportDraft = addDraft(report.aiSummary, '', 'ai');
          log('Đã tạo tóm tắt AI cho báo cáo 7 ngày: ' + report.id);
          if (state.settings.provider !== 'gemini') metaWebLastSuccess = true;
          await save();
          render();
          toast('Đã tạo tóm tắt AI. Hãy kiểm tra nội dung và nguồn trước khi chia sẻ.');
        } catch (error) {
          log('Tạo tóm tắt AI thất bại: ' + error.message);
          await save();
          render();
          toast(error.message || 'Không thể tạo tóm tắt AI.');
        }
        return;
      }
      case 'exportObservationsCsv': {
        const rows = [['Thời gian thu thập', 'Hồ sơ', 'Nguồn URL', 'Số khối bài/bình luận hiển thị', 'Nội dung', 'Phân tích AI']];
        for (const item of state.observations || []) rows.push([
          item.capturedAt, item.contactName || 'Chưa gán hồ sơ', item.sourceUrl,
          item.visibleArticleCount || 0, item.text, item.analysisText || ''
        ]);
        download('facebook-ai-observations.csv', '\ufeff' + Core.toCsv(rows), 'text/csv;charset=utf-8');
        toast('Đã xuất lịch sử quan sát CSV để mở bằng Excel.');
        return;
      }
      case 'exportWeeklyReportsCsv': {
        const rows = [['Bắt đầu kỳ', 'Kết thúc kỳ', 'Ngày tạo', 'Số quan sát', 'Số hồ sơ', 'So sánh kỳ trước', 'Báo cáo thống kê', 'Tóm tắt AI']];
        for (const report of state.weeklyReports || []) rows.push([
          report.periodStart, report.periodEnd, report.createdAt, report.observationsCount,
          report.profilesCount, report.previousObservationsCount, report.summary, report.aiSummary || ''
        ]);
        download('facebook-ai-weekly-reports.csv', '\ufeff' + Core.toCsv(rows), 'text/csv;charset=utf-8');
        toast('Đã xuất báo cáo CSV để mở bằng Excel.');
        return;
      }
      case 'exportWeeklyReport': {
        const report = (state.weeklyReports || []).find(item => item.id === id);
        if (!report) { toast('Không tìm thấy báo cáo.'); return; }
        const start = Date.parse(report.periodStart);
        const end = Date.parse(report.periodEnd);
        const rows = [
          ['Loại', 'Thời gian', 'Hồ sơ', 'Nguồn URL', 'Số khối hiển thị', 'Nội dung'],
          ['Báo cáo thống kê', report.createdAt, '', '', report.observationsCount, report.summary],
          ['Tóm tắt AI', report.aiSummaryAt || '', '', '', '', report.aiSummary || '']
        ];
        for (const item of state.observations || []) {
          const time = Date.parse(item.capturedAt);
          if (Number.isFinite(time) && time >= start && time <= end) rows.push([
            'Quan sát', item.capturedAt, item.contactName || 'Chưa gán hồ sơ',
            item.sourceUrl, item.visibleArticleCount || 0, item.text
          ]);
        }
        download('facebook-ai-weekly-report.csv', '\ufeff' + Core.toCsv(rows), 'text/csv;charset=utf-8');
        toast('Đã xuất báo cáo và dữ liệu nguồn CSV.');
        return;
      }
      case 'deleteWeeklyReport': {
        if (!window.confirm('Xóa báo cáo này khỏi lịch sử cục bộ?')) return;
        state.weeklyReports = (state.weeklyReports || []).filter(item => item.id !== id);
        log('Đã xóa báo cáo tuần cục bộ: ' + id);
        break;
      }
      case 'generateModuleDraft': {
        const input = $('#moduleInput').value.trim();
        const template = $('#modulePrompt').value.trim();
        const sourceUrl = $('#moduleSourceUrl') ? $('#moduleSourceUrl').value.trim() : '';
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        if (sourceUrl) {
          let validSource = false;
          validSource = Core.isSafeHttpsUrl(sourceUrl);
          if (!validSource) { toast('Link nguồn phải là HTTPS hợp lệ.'); return; }
        }
        const promptKey = modulePromptKey();
        state.prompts[promptKey] = template.slice(0, 20000);
        let prompt = Core.fillPrompt(state.prompts[promptKey], { content: input });
        if (!state.prompts[promptKey].includes('{content}')) prompt += '\n\nNội dung được cung cấp:\n' + input;
        if (sourceUrl) prompt += '\n\nLiên kết tham chiếu do người dùng cung cấp (không đảm bảo AI có thể truy cập): ' + sourceUrl;
        try {
          const output = state.settings.provider === 'gemini'
            ? await geminiRequest(prompt)
            : await generateWithMetaAiWeb(prompt);
          if (!output) return;
          const moduleDraft = addDraft(output, '', 'ai');
          if (sourceUrl) moduleDraft.sourceUrl = sourceUrl;
          if (state.settings.provider !== 'gemini') metaWebLastSuccess = true;
          log(state.settings.provider === 'gemini' ? 'Đã tạo bản nháp bằng Gemini: ' + TITLES[page] : 'Đã tạo bản nháp bằng Meta AI Web: ' + TITLES[page]);
          break;
        } catch (error) {
          log((state.settings.provider === 'gemini' ? 'Gemini' : 'Meta AI Web') + ' lỗi tại module ' + TITLES[page] + ': ' + error.message);
          await save();
          toast(error.message);
          return;
        }
      }
      case 'saveModuleDraft': {
        const input = $('#moduleInput').value.trim();
        const sourceUrl = $('#moduleSourceUrl') ? $('#moduleSourceUrl').value.trim() : '';
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        if (sourceUrl) {
          let validSource = false;
          validSource = Core.isSafeHttpsUrl(sourceUrl);
          if (!validSource) { toast('Link nguồn phải là HTTPS hợp lệ.'); return; }
        }
        const promptKey = modulePromptKey();
        state.prompts[promptKey] = $('#modulePrompt').value.slice(0, 20000);
        const sourceDraft = addDraft(input, '', 'source');
        if (sourceUrl) sourceDraft.sourceUrl = sourceUrl;
        log('Đã lưu nội dung nguồn từ module: ' + TITLES[page]);
        break;
      }
      case 'saveNote': {
        const note = $('#moduleNote').value.trim();
        state.moduleNotes[page] = note.slice(0, 2000);
        log('Đã lưu ghi chú: ' + TITLES[page]);
        break;
      }
      case 'filterDrafts':
        draftQuery = ($('#draftQuery') ? $('#draftQuery').value : '').slice(0, 200);
        draftKindFilter = ($('#draftKindFilter') ? $('#draftKindFilter').value : 'all');
        render();
        return;
      case 'clearDraftFilter':
        draftQuery = '';
        draftKindFilter = 'all';
        render();
        return;
      case 'exportLogs': {
        const csv = Core.toCsv([['Thời gian', 'Nội dung']].concat(state.logs.map(item => [item.at, item.message])));
        download('facebook-ai-logs.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
        toast('Đã xuất nhật ký');
        return;
      }
      case 'clearLogs':
        if (!window.confirm('Xóa toàn bộ nhật ký?')) return;
        state.logs = [];
        break;
      default:
        return;
    }
    await save();
    render();
    if (toastSequence === toastSequenceAtStart) toast('Đã lưu trên trình duyệt');
  }
  function init() {
    const requestedPage = window.location && typeof window.location.hash === 'string' ? window.location.hash.slice(1) : '';
    if (NAV.some(item => item[0] === requestedPage)) page = requestedPage;
    chrome.storage.local.get('faa.state').then(async result => {
      const stored = result['faa.state'];
      const migrated = stored ? Core.migrateState(stored) : null;
      if (Core.isValidState(migrated)) {
        state = migrated;
        if (JSON.stringify(migrated) !== JSON.stringify(stored)) await save();
      } else if (stored) {
        toast('Dữ liệu đã lưu không hợp lệ; đang dùng trạng thái mặc định.');
      }
      await refreshAiStatus();
      render();
    }).catch(() => {
      render();
      toast('Không đọc được dữ liệu cục bộ.');
    });
    document.addEventListener('click', event => {
      const navButton = event.target.closest('[data-nav]');
      if (navButton) {
        page = navButton.dataset.nav;
        if (page === 'pages') { activePageDraftId = null; pageComposerDraft = ''; pageComposerLink = ''; pageComposerSchedule = ''; pagePublishStatus = ''; }
        render();
        return;
      }
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) action(actionButton.dataset.action, actionButton.dataset.id).catch(() => toast('Không thể hoàn tất thao tác.'));
    });
    document.addEventListener('input', event => {
      if (event.target.id === 'pageMessage') pageComposerDraft = event.target.value;
      if (event.target.id === 'pageLink') pageComposerLink = event.target.value;
      if (event.target.id === 'pagePublishTime') pageComposerSchedule = event.target.value;
    });
    document.addEventListener('change', event => {
      if (event.target.id === 'contactImportFile') { importContactsCsvFile(event).catch(error => toast(error.message || 'Không thể nhập CSV.')); return; }
      if (!event.target.classList.contains('group-check')) return;
      const group = state.groups.find(item => item.id === event.target.dataset.id);
      if (!group) return;
      group.selected = event.target.checked;
      save().then(render).catch(() => toast('Không thể lưu lựa chọn.'));
    });
    $('#exportBtn').addEventListener('click', () => download('facebook-ai-config.json', JSON.stringify(state, null, 2), 'application/json'));
    $('#importBtn').addEventListener('click', () => $('#importFile').click());
    $('#importFile').addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (file.size > 5000000) { toast('File quá lớn'); event.target.value = ''; return; }
      try {
        const imported = Core.migrateState(JSON.parse(await file.text()));
        if (!Core.isValidState(imported)) throw new Error('Invalid state');
        if (!window.confirm('Nhập cấu hình sẽ thay thế dữ liệu hiện tại. Tiếp tục?')) return;
        state = imported;
        await save();
        render();
        toast('Đã nhập cấu hình');
      } catch (_) {
        toast('Không thể nhập file JSON này');
      } finally {
        event.target.value = '';
      }
    });
    $('#groupImportFile').addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      if (file.size > 5000000) { toast('File CSV vượt quá 5 MB'); event.target.value = ''; return; }
      try {
        const rows = Core.parseCsv((await file.text()).replace(/^\uFEFF/, ''));
        if (!rows.length) throw new Error('CSV trống');
        const first = rows[0].map(value => value.trim().toLowerCase());
        const nameHeaders = ['name', 'group', 'group name', 'tên nhóm', 'ten nhom'];
        const urlHeaders = ['url', 'link', 'group url', 'đường dẫn', 'duong dan'];
        const nameIndex = first.findIndex(value => nameHeaders.includes(value));
        const urlIndex = first.findIndex(value => urlHeaders.includes(value));
        const hasHeader = nameIndex >= 0 && urlIndex >= 0;
        const start = hasHeader ? 1 : 0;
        const ni = hasHeader ? nameIndex : 0;
        const ui = hasHeader ? urlIndex : 1;
        let added = 0;
        let skipped = 0;
        for (const row of rows.slice(start)) {
          const nameValue = String(row[ni] || '').trim();
          const urlValue = String(row[ui] || '').trim();
          if (!nameValue && !urlValue) continue;
          if (!nameValue || nameValue.length > 200 || !Core.isSafeFacebookGroupUrl(urlValue) ||
              state.groups.some(group => group.url === urlValue) ||
              state.groups.length >= 10000) { skipped += 1; continue; }
          state.groups.push({ id: crypto.randomUUID(), name: nameValue, url: urlValue, selected: false });
          added += 1;
        }
        if (!added && skipped) throw new Error('Không có dòng hợp lệ. Kiểm tra cột tên nhóm và URL Facebook.');
        log('Nhập CSV nhóm: thêm ' + added + ', bỏ qua ' + skipped + ' dòng');
        await save();
        render();
        toast('Đã thêm ' + added + ' nhóm; bỏ qua ' + skipped + ' dòng không hợp lệ hoặc trùng.');
      } catch (error) {
        toast(error.message === 'CSV trống' ? error.message : 'Không thể nhập CSV: ' + error.message);
      } finally {
        event.target.value = '';
      }
    });
    $('#openHelp').addEventListener('click', () => {
      page = 'logs';
      render();
      toast('Xem README.md để biết hướng dẫn cài đặt.');
    });
  }
  init();
})();
