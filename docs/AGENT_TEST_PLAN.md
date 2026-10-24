# Facebook AI Assistant — Quy trình kiểm thử dành cho Coding Agent

## 1. Mục tiêu và nguyên tắc

Agent phải xác minh chức năng thực tế, tìm nguyên nhân lỗi, sửa lỗi và chạy kiểm thử hồi quy. Không kết luận "hoàn tất" chỉ dựa vào việc đọc mã nguồn hoặc unit test mô phỏng.

Repository: `vanhoa2191/facebook-assistant`  
Nhánh làm việc hiện tại: `feat/phase1-extension-ci`  
Lệnh kiểm thử chuẩn: `npm run check` (tương đương `npm test`, `npm run validate`, `npm run package`).

Nguyên tắc bắt buộc:
- Trước khi sửa, đọc README, manifest, package.json, mã nguồn liên quan và test hiện có; kiểm tra git status và nhánh.
- Không ghi đè thay đổi chưa commit của người dùng. Không force-push, không sửa `main`, không merge PR nếu chưa được giao rõ ràng.
- Mỗi lỗi phải có bước tái hiện, nguyên nhân gốc, thay đổi nhỏ nhất hợp lý và test hồi quy.
- Không làm yếu assertion, bỏ test, skip test hoặc chỉ sửa kỳ vọng để làm CI xanh nếu hành vi sản phẩm chưa được xác minh. Chỉ cập nhật test khi chứng minh assertion đã lỗi thời so với hành vi đúng; ghi rõ lý do.
- Dùng dữ liệu giả lập cho unit test. Kiểm thử tích hợp thật phải có sự đồng ý của người vận hành và tài khoản/Page thử nghiệm được cấp quyền.
- Không yêu cầu hoặc ghi log mật khẩu, cookie, session token, access token, API key hay dữ liệu cá nhân không cần thiết.
- Không tự động gửi lời mời kết bạn, tin nhắn, bình luận hoặc đăng nội dung công khai trong test. Mọi hành động ghi lên Page thật cần xác nhận rõ ràng và chỉ dùng Page thử nghiệm được phép.
- Chỉ đọc nội dung Facebook mà người dùng chủ động mở và có quyền truy cập. Không quét feed/profile hàng loạt, không tự cuộn để thu thập thêm, không vượt CAPTCHA/login/access control, không đọc cookie/token.
- Không suy luận thuộc tính nhạy cảm về cá nhân. Phân tích chỉ dựa trên nội dung và ngữ cảnh được cung cấp, ghi rõ giới hạn và độ không chắc chắn.

## 2. Cổng kiểm thử và điều kiện dừng

Thực hiện tuần tự. Nếu một cổng thất bại, sửa nguyên nhân rồi chạy lại cổng đó và các cổng hồi quy liên quan trước khi tiếp tục.

### Gate 0 — Xác định baseline
1. Ghi branch, commit SHA và `git status`.
2. Đọc `README.md`, `manifest.json`, `package.json`, `docs/`, `scripts/`, `src/`, `tests/`.
3. Chạy `node --version` (yêu cầu Node.js >= 20), `npm run check`.
4. Ghi kết quả từng lệnh và số test pass/fail; lưu log lỗi đầy đủ nhưng đã loại bỏ bí mật.
5. Kiểm tra GitHub Actions của commit hiện tại. Không dựa vào CI của commit cũ.

### Gate 1 — Static validation và packaging
Chạy:
- `npm run validate`
- `npm run package`
- `npm run check`

Xác nhận:
- Manifest V3 hợp lệ; phiên bản trong manifest/package/dashboard đồng bộ.
- Quyền bắt buộc tối thiểu; host permissions là optional theo thiết kế; không có quyền cookie hay host permission vĩnh viễn ngoài chủ đích.
- Mọi file entry point tồn tại; thứ tự nạp script đúng.
- ZIP có `manifest.json`, `dashboard.html` và `src/`; không đóng gói khóa bí mật, test fixture, file tạm hoặc dữ liệu cá nhân.
- Có thể giải nén ZIP và đọc manifest thành công; ghi SHA-256 và kích thước artifact.

