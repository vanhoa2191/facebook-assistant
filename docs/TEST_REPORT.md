# Facebook AI Assistant — Báo cáo kiểm thử và sửa lỗi

Ngày cập nhật: 24/10/2026 (Asia/Ho_Chi_Minh)  
Phiên bản: 0.7.3  
Nhánh: `feat/phase1-extension-ci`  
Commit đã kiểm thử: `e6e03ddaceb657dde622cec9317d8bf0ca08a0a1`

## Kết luận

**PASS — kiểm thử tự động và đóng gói trên commit này.**  
**BLOCKED — xác minh extension đang cài, mở dashboard trong Chrome thật, Meta AI Web thật, capture thật và Page API thật.**

Không có thao tác đăng bài/gửi tin nhắn trong kiểm thử. Chưa sửa `main`, chưa merge PR.

## Bằng chứng CI

- Workflow: https://github.com/vanhoa2191/facebook-assistant/actions/runs/40057456830
- Kết quả: success.
- Static validation: PASS.
- Unit tests: 70 PASS, 0 FAIL, 0 SKIP.
- Package: PASS; ZIP được tạo và tải lên artifact.
- Artifact: https://github.com/vanhoa2191/facebook-assistant/actions/runs/40057456830/artifacts/12545288780
- Kích thước artifact do GitHub báo: 46,426 bytes.
- SHA-256 digest artifact: `ce2f33a97dc2dc26f5f239ba54b030827b135dc96d5a40115a7fbf3237c64e0d`.

Artifact này gắn với commit nêu trên; không dùng hash ZIP local của lượt kiểm thử trước để đại diện cho artifact mới.

## Lỗi được sửa và kiểm thử hồi quy

| ID | Sửa đổi | Bằng chứng |
|---|---|---|
| BUG-01 / P1 | Chỉ đăng ký `chrome.notifications.onClicked` khi API và `addListener` hiện diện. Listener `chrome.action.onClicked` vẫn được đăng ký độc lập. | Test mới: worker vẫn đăng ký action và mở dashboard URL khi Notifications API vắng mặt. |
| BUG-02 / P1 | Không dùng tên làm fallback ghép hồ sơ khi bản ghi nhập có Facebook ID hoặc URL chứa ID khác. Không ghi đè identity chỉ vì tên hiển thị trùng nhau. | Test mới: hồ sơ ID 111 giữ nguyên trạng thái connected, hồ sơ ID 222 được thêm riêng. |
| BUG-03 / P2 | Validate permalink theo route và định danh cụ thể; từ chối `/watch/`, `/photos/`, `/?fbid=123` và các URL listing tương tự. | Test mới cho cả nhóm URL không hợp lệ và các permalink post/video/story/photo cụ thể. |
| BUG-04 / P1 | Upsert báo cáo cùng ID giữ `aiSummary` và `aiSummaryAt` nếu báo cáo thống kê mới không có tóm tắt AI. | Test mới gọi luồng tạo báo cáo qua dashboard và xác nhận tóm tắt cũ còn nguyên. |

Các thay đổi trên đã được commit lần lượt trong lịch sử nhánh phát triển; commit cuối cùng được CI kiểm thử là `e6e03ddaceb657dde622cec9317d8bf0ca08a0a1`.

## Phạm vi đã chạy

- `npm run validate`: PASS.
- `npm test`: 70 PASS, 0 FAIL, 0 SKIP.
- `npm run package`: PASS.
- `npm run check`: workflow gọi đầy đủ validate, test và package; PASS trên commit nêu trên.
- Các test mới bao gồm: worker thiếu Notifications API, collision CSV theo Facebook ID, route permalink, giữ tóm tắt AI.

## Ma trận hiện tại

| Nhóm | Trạng thái | Ghi chú |
|---|---|---|
| BUILD / static / package | PASS | CI đúng commit xanh và có artifact. |
| CORE / unit | PASS trong phạm vi suite | Không khẳng định bao phủ mọi tình huống. |
| CSV identity collision | PASS trong mock | Kiểm tra ID khác không ghi đè người cũ. |
| UI dashboard | PASS trong mock | Chưa cài artifact mới lên Chrome thật. |
| UI-LAUNCH | BLOCKED | Cần người vận hành xác minh service worker của extension đang cài và biểu tượng mở dashboard. BUG-01 chỉ xác nhận độ bền khi Notifications API thiếu; chưa chứng minh đây là nguyên nhân triệu chứng thực tế. |
| Meta AI Web | PASS trong DOM mock; live BLOCKED | Cần tài khoản/browser thật, prompt vô hại và kiểm tra phản hồi mới được lưu thành draft. |
| Facebook visible-post capture | PASS trong DOM mock; live BLOCKED | Cần permalink do người vận hành chủ động mở; không tự scroll hoặc vượt quyền. |
| Gemini | PASS trong API mock; live BLOCKED | Chưa có cấu hình API được cấp cho kiểm thử. |
| Page API | PASS trong API mock; live BLOCKED | Chưa có Page thử nghiệm và xác nhận live test. |
| Alarm/notification | PASS trong worker mock | Có test thiếu Notifications API; restart Chrome thực tế chưa được xác minh. |
| Privacy | PASS trong static/mock | Chưa xác minh storage/permission của extension đang cài. |
| REGRESSION | PASS cho CI; BLOCKED cho live | Không có lỗi test tự động còn lại; xác minh người dùng vẫn cần thực hiện. |

## Bước tiếp theo cần người vận hành

1. Cài artifact mới trong Chrome profile thử nghiệm, hoặc Load unpacked từ đúng commit.
2. Mở `chrome://extensions`, bật Developer mode và mở **Details → Inspect views / service worker** để xem lỗi thật khi bấm biểu tượng. Ghi phiên bản và commit/ZIP đã cài.
3. Xác nhận action click mở `dashboard.html`; nếu vẫn lỗi, cung cấp thông báo console/service worker đã loại bỏ bí mật.
4. Chỉ sau khi dashboard mở được, thực hiện CRUD/persistence, Meta AI Web và capture trên dữ liệu người dùng được phép xem.
5. Page API live test chỉ thực hiện với Page thử nghiệm và xác nhận rõ ràng. Không đăng công khai trong CI.

## Tiêu chí kết luận

CI xanh không đồng nghĩa với tích hợp thực tế đã được xác minh. Không đánh dấu live test PASS cho tới khi có bằng chứng browser thật. Không gộp PR hoặc phát hành chính thức khi dashboard launch và các luồng live còn BLOCKED.
