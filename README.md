# Facebook AI Assistant

Chrome Extension Manifest V3 with a Vietnamese dashboard for managing Facebook content workflows and AI-assisted drafts.

## Phase 1–2 scope

- Twelve navigation modules aligned with the reference screenshots.
- Local group list management, selection, and safe URL validation.
- Gemini API adapter with optional host permission, timeout, and session-only API key storage.
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

## Current limitations

Facebook login, scraping, posting, sharing, comments, friend requests, and group joining are not implemented. The scrape and learning modules work with text that you paste in; they do not collect data from Facebook. Gemini API access is optional. Meta AI remains a placeholder because this extension does not implement an official Meta AI API adapter. No permanent Facebook host permissions or cookies access are requested.

## Development

Requires Node.js 20 or newer. Run npm test, npm run validate, and npm run package. The generated extension archive is written to dist/facebook-ai-assistant.zip.

## Data and privacy

Application data is stored locally using chrome.storage.local. Exported JSON may contain group names and URLs, prompts, drafts, and reminders; review it before sharing. Gemini API keys are deliberately excluded from exports.
