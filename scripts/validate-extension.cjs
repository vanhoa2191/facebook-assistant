'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('manifest.json'));

assert.equal(manifest.manifest_version, 3, 'Manifest V3 is required');
assert.equal(manifest.name, 'Facebook AI Assistant');
assert.ok(manifest.options_page, 'options_page must be declared');
assert.ok(fs.existsSync(path.join(root, manifest.options_page)), 'options page file must exist');
assert.ok(manifest.background && fs.existsSync(path.join(root, manifest.background.service_worker)), 'service worker must exist');
assert.ok(Array.isArray(manifest.permissions), 'permissions must be an array');
assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'storage'], 'Only storage and alarms are required permissions');
assert.deepEqual(manifest.optional_host_permissions, ['https://generativelanguage.googleapis.com/*'], 'Only Gemini API host permission may be requested optionally');
assert.equal(manifest.host_permissions, undefined, 'No permanent host permissions');
assert.equal(manifest.content_scripts, undefined, 'No content scripts in this phase');

const dashboard = read('dashboard.html');
assert.ok(dashboard.includes('src/core.js'), 'core script must be loaded');
assert.ok(dashboard.includes('src/ai-provider.js'), 'AI provider must be loaded');
assert.ok(dashboard.includes('src/app.js'), 'app script must be loaded');
assert.ok(dashboard.indexOf('src/core.js') < dashboard.indexOf('src/app.js'), 'core must load before app');
assert.ok(dashboard.indexOf('src/ai-provider.js') < dashboard.indexOf('src/app.js'), 'AI provider must load before app');

for (const file of ['src/core.js', 'src/ai-provider.js', 'src/app.js', 'src/background.js', 'src/styles.css']) {
  assert.ok(fs.statSync(path.join(root, file)).size > 0, file + ' must not be empty');
}
const core = require('../src/core.js');
assert.equal(core.isValidState(core.createDefaultState()), true, 'default state must validate');
console.log('Extension validation passed: manifest, permissions, entry points, and default state.');
