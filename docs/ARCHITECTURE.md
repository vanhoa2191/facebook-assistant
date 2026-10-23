# Architecture

## Phase 1 components

- manifest.json: Manifest V3 metadata and minimum permissions.
- dashboard.html: options-page dashboard opened from the extension action.
- src/styles.css: responsive UI styles.
- src/core.js: pure validation and formatting functions shared by the UI and Node.js tests.
- src/app.js: navigation, local state, group list, AI profile placeholders, drafts, reminders, import/export, and logs.
- src/background.js: extension lifecycle and dashboard launch.
- tests/: deterministic unit tests.
- scripts/: extension validation and ZIP packaging.
- .github/workflows/ci.yml: GitHub Actions checks.

## State

The application stores one versioned-shape object under chrome.storage.local key faa.state. Import validation is strict: unknown/malformed nested data is rejected rather than merged. Exported JSON is user-controlled and may contain group URLs, drafts, prompts, and reminders.

## Safety boundary

Phase 1 requests storage and alarms only. It does not request cookies, tabs, scripting, webRequest, or Facebook host permissions. No Facebook page is scraped or modified. AI provider selections are placeholders and do not send network requests.

## Roadmap

1. Stabilize dashboard, state validation, CI, and packaging.
2. Add a provider interface with explicit consent, secret handling, request timeouts, and unit tests.
3. Add supported Facebook integrations only where official APIs and permissions allow.
4. Add task queue, retry policy, idempotency, and human confirmation for external actions.