### Gate 2 — Unit test và logic cốt lõi
Kiểm tra tối thiểu:
- Khởi tạo state mặc định, kiểm tra/chuẩn hóa state và import/export JSON/CSV.
- CSV có dấu phẩy trong dấu ngoặc kép, dấu nháy kép escape, Unicode tiếng Việt, BOM, dòng trống, header thiếu/trùng, tệp quá lớn và dữ liệu sai định dạng.
- Ghép hồ sơ: URL/ID ưu tiên; tên chỉ dùng fallback; xử lý tên trùng, URL sai và dữ liệu trùng.
- URL validation: chỉ chấp nhận scheme/host được phép; từ chối javascript:, data:, domain giả mạo, HTTP khi yêu cầu HTTPS và URL không hợp lệ.
- Lưu dữ liệu cục bộ, giới hạn dung lượng, xuất dữ liệu, xóa bản ghi và xóa toàn bộ theo xác nhận.
- Draft review lifecycle: draft → approved/rejected; sửa draft đã duyệt phải quay lại chờ duyệt; trạng thái scheduled/published không được xử lý như draft mới.
- Tuần báo cáo: khoảng thời gian 7 ngày, ranh giới timezone/ngày, không nhân đôi báo cáo cùng kỳ, bảo toàn tóm tắt AI khi cập nhật báo cáo.
- Bảo đảm HTML escape cho nội dung người dùng và dữ liệu nhập; thử chuỗi HTML/script độc hại.
- Xử lý lỗi, timeout, response rỗng, API quota/permission và không làm lộ secret trong log/toast/export.

### Gate 3 — Dashboard và luồng giao diện
Dùng smoke tests hiện có và bổ sung test khi cần:
- Dashboard khởi tạo không lỗi; mọi mục điều hướng hiển thị đúng trang.
- Thêm/sửa/xóa nhóm; chọn nhóm và giới hạn số tab mở.
- Hồ sơ liên hệ: thêm/sửa, trạng thái theo dõi, nhập CSV, ưu tiên URL/ID khi đối chiếu.
- Tạo draft thủ công và bằng AI; draft xuất hiện trong hàng đợi duyệt; mở nguồn; sửa draft; từ chối/xóa; lọc theo trạng thái.
- Nhắc việc: từ chối thời gian quá khứ, tạo lịch, đến hạn, badge/thông báo và deep link mở đúng dashboard.
- Phân tích & báo cáo: tạo báo cáo cục bộ, tóm tắt AI theo thao tác người dùng, xuất CSV Excel-compatible.
- Trạng thái kết nối Meta AI Web, Gemini và Facebook Page API phải độc lập, không hiển thị "đã kết nối" chỉ vì quyền được cấp.

### Gate 4 — Meta AI Web (UI integration)
Kiểm thử tự động với DOM mock:
1. Nhận diện composer hiển thị; textarea, input và contenteditable nếu hỗ trợ.
2. Không gửi khi composer/nút gửi không tìm thấy, disabled, ẩn hoặc prompt rỗng/quá giới hạn.
3. Điền prompt, gửi đúng một lần; không nhầm nút gửi với nút khác.
4. Chỉ nhận câu trả lời mới xuất hiện sau prompt hiện tại; không lấy lại câu trả lời cũ hoặc prompt người dùng.
5. Chờ câu trả lời ổn định; xử lý trạng thái đang tạo, lỗi giao diện, đăng nhập/consent, timeout và tab đóng.
6. Trả lỗi dễ hiểu; không lặp gửi tự động khi không rõ trạng thái đã gửi hay chưa.
7. Kết quả được lưu thành draft; không tự động xuất bản.
8. Quyền `scripting` và host permission `meta.ai`/`www.meta.ai` chỉ yêu cầu khi người dùng chủ động bật tính năng.

Kiểm thử thủ công trên Meta AI thật:
- Mở tab Meta AI, đăng nhập thủ công nếu cần.
- Dùng prompt vô hại, không chứa dữ liệu nhạy cảm; xác nhận prompt hiển thị và phản hồi đầy đủ.
- Kiểm tra phản hồi dài, lỗi mạng, yêu cầu đăng nhập/consent và giao diện không nhận diện được.
- Xác nhận draft được lưu, chỉnh sửa được, và không tự đăng lên Facebook.
- Không coi DOM mock là bằng chứng tích hợp thật đã thành công. Ghi trình duyệt, thời gian, kết quả và lỗi; không chụp/ghi dữ liệu riêng tư.

