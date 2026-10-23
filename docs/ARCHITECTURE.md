# Architecture

- manifest.json: Manifest V3 metadata, storage and alarms permissions, optional Gemini API host permission.
- dashboard.html: extension dashboard.
- src/core.js: state defaults, validation, safe prompt interpolation, HTML escaping, CSV output.
- src/ai-provider.js: Gemini API adapter with model validation, timeout, response parsing, and normalized errors.
- src/app.js: navigation, group list, AI generation, drafts, reminders, import/export, and logs.
- src/background.js: extension lifecycle, reminder alarms, and action badge.
- tests/: deterministic Node.js unit tests.
- scripts/: extension validation and ZIP packaging.
- .github/workflows/ci.yml: GitHub Actions validation and package workflow.

Application state is stored in chrome.storage.local. Gemini API key is stored separately in chrome.storage.session and is never included in exports or logs. The key remains accessible to the extension during the current Chrome session.

Gemini permission is optional and requested after a user gesture. Requests use HTTPS, send the key in the x-goog-api-key header rather than the URL, apply a timeout, and limit prompt size. Google receives the prompt and input text when a request is made.

Chrome Alarms are used for one-shot reminders. When due, a task is marked due, a log entry is written, and a badge is shown on the extension action. The scheduler does not perform Facebook actions.

No Facebook host permissions, cookies, page scraping, posting, commenting, friend requests, or group joining are enabled. AI output is saved as a draft for human review.
