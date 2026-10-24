# Facebook AI Assistant

Chrome Extension Manifest V3 with a Vietnamese dashboard for managing Facebook content workflows and AI-assisted drafts.

## Phase 1–6 scope

- Thirteen navigation modules aligned with the reference screenshots, including a dedicated review queue.
- Local group list management, selection, CSV import/export, and safe URL validation.
- Manual contact tracking for Facebook profiles: save profile links, open them, and track invitation/connection/follow-up status without sending requests automatically.
- Gemini API adapter with optional host permission, timeout, and session-only API key storage.
- Meta AI Web UI integration (no Meta model API): request optional Chrome `scripting` and `meta.ai` host permissions, open the official website, fill the visible chat composer, send a prompt, wait for the response, and save the result as a local draft.
- Manual copy/paste fallback remains available if Meta AI changes its interface or requires user action.
- Group CSV import/export, per-group share drafts, manual group opening, a searchable draft library, and a manual engagement follow-up tracker.
- Optional Facebook Pages Graph API publishing and native Meta scheduling, using a Page access token, explicit host permission, and confirmation before public actions.
- A dedicated review queue tracks draft, approved, rejected, failed, scheduled, and published states.
- Editing a previously approved draft returns it to the review queue; publishing results and post IDs are linked back to the draft.
- Share-post drafts, Chrome Alarms reminders, activity log, and JSON/CSV export.
- Strict local import validation, source-link preservation, and escaping of user-provided values.
- GitHub Actions CI for unit tests, extension validation, and ZIP packaging.

## Install in Chrome

1. Download the CI artifact named facebook-ai-assistant-extension, or clone this repository and use the repository root.
2. Open chrome://extensions.
3. Enable Developer mode.
4. Select Load unpacked and choose the directory containing manifest.json.

## Configure Meta AI Web (no API)

1. Open the AI chung module and click **Cấp quyền và mở Meta AI**. Approve Chrome's optional `scripting` and `meta.ai` website permissions.
2. Sign in to Meta AI in the opened tab if the website asks you to. Do not share your Meta password with the extension.
3. Return to the extension, select Meta AI Web as the AI provider, and enter the content or brief.
4. Click the Meta AI Web generation button. The extension injects a small bridge into the visible `meta.ai` page, fills the chat input, clicks the site's Send button, waits for a stable answer, and saves that answer as a draft.
5. Review/edit the draft. Publishing to a Facebook Page remains a separate action with a separate confirmation; Meta AI output is never automatically published.

This is UI automation, not a supported Meta AI API. It uses the website session you already signed into and does not read cookies, extract session tokens, bypass login, CAPTCHA, rate limits, or access controls. Meta may change the web UI; if the extension cannot identify the composer, Send button, or answer, it stops with an error rather than guessing. Keep the Meta AI tab open and visible, and retry after completing any login or consent step. The prompt and source text are sent to Meta as part of the normal website chat when you click generate.

## Configure Gemini (optional)

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
5. Create or select a draft from **Duyệt bài**, review it, and choose **Duyệt & soạn Page**. In the Page composer, check the final content, optionally save edits back to the draft, then leave the publish-time field empty to publish immediately or choose a future time and confirm the action.

Scheduled posts must be at least 10 minutes and no more than 30 days ahead in this version. The extension sends the scheduled post to Meta using `published=false` and `scheduled_publish_time`. After Meta confirms, the returned post ID and schedule are saved locally, linked to the draft, and shown in Lịch chạy and Duyệt bài. Use Mở Planner to review the schedule in Meta Business Suite. The extension does not poll Meta for later publication status.

The extension calls the versioned Page feed endpoint. Meta may require app setup, business verification, permission review, or other eligibility checks. CI tests use mocked API responses; live publishing and scheduling have not been tested without your own Meta app, Page ID, and token.

## Current limitations

The extension does not log into Facebook, scrape Facebook pages/groups, send friend requests, join groups, or auto-publish posts/comments to groups or personal profiles. The scrape and learning modules work with text you paste in and can retain a source URL; they do not collect or scrape Facebook content automatically. Meta AI Web UI automation requires the user to grant optional `scripting` and `meta.ai` host permissions. It is not a model API integration and may need selector updates if the website changes. Gemini and Facebook Graph API access remain optional. No permanent Facebook host permission or cookies access is requested.

## Development

Requires Node.js 20 or newer. Run npm test, npm run validate, and npm run package. The generated extension archive is written to dist/facebook-ai-assistant.zip.

## Data and privacy

Application data is stored locally using chrome.storage.local. Exported JSON may contain group names and URLs, prompts, drafts, and reminders; review it before sharing. Gemini API keys and Page access tokens are deliberately excluded from exports. Meta AI Web uses your signed-in website session; the extension does not store Meta AI credentials or cookies.