### Gate 5 — Facebook visible-post capture
Kiểm thử tự động với DOM mock:
- Chỉ chấp nhận URL bài viết/permalink phù hợp; từ chối feed chính, URL ngoài Facebook và trang không phải bài viết.
- Chỉ thu thập nội dung đang hiển thị trong main/article; bao gồm các comment/reply đã render.
- Không tự scroll, không gọi endpoint ẩn, không đọc cookie/token, không vượt quyền.
- Giới hạn độ dài, lọc nội dung ẩn/không hiển thị theo chính sách hiện có, giữ source URL và timestamp.
- Từ chối response sai cấu trúc, nguồn không hợp lệ hoặc text quá ngắn.
- Quan sát được lưu cục bộ, gán đúng contact đã chọn, tạo source draft và có thể mở nguồn/xóa.
- Phân tích chỉ bắt đầu khi người dùng bấm nút; lỗi AI không được làm mất quan sát gốc.

Kiểm thử thủ công:
- Người vận hành mở một permalink mà họ có quyền xem; tự tải các comment/reply cần kiểm tra.
- Bấm capture một lần, đối chiếu số và nội dung các khối đang hiển thị; xác nhận không tự cuộn.
- Thử trang feed, tab đăng nhập chưa hoàn tất và tab không phải Facebook; cần dừng an toàn với thông báo rõ ràng.
- Không dùng hồ sơ cá nhân thật không cần thiết; ưu tiên bài viết và tài khoản thử nghiệm.

### Gate 6 — Gemini và Facebook Page API
Gemini:
- Chỉ gọi khi người dùng chọn Gemini và cấp optional host permission.
- API key lưu trong session storage; không đưa vào local state, log, CSV/JSON export hoặc UI lỗi.
- Kiểm tra key/model/prompt sai, timeout, mạng lỗi, quota và phản hồi rỗng.

Facebook Page:
- Unit test phải mock Graph API, kiểm tra validation Page ID/version/content, xử lý lỗi API và lưu post ID/status.
- Token chỉ lưu trong session storage; không ghi log/export; yêu cầu host permission khi người dùng chủ động cấp quyền.
- Đăng ngay/lên lịch phải có màn hình xem lại và xác nhận cuối cùng.
- Kiểm tra giới hạn thời gian lên lịch và response từ Meta; không báo thành công nếu API chưa xác nhận.
- Không thực hiện live publish trong CI. Live test chỉ khi người vận hành cung cấp Page thử nghiệm và xác nhận rõ ràng. Ưu tiên test nháp hoặc môi trường không công khai nếu API hỗ trợ.

### Gate 7 — Storage, report và background service worker
- Kiểm tra onInstalled/onStartup, khôi phục alarm sau khi Chrome khởi động lại và đồng bộ alarm khi state thay đổi.
- Weekly report alarm tạo/cập nhật báo cáo đúng kỳ, không nhân đôi, giới hạn số bản ghi, lưu state trước khi thông báo.
- Notification permission bị từ chối phải không làm hỏng luồng chính; click notification mở đúng dashboard/mô-đun.
- Kiểm tra dữ liệu rỗng, state cũ/malformed, nhiều lần khởi động, alarm trễ và lỗi storage.
- Xác minh báo cáo 7 ngày được tính từ dữ liệu quan sát cục bộ, không tự gửi dữ liệu sang AI nếu chưa bấm nút.

### Gate 8 — Kiểm thử hồi quy và phát hành
1. Chạy `npm test`, `npm run validate`, `npm run package`, rồi `npm run check`.
2. Chạy CI mới trên đúng commit SHA; kiểm tra tất cả step pass và artifact được upload.
3. Xem diff để đảm bảo không xóa tính năng, giảm kiểm tra an toàn hoặc đưa bí mật vào repo.
4. Cài ZIP trên Chrome profile thử nghiệm bằng Load unpacked sau khi giải nén; xác nhận dashboard tải, không có lỗi console nghiêm trọng.
5. Chỉ đánh dấu pass các test đã có bằng chứng. Các mục cần tài khoản/quyền thật phải ghi `BLOCKED — cần người vận hành`, không tự coi là pass.
6. Không merge PR hoặc đẩy lên main nếu chưa có yêu cầu rõ ràng.

