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
assert.deepEqual([...manifest.permissions].sort(), ['alarms', 'storage'], 'Phase 1 must use only the reviewed permissions');
assert.equal(manifest.host_permissions, undefined, 'Phase 1 must not request host permissions');
assert.equal(manifest.content_scripts, undefined, 'Phase 1 must not inject content scripts');
assert.equal(manifest.optional_host_permissions, undefined, 'Phase 1 must not request optional host permissions');

const dashboard = read('dashboard.html');
assert.ok(dashboard.includes('src/core.js'), 'core script must be loaded');
assert.ok(dashboard.includes('src/app.js'), 'app script must be loaded');
assert.ok(dashboard.indexOf('src/core.js') < dashboard.indexOf('src/app.js'), 'core must load before app');

for (const file of ['src/core.js', 'src/app.js', 'src/background.js', 'src/styles.css']) {
  assert.ok(fs.statSync(path.join(root, file)).size > 0, file + ' must not be empty');
}
const core = require('../src/core.js');
assert.equal(core.isValidState(core.createDefaultState()), true, 'default state must validate');
console.log('Extension validation passed: manifest, permissions, entry points, and default state.');
