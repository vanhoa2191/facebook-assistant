# Architecture

- manifest.json: Manifest V3 metadata, storage and alarms permissions, optional Gemini API host permission.
- dashboard.html: extension dashboard.
- src/core.js: state defaults, validation, safe prompt interpolation, HTML escaping, CSV output.
- src/ai-provider.js: Gemini API adapter with model validation, timeout, response parsing, and normalized errors.
- src/facebook-provider.js: versioned Facebook Pages Graph API adapter with token in POST body, timeout, and normalized errors.
- src/app.js: navigation, group list, AI generation, drafts, reminders, import/export, and logs.
- src/background.js: extension lifecycle, reminder alarms, and action badge.
- tests/: deterministic Node.js unit tests.
- scripts/: extension validation and ZIP packaging.
- .github/workflows/ci.yml: GitHub Actions validation and package workflow.

Application state is stored in chrome.storage.local. Gemini API key and Facebook Page access token are stored separately in chrome.storage.session and are never included in exports or logs. The key remains accessible to the extension during the current Chrome session.

Gemini permission is optional and requested after a user gesture. Requests use HTTPS, send the key in the x-goog-api-key header rather than the URL, apply a timeout, and limit prompt size. Google receives the prompt and input text when a request is made.

Chrome Alarms are used for one-shot reminders. When due, a task is marked due, a log entry is written, and a badge is shown on the extension action. A reminder may link to a saved draft for quick review. Page posts may be scheduled directly through the official Graph API using `published=false` and `scheduled_publish_time` (10 minutes to 30 days ahead). After Meta confirms a scheduled post, the extension records the returned post ID locally and links to Meta Business Suite Planner. It does not claim live publication status without querying Meta.

Optional host permissions are requested only for Gemini and the Facebook Graph API. Page publishing is supported only through the versioned Page feed endpoint with a user-provided Page access token and an explicit confirmation. No cookies access, Facebook scraping, friend requests, group joining, or automatic group/personal-profile posting is implemented. AI output is saved as a draft for human review.
