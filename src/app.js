'use strict';

(function () {
  const Core = window.FAACore;
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

  function field(label, id, value, type) {
    return '<div class="field"><label for="' + esc(id) + '">' + esc(label) + '</label><input id="' + esc(id) + '" type="' + (type || 'text') + '" value="' + esc(value == null ? '' : value) + '"></div>';
  }
  function button(label, action, extra) {
    return '<button type="button" class="btn ' + (extra || '') + '" data-action="' + esc(action) + '">' + esc(label) + '</button>';
  }
  function groupList() {
    if (!state.groups.length) return '<div class="placeholder">Chưa có nhóm. Thêm nhóm thủ công bằng tên và URL để bắt đầu.</div>';
    return '<div class="group-list">' + state.groups.map(group =>
      '<label class="group"><input type="checkbox" class="group-check" data-id="' + esc(group.id) + '" ' + (group.selected ? 'checked' : '') + '><span class="pill">Nhóm</span><span>' + esc(group.name) + '</span></label>'
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
    const options = [['demo', 'Demo (không gửi dữ liệu)'], ['gemini', 'Gemini API (chưa kết nối)'], ['meta', 'Meta AI (chưa kết nối)']];
    return '<div class="grid"><section class="panel blue"><h2>Hồ sơ AI dùng chung</h2><p>Chọn cấu hình mặc định</p><div class="field"><label for="provider">Provider</label><select id="provider">' + options.map(o => '<option value="' + o[0] + '" ' + (state.settings.provider === o[0] ? 'selected' : '') + '>' + o[1] + '</option>').join('') + '</select></div>' +
      field('Model', 'model', state.settings.model) + field('Tên hồ sơ mới', 'profileName', '') + button('Lưu cấu hình', 'saveSettings', 'primary') + ' ' + button('Thêm hồ sơ', 'addProfile') +
      '<div class="banner">Provider chỉ là cấu hình mô phỏng. Chưa gửi request AI và không nhập API key ở bản này.</div><h3>Danh sách hồ sơ</h3>' +
      (state.profiles.map(p => '<div class="log">' + esc(p.name) + ' · ' + esc(p.provider) + '</div>').join('') || '<div class="placeholder">Chưa có hồ sơ.</div>') +
      '</section><section class="panel purple"><h2>Worker AI theo chức năng</h2><p>Thiết kế ngữ cảnh độc lập cho từng tác vụ</p><div class="placeholder">Chưa kết nối Meta AI. Không giả lập kết quả gọi AI.</div><h3>Hồ sơ theo tính năng</h3>' +
      NAV.filter(item => ['groups', 'share', 'sales', 'feed'].includes(item[0])).map(item => '<div class="log">' + esc(item[2]) + ' <span class="pill">Mặc định</span></div>').join('') + '</section></div>';
  }
  function renderShare() {
    return '<div class="grid"><section class="panel blue"><h2>Chia sẻ bài vào nhóm</h2><p>Chuẩn bị lời dẫn theo ngữ cảnh, chưa tự đăng</p>' +
      field('Link bài viết Facebook', 'postUrl', '') +
      '<div class="field"><label for="sharePrompt">Prompt — dùng {postText} và {groupName}</label><textarea id="sharePrompt" maxlength="20000">' + esc(state.prompts.share) + '</textarea></div>' +
      '<div class="field"><label for="postText">Nội dung bài gốc</label><textarea id="postText" maxlength="20000" placeholder="Dán nội dung bạn được phép sử dụng"></textarea></div>' +
      field('Số nhóm muốn chuẩn bị', 'shareCount', 1, 'number') + field('Khoảng cách (giây)', 'shareDelay', 30, 'number') +
      button('Lưu prompt và tạo nháp', 'saveShare', 'primary full') + '<div class="banner">Chưa tự động đăng hoặc chia sẻ. Nháp được lưu trên trình duyệt.</div></section>' +
      '<section class="panel"><h2>Chọn nhóm nhận bài</h2>' + groupList() + button('Chọn tất cả', 'selectAll') + ' ' + button('Bỏ chọn', 'deselectAll') +
      '<h3>Nháp gần đây</h3>' + (state.drafts.slice(-5).reverse().map(d => '<div class="log">' + esc(d.text.slice(0, 180)) + '</div>').join('') || '<div class="placeholder">Chưa có nháp.</div>') + '</section></div>';
  }
  function renderSchedule() {
    return '<div class="grid"><section class="panel purple"><h2>Lịch chạy</h2><p>Lịch cục bộ cho nhắc việc</p>' + field('Tên công việc', 'taskName', '') + field('Ngày giờ nhắc', 'taskTime', '', 'datetime-local') +
      button('Lưu nhắc việc', 'addTask', 'primary full') + '<div class="banner">Chỉ lưu lịch, chưa tự thực thi hành động Facebook.</div></section><section class="panel"><h2>Danh sách lịch</h2>' +
      (state.tasks.map(t => '<div class="log">' + esc(t.name) + ' · ' + esc(t.time) + '</div>').join('') || '<div class="placeholder">Chưa có lịch.</div>') + '</section></div>';
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
  async function action(name) {
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
      case 'addTask': {
        const nameValue = $('#taskName').value.trim();
        const timeValue = $('#taskTime').value;
        if (!nameValue || nameValue.length > 200 || !timeValue || Number.isNaN(Date.parse(timeValue))) {
          toast('Nhập tên công việc và thời gian hợp lệ');
          return;
        }
        state.tasks.push({ id: crypto.randomUUID(), name: nameValue, time: timeValue });
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
      render();
    }).catch(() => {
      render();
      toast('Không đọc được dữ liệu cục bộ.');
    });
    document.addEventListener('click', event => {
      const navButton = event.target.closest('[data-nav]');
      if (navButton) { page = navButton.dataset.nav; render(); return; }
      const actionButton = event.target.closest('[data-action]');
      if (actionButton) action(actionButton.dataset.action).catch(() => toast('Không thể lưu thay đổi.'));
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