## 3. Ma trận test cần báo cáo

Agent tạo hoặc cập nhật `docs/TEST_REPORT.md` với bảng:
- ID
- Chức năng
- Loại test (unit / integration mock / manual)
- Bước tái hiện
- Kết quả mong đợi
- Kết quả thực tế
- PASS / FAIL / BLOCKED
- Bằng chứng (tên test, log CI, commit SHA; không chứa bí mật)
- Bug/commit khắc phục

Các nhóm ID tối thiểu: `BUILD`, `CORE`, `CSV`, `UI`, `META`, `FB-CAPTURE`, `GEMINI`, `PAGE`, `ALARM`, `PRIVACY`, `REGRESSION`.

## 4. Quy trình xử lý mỗi lỗi

Với từng lỗi:
1. Ghi ID, mức độ (P0/P1/P2/P3), môi trường và bước tái hiện tối thiểu.
2. Tạo test hồi quy thất bại trước khi sửa nếu khả thi.
3. Tìm nguyên nhân gốc, không chỉ sửa thông báo hoặc assertion.
4. Sửa thay đổi nhỏ, có phạm vi rõ ràng.
5. Chạy test liên quan rồi chạy toàn bộ `npm run check`.
6. Đọc diff, kiểm tra bảo mật/quyền và xác nhận test mới thực sự phát hiện lỗi cũ.
7. Commit lên nhánh phát triển hiện tại; không force-push.
8. Cập nhật `docs/TEST_REPORT.md`, ghi commit SHA và CI run URL.

Mức độ:
- P0: lộ token/dữ liệu, thao tác công khai trái phép, vượt quyền — dừng phát hành ngay.
- P1: chức năng chính hỏng hoặc mất dữ liệu — chặn phát hành.
- P2: chức năng phụ sai nhưng có workaround — cần sửa hoặc ghi rõ rủi ro.
- P3: cải thiện giao diện/không ảnh hưởng dữ liệu — có thể để backlog.

## 5. Định nghĩa hoàn tất

Chỉ kết luận **PASS — sẵn sàng kiểm thử người dùng** khi:
- Static validation, toàn bộ unit tests, packaging và CI đều pass trên cùng commit.
- Không còn P0/P1 chưa xử lý.
- ZIP đã được xác minh nội dung và cài đặt được trên Chrome thử nghiệm.
- Mọi chức năng cốt lõi có bằng chứng kiểm thử; mọi kiểm thử phụ thuộc tài khoản thật được đánh dấu PASS hoặc BLOCKED trung thực.
- Có `docs/TEST_REPORT.md` với commit SHA, CI URL, artifact link, danh sách lỗi đã sửa và giới hạn còn lại.

Chỉ kết luận **PASS — xác minh tích hợp thực tế** sau khi các luồng Meta AI Web, Facebook capture và (nếu được phép) Page API được kiểm thử trên môi trường thật. Unit test/mock không thay thế bước này.

## 6. Prompt giao việc cho Agent

> Làm theo `docs/AGENT_TEST_PLAN.md` từ Gate 0 đến Gate 8. Kiểm tra trạng thái repo và commit hiện tại trước khi sửa. Tái hiện lỗi, viết test hồi quy, sửa nguyên nhân gốc và chạy toàn bộ `npm run check`. Không bỏ/skip test để làm xanh CI. Không tự đăng bài, gửi tin nhắn/lời mời hoặc thực hiện hành động công khai; mọi live test cần xác nhận và tài khoản/Page thử nghiệm. Cập nhật `docs/TEST_REPORT.md` với PASS/FAIL/BLOCKED và bằng chứng. Commit các thay đổi lên nhánh phát triển hiện tại, không merge PR hay sửa main. Báo cáo cuối gồm commit SHA, kết quả từng gate, CI run URL, artifact URL, lỗi còn lại và những gì cần người vận hành thực hiện.
