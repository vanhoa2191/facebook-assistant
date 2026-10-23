# Facebook AI Assistant

Chrome Extension Manifest V3 with a Vietnamese dashboard for managing Facebook content workflows and AI-assisted drafts.

## Phase 1–5 scope

- Twelve navigation modules aligned with the reference screenshots.
- Local group list management, selection, and safe URL validation.
- Gemini API adapter with optional host permission, timeout, and session-only API key storage.
- Manual Meta AI workflow: copy a prompt to another AI tool and save its result as a draft.
- Group CSV import/export, per-group share drafts, manual group opening, and a searchable draft library.
- Optional Facebook Pages Graph API publishing and native Meta scheduling, using a Page access token, explicit host permission, and confirmation before public actions.
- AI-generated content and share copy are saved as drafts for review.
- Share-post drafts, Chrome Alarms reminders, activity log, and JSON/CSV export.
- Strict local import validation and escaping of user-provided values.
- GitHub Actions CI for unit tests, extension validation, and ZIP packaging.

## Install in Chrome

1. Download the CI artifact named facebook-ai-assistant-extension, or clone this repository and use the repository root.
2. Open chrome://extensions.
3. Enable Developer mode.
4. Select Load unpacked and choose the directory containing manifest.json.

## Configure Gemini

1. Open the AI chung module and select Gemini API.
2. Click Cấp quyền Gemini API and accept Chrome's permission prompt.
3. Paste your Gemini API key and click Lưu khóa trong phiên.
4. Use Kiểm tra kết nối, then enter a prompt and source text to generate a draft.
5. Review the draft before copying it into another workflow.

The key is stored in chrome.storage.session, not in exported JSON or the activity log, and is normally cleared when the Chrome session ends. It remains usable by the extension while the current session is active. Prompts and source text are sent to Google when you run a Gemini request. Do not send confidential or personal data unless you are authorized to do so.

## Facebook Page publishing

1. In the Nuôi Page module, enter the numeric Page ID and Graph API version (defaults to `v26.0`).
2. Obtain a Page access token from your Meta app with the required `pages_manage_posts` permission and access to that Page.
3. Click Cấp quyền Graph API and approve the optional Chrome host permission.
4. Paste the token and click Lưu token trong phiên. The token is stored in `chrome.storage.session`, not in exports or logs.
5. Enter the post text and optional HTTPS link. Leave the publish-time field empty to publish immediately, or choose a future time and confirm the action.

Scheduled posts must be at least 10 minutes and no more than 30 days ahead in this version. The extension sends the scheduled post to Meta using `published=false` and `scheduled_publish_time`. After Meta confirms, the returned post ID and schedule are saved locally and shown in Lịch chạy. Use Mở Planner to review the schedule in Meta Business Suite. The extension does not poll Meta for later publication status.

The extension calls the versioned Page feed endpoint. Meta may require app setup, business verification, permission review, or other eligibility checks. CI tests use mocked API responses; live publishing and scheduling have not been tested without your own Meta app, Page ID, and token.

## Current limitations

The extension does not log into Facebook, scrape Facebook pages/groups, send friend requests, join groups, or auto-publish posts/comments to groups or personal profiles. The scrape and learning modules work with text you paste in; they do not collect data from Facebook. Gemini access and Graph API host access are optional. Meta AI is supported as a manual copy/paste workflow rather than an automated Meta AI API integration. No permanent Facebook host permission or cookies access is requested.

## Development

Requires Node.js 20 or newer. Run npm test, npm run validate, and npm run package. The generated extension archive is written to dist/facebook-ai-assistant.zip.

## Data and privacy

Application data is stored locally using chrome.storage.local. Exported JSON may contain group names and URLs, prompts, drafts, and reminders; review it before sharing. Gemini API keys and Page access tokens are deliberately excluded from exports.
