# Facebook AI Assistant

Chrome Extension Manifest V3 with a Vietnamese dashboard for managing Facebook content workflows and AI-assisted drafts.

## Phase 1 scope

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

## Current limitations

Facebook login, scraping, posting, sharing, comments, friend requests, and group joining are not implemented. Gemini API can be used after the user explicitly grants optional host permission and stores a key for the current browser session. Meta AI remains a placeholder. No Facebook host permissions or cookies access are requested.

## Development

Requires Node.js 20 or newer. Run npm test, npm run validate, and npm run package. The generated extension archive is written to dist/facebook-ai-assistant.zip.

## Data and privacy

Application data is stored locally using chrome.storage.local. Exported JSON may contain group names and URLs, prompts, drafts, and reminders; review it before sharing.
