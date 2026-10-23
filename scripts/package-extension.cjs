'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const archive = path.join(dist, 'facebook-ai-assistant.zip');
try { fs.unlinkSync(archive); } catch (error) { if (error.code !== 'ENOENT') throw error; }
execFileSync('zip', ['-q', '-r', archive, 'manifest.json', 'dashboard.html', 'src'], { cwd: root });
const stat = fs.statSync(archive);
if (stat.size < 1000) throw new Error('Extension archive is unexpectedly small');
console.log('Created ' + path.relative(root, archive) + ' (' + stat.size + ' bytes).');
