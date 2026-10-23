'use strict';

(function () {
  const Core = window.FAACore;
  const Gemini = window.FAAAI;
  const Facebook = window.FAAFacebook;
  const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/*';
  const GEMINI_KEY = 'faa.geminiApiKey';
  const GRAPH_ORIGIN = 'https://graph.facebook.com/*';
  const PAGE_TOKEN_KEY = 'faa.facebookPageToken';
  const NAV = [
    ['connect', '♧', 'Kết bạn'], ['scrape', '▤', 'Cào bài'], ['groups', '♧', 'Nhóm'],
    ['pages', '⚑', 'Nuôi Page'], ['share', '↗', 'Share bài'], ['sales', '▣', 'Đăng bán'],
    ['learn', '▥', 'Học nhóm'], ['feed', '◉', 'Bản tin & AI'], ['engage', '♡', 'Lấy lại tương tác'],
    ['ai', '⚙', 'AI chung'], ['schedule', '▦', 'Lịch chạy'], ['logs', '▤', 'Nhật ký']
  ];
  const TITLES = {
    connect: 'Kết bạn', scrape: 'Cào bài', groups: 'Quản lý nhóm và tương tác', pages: 'Nuôi Page',
    share: 'Share bài vào nhóm đã tham gia', sales: 'Đăng bán', learn: 'Học nhóm',
    feed: 'Bản tin & AI', engage: 'Lấy lại tương tác', ai: 'Hồ sơ AI dùng chung',
    schedule: 'Lịch chạy', logs: 'Nhật ký'
  };
  const DESCS = {
    groups: 'Quản lý nhóm đã tham gia, lựa chọn nhóm và chuẩn bị nội dung.',
    ai: 'Cấu hình AI Provider, prompt và hồ sơ theo từng chức năng.',
    logs: 'Theo dõi thao tác, lỗi và xuất dữ liệu.',
    share: 'Chuẩn bị nội dung chia sẻ với lời dẫn theo từng nhóm.'
  };
  const $ = selector => document.querySelector(selector);
  const esc = Core.escapeHtml;
  let state = Core.createDefaultState();
  let page = 'groups';
  let toastTimer = null;
  let aiKeyPresent = false;
  let aiPermissionPresent = false;
  let aiOutput = '';
  let pageTokenPresent = false;
  let graphPermissionPresent = false;
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
      '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><time>' + esc(draft.createdAt) + '</time></div>' +
      (draft.targetGroupName ? '<div class="draft-target">Nhóm đích: ' + esc(draft.targetGroupName) + '</div>' : '') +
      '<p class="draft-text">' + esc(draft.text.slice(0, 700)) + (draft.text.length > 700 ? '…' : '') + '</p>' +
      '<div class="btnrow">' + button('Sao chép', 'copyDraft', '', draft.id) + button('Sửa', 'editDraft', '', draft.id) +
      (draft.targetGroupUrl ? button('Mở nhóm', 'openDraftGroup', '', draft.id) : '') +
      button('Xóa', 'deleteDraft', 'warn', draft.id) + '</div></article>'
    ).join('') + '</div>';
  }


  function modulePromptKey() {
    return ({
      connect: 'comment',
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
      '<div class="btnrow">' + button('Tạo nháp bằng Gemini', 'generateModuleDraft', 'primary') + button('Sao chép prompt', 'copyModulePrompt') + '</div>' +
      '<div class="field"><label for="moduleOutput">Kết quả từ Meta AI hoặc AI bên ngoài</label><textarea id="moduleOutput" maxlength="20000" placeholder="Dán kết quả AI đã tạo ở bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả AI thành nháp', 'saveModuleOutputDraft') + button('Lưu nội dung nguồn', 'saveModuleDraft') + '</div>' +
      '<div class="banner">' + esc(safetyNote) + ' Bạn có thể sao chép prompt sang Meta AI hoặc công cụ khác rồi dán kết quả tại đây.</div><h3>Nháp gần đây</h3>' + draftList(4) +
      '</section><section class="panel blue"><h2>Ghi chú nghiệp vụ</h2><div class="field"><label for="moduleNote">Ghi chú nội bộ</label><textarea id="moduleNote" maxlength="2000" placeholder="Ghi yêu cầu cho module này...">' + esc(note) + '</textarea></div>' +
      button('Lưu ghi chú', 'saveNote', 'primary') + '</section></div>';
  }
  function renderGroups() {
    return '<div class="grid four">' +
      '<section class="panel"><h2>Quản lý nhóm</h2><p>Danh sách nhóm do bạn nhập thủ công</p><div class="metric"><div><small>Tổng nhóm</small>' + state.groups.length + '</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div>' +
      groupList() + '<div class="btnrow">' + button('Mở tối đa 5 nhóm đã chọn', 'openSelectedGroups') + button('Chọn tất cả', 'selectAll') + button('Bỏ chọn', 'deselectAll') + '</div>' +
      '<div class="btnrow">' + button('Nhập CSV', 'importGroups') + button('Xuất CSV', 'exportGroups') + '</div>' +
      field('Số nhóm mỗi đợt (cấu hình)', 'groupLimit', state.settings.groupLimit, 'number') + field('Khoảng cách (giây)', 'delay', state.settings.delay, 'number') +
      '<div class="banner">Chỉ mở tab nhóm để bạn tự xem và thao tác. Extension không tự đăng, bình luận hoặc gửi lời mời.</div>' + button('Lưu cấu hình', 'saveSettings', 'primary full') + '</section>' +
      '<section class="panel"><h2>Like / Cảm xúc</h2><p>Phân hệ tham khảo · chưa kích hoạt</p><div class="metric"><div><small>Đã thực hiện</small>0</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div><div class="placeholder">Tương tác tự động chưa được triển khai.</div></section>' +
      '<section class="panel"><h2>Bình luận AI</h2><p>Chuẩn bị bình luận nháp</p><div class="metric"><div><small>Đã gửi</small>0</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div><div class="placeholder">Tạo và duyệt nháp trước khi đăng thủ công.</div></section>' +
      '<section class="panel"><h2>Thêm nhóm</h2><p>Nhập tên và URL nhóm Facebook</p>' + field('Tên nhóm', 'groupName', '') + field('URL nhóm Facebook', 'groupUrl', '') + button('Thêm nhóm vào danh sách', 'addGroup', 'primary full') + '<div class="banner">Chỉ thêm nhóm thủ công. Không tự tìm hoặc tham gia nhóm.</div></section></div>';
  }

  function renderAI() {
    const options = [['demo', 'Demo (không gửi dữ liệu)'], ['gemini', 'Gemini API'], ['meta', 'Meta AI (chưa có API kết nối)']];
    const prompt = state.prompts.general || 'Hãy biên tập nội dung sau, không thêm dữ kiện: {content}';
    return '<div class="grid"><section class="panel blue"><h2>Hồ sơ AI dùng chung</h2><p>Chọn cấu hình mặc định</p><div class="field"><label for="provider">Provider</label><select id="provider">' + options.map(o => '<option value="' + o[0] + '" ' + (state.settings.provider === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      field('Model Gemini', 'model', state.settings.model || 'gemini-2.5-flash') +
      '<div class="field"><label for="geminiApiKey">Gemini API key (chỉ lưu trong phiên Chrome)</label><input id="geminiApiKey" type="password" maxlength="500" autocomplete="new-password" placeholder="Dán API key của bạn"></div>' +
      '<div class="btnrow">' + button('Lưu khóa trong phiên', 'saveGeminiKey', 'primary') + button('Xóa khóa', 'clearGeminiKey', 'warn') + '</div>' +
      '<div class="btnrow">' + button('Cấp quyền Gemini API', 'requestGeminiPermission') + button('Kiểm tra kết nối', 'testGemini') + '</div>' +
      '<div class="banner">Khóa API chỉ lưu trong chrome.storage.session, không xuất ra file cấu hình và sẽ mất khi phiên trình duyệt kết thúc. Khi tạo nội dung, văn bản sẽ được gửi tới Google Gemini.</div>' +
      '<div class="status-box"><span class="pill">' + (aiPermissionPresent ? 'Đã cấp quyền API' : 'Chưa cấp quyền API') + '</span> <span class="pill">' + (aiKeyPresent ? 'Đã có khóa trong phiên' : 'Chưa lưu khóa') + '</span></div>' +
      '<div id="aiOutput" class="placeholder output">' + esc(aiOutput || 'Kết quả kiểm tra hoặc nội dung AI sẽ hiển thị tại đây.') + '</div>' +
      button('Lưu cấu hình AI', 'saveSettings', 'primary') +
      '<h3>Hồ sơ theo chức năng</h3>' + (state.profiles.map(p => '<div class="log"><strong>' + esc(p.name) + '</strong> · ' + esc(p.provider) + (p.model ? ' · ' + esc(p.model) : '') + ' ' + button('Dùng hồ sơ', 'useProfile', 'primary compact', p.id) + ' ' + button('Xóa', 'deleteProfile', 'warn compact', p.id) + '</div>').join('') || '<div class="placeholder">Chưa có hồ sơ.</div>') +
      field('Tên hồ sơ mới', 'profileName', '') + button('Thêm hồ sơ', 'addProfile') +
      '</section><section class="panel purple"><h2>Soạn nội dung với AI</h2><p>Tạo nháp để đọc và chỉnh sửa trước khi sử dụng</p>' +
      '<div class="field"><label for="aiPrompt">Prompt</label><textarea id="aiPrompt" maxlength="20000">' + esc(prompt) + '</textarea></div>' +
      '<div class="field"><label for="aiInput">Nội dung đầu vào</label><textarea id="aiInput" maxlength="20000" placeholder="Dán nội dung, chủ đề hoặc yêu cầu..."></textarea></div>' +
      '<div class="btnrow">' + button('Tạo nháp bằng Gemini', 'generateAiDraft', 'primary') + button('Sao chép prompt', 'copyAiPrompt') + '</div>' +
      '<div class="field"><label for="aiExternalOutput">Kết quả từ Meta AI hoặc AI bên ngoài</label><textarea id="aiExternalOutput" maxlength="20000" placeholder="Dán kết quả AI đã tạo ở bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả AI thành nháp', 'saveExternalAiDraft') + button('Lưu nguyên văn đầu vào', 'saveAiDraft') + '</div>' +
      '<h3>Nháp gần đây</h3>' + draftList(5) + '</section></div>';
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
      '<div class="field"><label for="pageMessage">Nội dung bài viết</label><textarea id="pageMessage" maxlength="60000" placeholder="Kiểm tra kỹ nội dung trước khi đăng công khai..."></textarea></div>' +
      field('Link đính kèm (không bắt buộc, HTTPS)', 'pageLink', '') +
      button('Đăng bài lên Page', 'publishPagePost', 'primary full') +
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
      '<div class="btnrow">' + button('Tạo lời dẫn bằng Gemini', 'generateShareDraft', 'primary') + button('Sao chép prompt', 'copySharePrompt') + '</div>' +
      '<div class="field"><label for="shareExternalOutput">Kết quả từ Meta AI hoặc AI bên ngoài</label><textarea id="shareExternalOutput" maxlength="20000" placeholder="Dán lời dẫn đã tạo ở bên ngoài..."></textarea></div>' +
      '<div class="btnrow">' + button('Lưu kết quả thành nháp chia sẻ', 'saveExternalShareDraft') + button('Lưu nội dung nguồn', 'saveShare') + '</div>' +
      '<div class="banner">Tạo tối đa 5 bản nháp mỗi lượt để kiểm soát chi phí AI. Mỗi bản nháp gắn với một nhóm; bạn cần tự xem lại và đăng thủ công.</div></section>' +
      '<section class="panel"><h2>Chọn nhóm nhận bài</h2>' + groupList() + button('Mở tối đa 5 nhóm đã chọn', 'openSelectedGroups') + ' ' + button('Chọn tất cả', 'selectAll') + ' ' + button('Bỏ chọn', 'deselectAll') +
      '<h3>Thư viện bản nháp</h3>' + draftList(10) + '</section></div>';
  }

  function renderSchedule() {
    const tasks = state.tasks.slice().sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
    const statusText = { scheduled: 'Đã lên lịch', due: 'Đến hạn', done: 'Đã hoàn thành', missed: 'Đã bỏ qua' };
    return '<div class="grid"><section class="panel purple"><h2>Lịch chạy / nhắc việc</h2><p>Nhắc việc cục bộ bằng Chrome Alarms</p>' + field('Tên công việc', 'taskName', '') + field('Ngày giờ nhắc', 'taskTime', '', 'datetime-local') +
      button('Lưu nhắc việc', 'addTask', 'primary full') + '<div class="banner">Lịch chỉ nhắc người dùng; không tự thực thi hành động Facebook. Khi đến hạn, biểu tượng extension sẽ hiển thị huy hiệu.</div></section><section class="panel"><h2>Danh sách lịch</h2>' +
      (tasks.map(t => '<div class="task"><div><strong>' + esc(t.name) + '</strong><time>' + esc(t.time) + '</time><span class="pill">' + esc(statusText[t.status || 'scheduled'] || 'Đã lên lịch') + '</span></div><div class="btnrow">' +
        (t.status === 'due' ? button('Hoàn thành', 'completeTask', 'primary', t.id) : '') + button('Xóa', 'deleteTask', 'warn', t.id) + '</div></div>').join('') || '<div class="placeholder">Chưa có lịch.</div>') + '</section></div>';
  }
  function renderLogs() {
    const query = draftQuery.trim().toLowerCase();
    const filtered = state.drafts.slice().reverse().filter(draft => {
      const kind = draft.kind || 'source';
      const matchesKind = draftKindFilter === 'all' || kind === draftKindFilter;
      const matchesQuery = !query || draft.text.toLowerCase().includes(query) ||
        String(draft.targetGroupName || '').toLowerCase().includes(query) ||
        String(draft.url || '').toLowerCase().includes(query);
      return matchesKind && matchesQuery;
    });
    const library = filtered.length
      ? '<div class="draft-list">' + filtered.map(draft =>
          '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><time>' + esc(draft.createdAt) + '</time></div>' +
          (draft.targetGroupName ? '<div class="draft-target">Nhóm đích: ' + esc(draft.targetGroupName) + '</div>' : '') +
          '<p class="draft-text">' + esc(draft.text.slice(0, 700)) + (draft.text.length > 700 ? '…' : '') + '</p>' +
          '<div class="btnrow">' + button('Sao chép', 'copyDraft', '', draft.id) + button('Sửa', 'editDraft', '', draft.id) +
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
    if (page === 'groups') return renderGroups();
    if (page === 'pages') return renderPages();
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
  function render() {
    $('#sidebar').innerHTML = NAV.map(item =>
      '<button type="button" class="nav ' + (page === item[0] ? 'active' : '') + '" data-nav="' + item[0] + '"><span class="symbol" aria-hidden="true">' + item[1] + '</span><span>' + esc(item[2]) + '</span></button>'
    ).join('');
    $('#pageTitle').textContent = TITLES[page];
    $('#pageDesc').textContent = DESCS[page] || 'Module đang chuẩn bị kết nối và kiểm thử.';
    $('#view').innerHTML = renderPage();
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
    } catch (_) {
      aiKeyPresent = false;
      pageTokenPresent = false;
      aiPermissionPresent = false;
      graphPermissionPresent = false;
    }
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
    const draft = { id: crypto.randomUUID(), text: String(text).slice(0, 20000), url: String(url || '').slice(0, 2048), createdAt: new Date().toISOString(), kind: kind || 'source' };
    if (group) { draft.targetGroupId = group.id; draft.targetGroupName = group.name; draft.targetGroupUrl = group.url; }
    state.drafts.push(draft);
    if (state.drafts.length > 1000) state.drafts.shift();
    return draft;
  }
  function toast(message) {
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
    switch (name) {
      case 'saveSettings': {
        const groupLimit = Number($('#groupLimit') ? $('#groupLimit').value : state.settings.groupLimit);
        const delay = Number($('#delay') ? $('#delay').value : state.settings.delay);
        if (!Number.isFinite(groupLimit) || groupLimit < 1 || groupLimit > 10000 ||
            !Number.isFinite(delay) || delay < 0 || delay > 86400) {
          toast('Số nhóm phải từ 1–10000 và khoảng cách từ 0–86400 giây.');
          return;
        }
        state.settings.groupLimit = Math.floor(groupLimit);
        state.settings.delay = Math.floor(delay);
        state.settings.provider = $('#provider') ? $('#provider').value : state.settings.provider;
        state.settings.model = $('#model') ? $('#model').value.trim().slice(0, 120) : state.settings.model;
        log('Đã lưu cấu hình');
        break;
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
      case 'publishPagePost': {
        const pageId = $('#pageId').value.trim();
        const version = $('#graphVersion').value.trim() || 'v26.0';
        const message = $('#pageMessage').value.trim();
        const link = $('#pageLink').value.trim();
        if (!/^[0-9]{5,30}$/.test(pageId)) { toast('Nhập Page ID hợp lệ trước khi đăng.'); return; }
        if (!message || message.length > 60000) { toast('Nội dung bài viết phải có từ 1 đến 60.000 ký tự.'); return; }
        if (link) {
          let validLink = false;
          try { validLink = new URL(link).protocol === 'https:' && link.length <= 2048; } catch (_) {}
          if (!validLink) { toast('Link đính kèm phải là HTTPS hợp lệ.'); return; }
        }
        if (!/^v[0-9]{1,2}\.0$/.test(version)) { toast('Phiên bản Graph API không hợp lệ.'); return; }
        if (!await chrome.permissions.contains({ origins: [GRAPH_ORIGIN] })) { toast('Hãy cấp quyền Graph API trước khi đăng.'); return; }
        const stored = await chrome.storage.session.get(PAGE_TOKEN_KEY);
        const token = stored[PAGE_TOKEN_KEY];
        if (!token) { toast('Hãy lưu Page access token trong phiên Chrome trước.'); return; }
        if (!window.confirm('Bạn đang đăng công khai lên Facebook Page ' + pageId + '. Sau khi xác nhận, bài viết sẽ được gửi tới Meta. Tiếp tục?')) return;
        state.settings.pageId = pageId;
        state.settings.graphVersion = version;
        try {
          const result = await Facebook.publishPagePost({ pageId, accessToken: token, message, link, version });
          pagePublishStatus = 'Đăng thành công. Post ID: ' + result.id;
          log('Đã đăng bài lên Page ' + pageId + '; Post ID: ' + result.id);
          await save();
          render();
          toast('Đã đăng bài lên Page.');
        } catch (error) {
          pagePublishStatus = error.message;
          log('Đăng bài Page thất bại: ' + error.message);
          await save();
          render();
          toast(error.message);
        }
        return;
      }
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
        const batch = selected.slice(0, 5);
        if (!window.confirm('Mở ' + batch.length + ' tab nhóm Facebook để bạn thao tác thủ công?')) return;
        for (const group of batch) await chrome.tabs.create({ url: group.url, active: false });
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
        if (postUrl && (!/^https:\/\/(www\.)?facebook\.com\//i.test(postUrl) || postUrl.length > 2048)) {
          toast('Link bài viết phải là HTTPS trên facebook.com');
          return;
        }
        state.prompts.share = promptValue.slice(0, 20000);
        state.drafts.push({ id: crypto.randomUUID(), text: postText, url: postUrl, createdAt: new Date().toISOString() });
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
        state.settings.provider = ['demo', 'gemini', 'meta'].includes(profile.provider) ? profile.provider : 'demo';
        state.settings.model = profile.model || state.settings.model;
        if (profile.prompt) state.prompts.general = profile.prompt;
        log('Đã áp dụng hồ sơ AI: ' + profile.name);
        break;
      }
      case 'deleteProfile':
        state.profiles = state.profiles.filter(profile => profile.id !== id);
        log('Đã xóa hồ sơ AI');
        break;
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
          const output = await geminiRequest(prompt);
          if (!output) return;
          addDraft(output, '', 'ai');
          aiOutput = output;
          log('Đã tạo nháp bằng Gemini');
          break;
        } catch (error) {
          log('Gemini lỗi khi tạo nháp: ' + error.message);
          await save();
          toast(error.message);
          return;
        }
      }
      case 'generateShareDraft': {
        const postText = $('#postText').value.trim();
        const postUrl = $('#postUrl').value.trim();
        if (!postText || postText.length > 20000) { toast('Nhập nội dung bài gốc hợp lệ'); return; }
        if (postUrl && (!/^https:\/\/(www\.)?facebook\.com\//i.test(postUrl) || postUrl.length > 2048)) {
          toast('Link bài viết phải là HTTPS trên facebook.com'); return;
        }
        state.prompts.share = $('#sharePrompt').value.slice(0, 20000);
        const selected = state.groups.filter(group => group.selected && Core.isSafeFacebookGroupUrl(group.url));
        const targets = selected.length ? selected.slice(0, 5) : [{ id: '', name: 'Chưa chọn nhóm', url: '' }];
        if (selected.length > 5 && !window.confirm('Đã chọn ' + selected.length + ' nhóm. Tạo nháp cho 5 nhóm đầu tiên trong lượt này?')) return;
        if (!window.confirm('Gửi nội dung đầu vào tới Gemini để tạo ' + targets.length + ' bản nháp? Không có nội dung nào được đăng tự động.')) return;
        let created = 0;
        for (const group of targets) {
          let prompt = Core.fillPrompt(state.prompts.share, { postText, groupName: group.name });
          if (!state.prompts.share.includes('{postText}')) prompt += '\n\nNội dung bài gốc:\n' + postText;
          if (!state.prompts.share.includes('{groupName}')) prompt += '\n\nNgữ cảnh nhóm: ' + group.name;
          try {
            const output = await geminiRequest(prompt);
            if (!output) return;
            addDraft(output, postUrl, 'share', group.url ? group : null);
            created += 1;
            log('Đã tạo nháp lời dẫn' + (group.url ? ' cho nhóm ' + group.name : ''));
            await save();
          } catch (error) {
            log('Gemini lỗi khi tạo lời dẫn: ' + error.message);
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
        if (!output || output.length > 20000) { toast('Dán kết quả AI hợp lệ trước khi lưu'); return; }
        addDraft(output, '', 'ai');
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
        if (postUrl && (!/^https:\/\/(www\.)?facebook\.com\//i.test(postUrl) || postUrl.length > 2048)) {
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
        const edited = window.prompt('Chỉnh sửa bản nháp', draft.text);
        if (edited === null) return;
        if (!edited.trim() || edited.length > 20000) { toast('Nội dung nháp phải có từ 1 đến 20.000 ký tự'); return; }
        draft.text = edited.trim();
        draft.updatedAt = new Date().toISOString();
        log('Đã chỉnh sửa bản nháp');
        break;
      }
      case 'deleteDraft':
        state.drafts = state.drafts.filter(draft => draft.id !== id);
        log('Đã xóa bản nháp');
        break;
      case 'completeTask': {
        const task = state.tasks.find(item => item.id === id);
        if (task) { task.status = 'done'; log('Đã hoàn thành nhắc việc: ' + task.name); }
        break;
      }
      case 'deleteTask':
        state.tasks = state.tasks.filter(task => task.id !== id);
        log('Đã xóa nhắc việc');
        break;
      case 'addTask': {
        const nameValue = $('#taskName').value.trim();
        const timeValue = $('#taskTime').value;
        if (!nameValue || nameValue.length > 200 || !timeValue || Number.isNaN(Date.parse(timeValue))) {
          toast('Nhập tên công việc và thời gian hợp lệ');
          return;
        }
        state.tasks.push({ id: crypto.randomUUID(), name: nameValue, time: timeValue, status: 'scheduled' });
        log('Đã lưu nhắc việc: ' + nameValue);
        break;
      }
      case 'generateModuleDraft': {
        const input = $('#moduleInput').value.trim();
        const template = $('#modulePrompt').value.trim();
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        const promptKey = modulePromptKey();
        state.prompts[promptKey] = template.slice(0, 20000);
        let prompt = Core.fillPrompt(state.prompts[promptKey], { content: input });
        if (!state.prompts[promptKey].includes('{content}')) prompt += '\n\nNội dung được cung cấp:\n' + input;
        try {
          const output = await geminiRequest(prompt);
          if (!output) return;
          addDraft(output, '', 'ai');
          log('Đã tạo bản nháp bằng Gemini: ' + TITLES[page]);
          break;
        } catch (error) {
          log('Gemini lỗi tại module ' + TITLES[page] + ': ' + error.message);
          await save();
          toast(error.message);
          return;
        }
      }
      case 'saveModuleDraft': {
        const input = $('#moduleInput').value.trim();
        if (!input || input.length > 20000) { toast('Nhập nội dung đầu vào hợp lệ'); return; }
        const promptKey = modulePromptKey();
        state.prompts[promptKey] = $('#modulePrompt').value.slice(0, 20000);
        addDraft(input, '', 'source');
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
    toast('Đã lưu trên trình duyệt');
  }
  function init() {
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
      if (navButton) { page = navButton.dataset.nav; render(); return; }
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) action(actionButton.dataset.action, actionButton.dataset.id).catch(() => toast('Không thể hoàn tất thao tác.'));
    });
    document.addEventListener('change', event => {
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
