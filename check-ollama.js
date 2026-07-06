#!/usr/bin/env node
/*
 * check-ollama.js — resolve the AI backend and verify Ollama + required models. Never installs anything.
 *
 * As a module:   const { checkOllama, resolveBackend, probeOllama } = require('./check-ollama.js');
 * Standalone:    node check-ollama.js [--profile local|rig|auto] [--rig-host http://host:11434]
 *
 * Hybrid model: two named backends in plugins.json (`local` = this device's Ollama, `rig` = the
 * CachyOS box over Tailscale). Profile `auto` uses local if it answers, else the rig. This script
 * checks whichever backend is resolved, and prints the exact `ollama pull` command (and WHERE to run
 * it) for any missing model. It never installs Ollama or any model.
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

const RIG_PLACEHOLDER = /CHANGE-ME/i;

// Probe an Ollama server's /api/tags. Resolves to { reachable, models:[names] } (never rejects).
function probeOllama(host, timeoutMs = 3000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    let req;
    try {
      req = http.get(`${host}/api/tags`, (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          try {
            const j = JSON.parse(Buffer.concat(chunks).toString());
            finish({ reachable: res.statusCode === 200, models: (j.models || []).map((m) => m.name) });
          } catch { finish({ reachable: false, models: [] }); }
        });
      });
    } catch { return finish({ reachable: false, models: [] }); }
    req.on('error', () => finish({ reachable: false, models: [] }));
    req.setTimeout(timeoutMs, () => { req.destroy(); finish({ reachable: false, models: [] }); });
  });
}

function binaryOnPath() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where' : 'which';
    execFile(cmd, ['ollama'], (err, stdout) => resolve(err ? null : stdout.trim().split(/\r?\n/)[0]));
  });
}

// Decide which backend to use.
//   profile 'local' -> local backend (must be reachable or we warn)
//   profile 'rig'   -> rig backend (host must not be the CHANGE-ME placeholder)
//   profile 'auto'  -> local if it answers, else rig
// Returns { name, backend, reason, localProbe } or throws with a helpful message.
async function resolveBackend(ai, { profile = 'auto', rigHost } = {}) {
  const backends = (ai && ai.backends) || {};
  const local = backends.local;
  const rig = backends.rig ? { ...backends.rig } : undefined;
  if (rig && rigHost) rig.host = rigHost;

  const rigConfigured = rig && rig.host && !RIG_PLACEHOLDER.test(rig.host);

  if (profile === 'local') {
    if (!local) throw new Error("No 'local' backend defined in plugins.json (ai.backends.local).");
    const p = await probeOllama(local.host);
    return { name: 'local', backend: local, reason: p.reachable ? 'forced local (reachable)' : 'forced local (NOT reachable yet)', localProbe: p };
  }
  if (profile === 'rig') {
    if (!rig) throw new Error("No 'rig' backend defined in plugins.json (ai.backends.rig).");
    if (!rigConfigured) throw new Error(`The rig host is still a placeholder (${rig.host}). Set ai.backends.rig.host in plugins.json to your rig's Tailscale name, or pass --rig-host http://<name>:11434.`);
    return { name: 'rig', backend: rig, reason: 'forced rig' };
  }
  // auto
  const p = local ? await probeOllama(local.host) : { reachable: false, models: [] };
  if (p.reachable) return { name: 'local', backend: local, reason: 'auto: local Ollama answered', localProbe: p };
  if (rigConfigured) return { name: 'rig', backend: rig, reason: 'auto: local unreachable -> rig' };
  // Nothing usable — explain clearly.
  const hint = rig && !rigConfigured
    ? `Local Ollama isn't running and the rig host is still a placeholder (${rig.host}).\n  Either start local Ollama (ollama serve) or set ai.backends.rig.host / pass --rig-host.`
    : `Local Ollama isn't running at ${local ? local.host : '(no local backend)'}.\n  Start it (ollama serve) or configure a rig backend.`;
  throw new Error(hint);
}

// Compare a requested model tag against installed names, tolerating the implicit ":latest".
function isInstalled(model, installedNames) {
  return installedNames.some((n) => n === model || n.replace(/:latest$/, '') === model.replace(/:latest$/, ''));
}

// Check a single resolved backend: server reachability + required models on THAT host.
async function checkOllama(resolved) {
  const { name, backend, reason } = resolved;
  const host = backend.host;
  const where = name === 'local' ? 'on this device' : `on the rig (${host})`;

  console.log(`${cyan('•')} AI backend: ${bold(name)} — ${backend.label || host}  ${reason ? `(${reason})` : ''}`);

  if (name === 'local') {
    const bin = await binaryOnPath();
    if (bin) console.log(`${green('✓')} ollama binary: ${bin}`);
    else console.log(`${yellow('!')} ollama binary not on PATH. Install from ${cyan('https://ollama.com/download')} (never auto-installed).`);
  }

  const p = resolved.localProbe && name === 'local' ? resolved.localProbe : await probeOllama(host);
  if (p.reachable) {
    console.log(`${green('✓')} Ollama reachable at ${host} (${p.models.length} model(s)).`);
  } else {
    console.log(`${yellow('!')} Ollama NOT reachable at ${host}.`);
    if (name === 'local') console.log(`  Start it: ${cyan('ollama serve')} (or open the Ollama app), then re-run.`);
    else console.log(`  Check the rig is up, Tailscale is connected on this device, and the rig runs Ollama with ${cyan('OLLAMA_HOST=0.0.0.0')}.`);
    return { reachable: false, requiredMissing: [backend.chatModel], host, name };
  }

  const required = [
    { model: backend.chatModel, optional: false, purpose: 'chat + tagging' },
    { model: backend.embedModel, optional: true, purpose: 'Copilot vault-QA embeddings' },
  ].filter((m) => m.model);

  const missing = [];
  for (const m of required) {
    const present = isInstalled(m.model, p.models);
    const tag = m.optional ? yellow('(optional)') : '';
    if (present) console.log(`  ${green('✓')} ${m.model} ${tag} — ${m.purpose}`);
    else { console.log(`  ${red('✗')} ${m.model} not installed ${tag} — ${m.purpose}`); missing.push(m); }
  }

  if (missing.length) {
    console.log('');
    console.log(bold(`  Pull the missing model(s) ${where}:`));
    for (const m of missing) {
      const cmd = name === 'local' ? `ollama pull ${m.model}` : `ssh <rig>  # then:  ollama pull ${m.model}`;
      console.log(`    ${cyan(cmd)}${m.optional ? yellow('   # optional') : ''}`);
    }
  }
  return { reachable: true, requiredMissing: missing.filter((m) => !m.optional).map((m) => m.model), host, name };
}

module.exports = { checkOllama, resolveBackend, probeOllama };

if (require.main === module) {
  const argv = process.argv.slice(2);
  const get = (flag) => { const i = argv.indexOf(flag); return i >= 0 ? argv[i + 1] : undefined; };
  const profile = get('--profile') || 'auto';
  const rigHost = get('--rig-host');
  let ai = {};
  try { ai = JSON.parse(fs.readFileSync(path.join(__dirname, 'plugins.json'), 'utf8')).ai || {}; }
  catch { /* defaults */ }
  console.log(bold('Ollama / AI backend check'));
  resolveBackend(ai, { profile, rigHost })
    .then((resolved) => checkOllama(resolved))
    .then((r) => { if (!r.reachable || r.requiredMissing.length) process.exit(1); })
    .catch((e) => { console.log(`${red('✗')} ${e.message}`); process.exit(1); });
}
