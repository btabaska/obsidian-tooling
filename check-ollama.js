#!/usr/bin/env node
/*
 * check-ollama.js — detect Ollama and required local models. Never installs anything.
 *
 * As a module:   const { checkOllama } = require('./check-ollama.js'); await checkOllama(ollamaConfig)
 * Standalone:    node check-ollama.js            (reads plugins.json for the model list)
 *
 * It verifies:
 *   1. the `ollama` binary is on PATH (informational),
 *   2. the server answers at http://localhost:11434,
 *   3. every required model from plugins.json is pulled — and prints the exact
 *      `ollama pull <model>` command for any that are missing.
 * Exit code is non-zero (standalone) if the server is unreachable or a required model is missing.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (n, s) => (useColor ? `[${n}m${s}[0m` : s);
const green = (s) => c('32', s); const yellow = (s) => c('33', s);
const red = (s) => c('31', s); const cyan = (s) => c('36', s); const bold = (s) => c('1', s);

function getJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(Buffer.concat(chunks).toString()) }); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error('timeout')));
  });
}

function binaryOnPath() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, ['ollama'], (err, stdout) => resolve(err ? null : stdout.trim().split(/\r?\n/)[0]));
  });
}

// Compare requested model tag against installed names, tolerating the implicit ":latest" tag.
function isInstalled(model, installedNames) {
  const want = model.includes(':') ? model : `${model}:latest`;
  return installedNames.some((n) => n === model || n === want || n.replace(/:latest$/, '') === model.replace(/:latest$/, ''));
}

async function checkOllama(ollamaConfig) {
  const endpoint = (ollamaConfig && ollamaConfig.endpoint) || 'http://localhost:11434';
  const required = (ollamaConfig && ollamaConfig.requiredModels) || [];

  const bin = await binaryOnPath();
  if (bin) console.log(`${green('✓')} ollama binary: ${bin}`);
  else console.log(`${yellow('!')} ollama binary not found on PATH. Install it: ${cyan('https://ollama.com/download')} (this tool never auto-installs it).`);

  let installedNames = [];
  let reachable = false;
  try {
    const res = await getJson(`${endpoint}/api/tags`);
    reachable = res.status === 200;
    installedNames = (res.json.models || []).map((m) => m.name);
    console.log(`${green('✓')} Ollama server reachable at ${endpoint} (${installedNames.length} model(s) installed).`);
  } catch (e) {
    console.log(`${yellow('!')} Ollama server not reachable at ${endpoint} (${e.message}).`);
    console.log(`  Start it with: ${cyan('ollama serve')}   (or launch the Ollama app), then re-run.`);
  }

  const missing = [];
  for (const m of required) {
    const present = reachable && isInstalled(m.model, installedNames);
    const tag = m.optional ? yellow('(optional)') : '';
    const usedBy = m.usedBy ? ` — used by ${m.usedBy.join(', ')}` : '';
    if (present) {
      console.log(`  ${green('✓')} ${m.model} ${tag}${usedBy}`);
    } else {
      console.log(`  ${red('✗')} ${m.model} not installed ${tag}${usedBy}`);
      if (!m.optional || reachable) missing.push(m);
    }
  }

  const requiredMissing = missing.filter((m) => !m.optional);
  if (missing.length) {
    console.log('');
    console.log(bold('  Pull the missing model(s):'));
    for (const m of missing) console.log(`    ${cyan(`ollama pull ${m.model}`)}${m.optional ? yellow('   # optional') : ''}`);
  }
  return { reachable, requiredMissing: requiredMissing.map((m) => m.model), installedNames };
}

module.exports = { checkOllama };

if (require.main === module) {
  const manifestPath = path.join(__dirname, 'plugins.json');
  let ollama = {};
  try { ollama = JSON.parse(fs.readFileSync(manifestPath, 'utf8')).ollama || {}; }
  catch { /* fall back to defaults */ }
  console.log(bold('Ollama check'));
  checkOllama(ollama).then((r) => {
    if (!r.reachable || r.requiredMissing.length) process.exit(1);
  });
}
