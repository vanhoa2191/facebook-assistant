'use strict';

(function () {
  const Core = window.FAACore;
  const Gemini = window.FAAAI;
  const GEMINI_ORIGIN = 'https://generativelanguage.googleapis.com/*';
  const GEMINI_KEY = 'faa.geminiApiKey';
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

  function field(label, id, value, type) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(label) + '</label><input id="' + esc(id) + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"></div>';
  }
  function button(label, action, extra) {
    return '<button type="button" class="btn ' + (extra || '') + '" data-action="' + esc(action) + '">' + esc(label) + '</button>';
  }
  function groupList() {
    if (!state.groups.length) return '<div class="placeholder">Chưa có nhóm. Thêm nhóm thủ công bằng tên và URL để bắt đầu.</div>';
    return '<div class="group-list">' + state.groups.map(group =>
      '<div class="group"><input type="checkbox" aria-label="Chọn ' + esc(group.name) + '" class="group-check" data-id="' + esc(group.id) + '" ' + (group.selected ? 'checked' : '') + '><span class="pill">Nhóm</span><span class="group-name">' + esc(group.name) + '</span>' +
      button('Xóa', 'deleteGroup', 'warn compact', group.id) + '</div>'
    ).join('') + '</div>';
  }

  function draftList(limit) {
    const drafts = state.drafts.slice().reverse().slice(0, limit || 10);
    if (!drafts.length) return '<div class="placeholder">Chưa có bản nháp.</div>';
    return '<div class="draft-list">' + drafts.map(draft =>
      '<article class="draft"><div class="draft-meta"><span class="pill">' + esc(draft.kind || 'source') + '</span><time>' + esc(draft.createdAt) + '</time></div>' +
      '<p class="draft-text">' + esc(draft.text.slice(0, 700)) + (draft.text.length > 700 ? '…' : '') + '</p>' +
      '<div class="btnrow">' + button('Sao chép', 'copyDraft', '', draft.id) + button('Xóa', 'deleteDraft', 'warn', draft.id) + '</div></article>'
    ).join('') + '</div>';
  }


  function generic(title, description) {
    const note = state.moduleNotes[page] || '';
    return '<div class="grid"><section class="panel"><h2>' + esc(title) + '</h2><p>' + esc(description) + '</p><div class="placeholder" style="margin-top:20px">Module đã có vị trí trong kiến trúc.<br>Chưa có kết nối hoặc hành động tự động trong giai đoạn 1.</div></section><section class="panel blue"><h2>Ghi chú nghiệp vụ</h2><div class="field"><label for="moduleNote">Ghi chú nội bộ</label><textarea id="moduleNote" maxlength="2000" placeholder="Ghi yêu cầu cho module này...">' + esc(note) + '</textarea></div>' + button('Lưu ghi chú', 'saveNote', 'primary') + '</section></div>';
  }
  function renderGroups() {
    return '<div class="grid four">' +
      '<section class="panel"><h2>Đăng bài AI lên nhóm</h2><p>Quản lý danh sách và chọn nhóm cần đăng</p><div class="metric"><div><small>Tổng nhóm</small>' + state.groups.length + '</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div>' +
      groupList() + field('Số nhóm mỗi đợt', 'groupLimit', state.settings.groupLimit, 'number') + field('Khoảng cách (giây)', 'delay', state.settings.delay, 'number') +
      '<div class="banner">Chưa kết nối Facebook. Chỉ chuẩn bị nội dung và lưu nháp.</div>' + button('Lưu cấu hình', 'saveSettings', 'primary full') + '</section>' +
      '<section class="panel"><h2>Like / Cảm xúc</h2><p>Phân hệ tham khảo · chưa kích hoạt</p><div class="metric"><div><small>Đã thực hiện</small>0</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div><div class="placeholder">Tương tác tự động chưa được triển khai.</div></section>' +
      '<section class="panel"><h2>Bình luận AI</h2><p>Chuẩn bị bình luận nháp</p><div class="metric"><div><small>Đã gửi</small>0</div><div><small>Đã chọn</small>' + state.groups.filter(g => g.selected).length + '</div></div><div class="placeholder">Có thể chuẩn bị nháp sau khi tích hợp AI; chưa tự gửi.</div></section>' +
      '<section class="panel"><h2>Tìm và quản lý nhóm</h2><p>Thêm nhóm mà bạn muốn quản lý</p>' + field('Tên nhóm', 'groupName', '') + field('URL nhóm Facebook', 'groupUrl', '') + button('Thêm nhóm vào danh sách', 'addGroup', 'primary full') + '<div class="banner">Chỉ thêm nhóm thủ công. Không tự tìm hoặc tham gia nhóm.</div></section></div>';
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
      '<h3>Hồ sơ theo chức năng</h3>' + (state.profiles.map(p => '<div class="log"><strong>' + esc(p.name) + '</strong> · ' + esc(p.provider) + (p.model ? ' · ' + esc(p.model) : '') + ' ' + button('Xóa', 'deleteProfile', 'warn compact', p.id) + '</div>').join('') || '<div class="placeholder">Chưa có hồ sơ.</div>') +
      field('Tên hồ sơ mới', 'profileName', '') + button('Thêm hồ sơ', 'addProfile') +
      '</section><section class="panel purple"><h2>Soạn nội dung với AI</h2><p>Tạo nháp để đọc và chỉnh sửa trước khi sử dụng</p>' +
      '<div class="field"><label for="aiPrompt">Prompt</label><textarea id="aiPrompt" maxlength="20000">' + esc(prompt) + '</textarea></div>' +
      '<div class="field"><label for="aiInput">Nội dung đầu vào</label><textarea id="aiInput" maxlength="20000" placeholder="Dán nội dung, chủ đề hoặc yêu cầu..."></textarea></div>' +
      '<div class="btnrow">' + button('Tạo nháp bằng Gemini', 'generateAiDraft', 'primary') + button('Lưu nguyên văn thành nháp', 'saveAiDraft') + '</div>' +
      '<h3>Nháp gần đây</h3>' + draftList(5) + '</section></div>';
  }
  function renderShare() {
    return '<div class="grid"><section class="panel blue"><h2>Chia sẻ bài vào nhóm</h2><p>Tạo lời dẫn phù hợp với nhóm; chưa tự đăng</p>' +
      field('Link bài viết Facebook (không bắt buộc)', 'postUrl', '') +
      '<div class="field"><label for="sharePrompt">Prompt — dùng {postText} và {groupName}</label><textarea id="sharePrompt" maxlength="20000">' + esc(state.prompts.share) + '</textarea></div>' +
      '<div class="field"><label for="postText">Nội dung bài gốc</label><textarea id="postText" maxlength="20000" placeholder="Dán nội dung bạn được phép sử dụng"></textarea></div>' +
      '<div class="btnrow">' + button('Tạo lời dẫn bằng Gemini', 'generateShareDraft', 'primary') + button('Lưu nội dung thành nháp', 'saveShare') + '</div>' +
      '<div class="banner">Chưa tự động đăng hoặc chia sẻ. Nháp được lưu trên trình duyệt.</div></section>' +
      '<section class="panel"><h2>Chọn nhóm nhận bài</h2>' + groupList() + button('Chọn tất cả', 'selectAll') + ' ' + button('Bỏ chọn', 'deselectAll') +
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
    return '<section class="panel"><h2>Nhật ký và sao lưu</h2><p>Lịch sử thao tác trong extension</p><div class="btnrow">' + button('Xuất nhật ký CSV', 'exportLogs', 'primary') + button('Xóa nhật ký', 'clearLogs', 'warn') + '</div>' +
      (state.logs.slice().reverse().map(log => '<div class="log"><time>' + esc(log.at) + '</time>' + esc(log.message) + '</div>').join('') || '<div class="placeholder">Chưa có nhật ký.</div>') + '</section>';
  }
  function renderPage() {
    if (page === 'groups') return renderGroups();
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
      const stored = await chrome.storage.session.get(GEMINI_KEY);
      aiKeyPresent = typeof stored[GEMINI_KEY] === 'string' && stored[GEMINI_KEY].length > 0;
      aiPermissionPresent = await chrome.permissions.contains({ origins: [GEMINI_ORIGIN] });
    } catch (_) { aiKeyPresent = false; aiPermissionPresent = false; }
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
  function addDraft(text, url, kind) {
    const draft = { id: crypto.randomUUID(), text: String(text).slice(0, 20000), url: String(url || '').slice(0, 2048), createdAt: new Date().toISOString(), kind: kind || 'source' };
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
      case 'addProfile': {
        const nameValue = $('#profileName').value.trim();
        if (!nameValue || nameValue.length > 200) { toast('Nhập tên hồ sơ hợp lệ'); return; }
        state.profiles.push({ id: crypto.randomUUID(), name: nameValue, provider: $('#provider').value });
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
        if (postUrl && (!/^https:\/\/(www\.)?facebook\.com\//i.test(postUrl) || postUrl.length > 2048)) { toast('Link bài viết phải là HTTPS trên facebook.com'); return; }
        state.prompts.share = $('#sharePrompt').value.slice(0, 20000);
        const selected = state.groups.filter(group => group.selected);
        const groupName = selected.length ? selected[0].name : 'nhóm phù hợp';
        let prompt = Core.fillPrompt(state.prompts.share, { postText, groupName });
        if (!state.prompts.share.includes('{postText}')) prompt += '\n\nNội dung bài gốc:\n' + postText;
        if (!state.prompts.share.includes('{groupName}')) prompt += '\n\nNgữ cảnh nhóm: ' + groupName;
        try {
          const output = await geminiRequest(prompt);
          if (!output) return;
          addDraft(output, postUrl, 'share');
          log('Đã tạo nháp lời dẫn bằng Gemini');
          break;
        } catch (error) {
          log('Gemini lỗi khi tạo lời dẫn: ' + error.message);
          await save();
          toast(error.message);
          return;
        }
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
      case 'saveNote': {
        const note = $('#moduleNote').value.trim();
        state.moduleNotes[page] = note.slice(0, 2000);
        log('Đã lưu ghi chú: ' + TITLES[page]);
        break;
      }
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
    chrome.storage.local.get('faa.state').then(result => {
      const stored = result['faa.state'];
      if (Core.isValidState(stored)) state = stored;
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
        const imported = JSON.parse(await file.text());
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
    $('#openHelp').addEventListener('click', () => {
      page = 'logs';
      render();
      toast('Xem README.md để biết hướng dẫn cài đặt.');
    });
  }
  init();
})();
