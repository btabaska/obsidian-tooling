#!/usr/bin/env node
/*
 * bootstrap.js — install & pre-configure a fixed Obsidian plugin stack into any vault.
 *
 * This is NOT an Obsidian plugin. It is a deployment tool that downloads OTHER people's
 * community plugins from their GitHub Releases and copies your baked-in settings into a
 * vault's .obsidian/ folder, so you get an identical setup on every device.
 *
 * Usage:
 *   node bootstrap.js --vault "/path/to/vault" [--update] [--dry-run] [--force-settings]
 *
 * Flags:
 *   --vault <path>     (required) Path to the Obsidian vault (the folder that contains, or will contain, .obsidian/).
 *   --update           Re-download every community plugin to its latest release (default: skip already-installed).
 *   --force-settings   Overwrite existing per-plugin data.json with the repo's baked-in settings.
 *                      (Default: only copy settings when the vault has none, so on-device tweaks are preserved.)
 *   --dry-run          Print everything that WOULD happen; write nothing.
 *   --no-backup        Skip the timestamped .obsidian backup (not recommended).
 *   --skip-ollama      Do not run the Ollama reachability check at the end.
 *   -h, --help         Show help.
 *
 * Environment:
 *   GITHUB_TOKEN       Optional. A GitHub token (any scope) to raise the API rate limit from 60 to 5000/hr.
 *
 * Requires Node.js >= 18.
 */

'use strict';

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const https = require('https');
const { execFile } = require('child_process');

const ROOT = __dirname;
const REGISTRY_URL =
  'https://raw.githubusercontent.com/obsidianmd/obsidian-releases/master/community-plugins.json';

// ----------------------------------------------------------------------------
// Tiny ANSI helpers (no dependencies)
// ----------------------------------------------------------------------------
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `[${code}m${s}[0m` : s);
const bold = (s) => c('1', s);
const green = (s) => c('32', s);
const yellow = (s) => c('33', s);
const red = (s) => c('31', s);
const cyan = (s) => c('36', s);
const dim = (s) => c('2', s);

const log = (...a) => console.log(...a);
const info = (...a) => console.log(cyan('•'), ...a);
const ok = (...a) => console.log(green('✓'), ...a);
const warn = (...a) => console.log(yellow('!'), ...a);
const err = (...a) => console.error(red('✗'), ...a);

// ----------------------------------------------------------------------------
// Arg parsing
// ----------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { update: false, dryRun: false, forceSettings: false, backup: true, ollama: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--vault': args.vault = argv[++i]; break;
      case '--update': args.update = true; break;
      case '--dry-run': args.dryRun = true; break;
      case '--force-settings': args.forceSettings = true; break;
      case '--no-backup': args.backup = false; break;
      case '--skip-ollama': args.ollama = false; break;
      case '-h': case '--help': args.help = true; break;
      default:
        if (a.startsWith('--vault=')) args.vault = a.slice('--vault='.length);
        else { throw new Error(`Unknown argument: ${a}`); }
    }
  }
  return args;
}

function printHelp() {
  log(fs.readFileSync(__filename, 'utf8').split('\n').slice(2, 33).join('\n').replace(/^ \*?/gm, '').trim());
}

// ----------------------------------------------------------------------------
// HTTP: GET with redirect following. Returns { status, headers, body:Buffer }.
// ----------------------------------------------------------------------------
function httpGet(url, { headers = {}, redirects = 5 } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'obsidian-bootstrap', ...headers } }, (res) => {
      const { statusCode = 0, headers: h } = res;
      if (statusCode >= 300 && statusCode < 400 && h.location && redirects > 0) {
        res.resume();
        const next = new URL(h.location, url).toString();
        resolve(httpGet(next, { headers, redirects: redirects - 1 }));
        return;
      }
      const chunks = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve({ status: statusCode, headers: h, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error(`Timeout fetching ${url}`)));
  });
}

function ghHeaders() {
  const h = { Accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function getJson(url, headers) {
  const res = await httpGet(url, { headers });
  if (res.status === 403 && /rate limit/i.test(res.body.toString())) {
    throw new Error('GitHub API rate limit hit. Set GITHUB_TOKEN to raise it to 5000/hr, or wait and retry.');
  }
  if (res.status !== 200) {
    throw new Error(`HTTP ${res.status} for ${url}: ${res.body.toString().slice(0, 200)}`);
  }
  return JSON.parse(res.body.toString());
}

// ----------------------------------------------------------------------------
// Registry resolution: id -> repo, from obsidianmd/obsidian-releases.
// Falls back to the pinned repo in plugins.json if resolution fails.
// ----------------------------------------------------------------------------
async function resolveRepos(communityPlugins) {
  const resolved = {};
  let registry = null;
  try {
    registry = await getJson(REGISTRY_URL, ghHeaders());
    ok(`Resolved plugin registry (${registry.length} plugins) from obsidian-releases.`);
  } catch (e) {
    warn(`Could not fetch the plugin registry (${e.message}).`);
    warn('Falling back to the pinned repos in plugins.json.');
  }
  const byId = registry ? Object.fromEntries(registry.map((p) => [p.id, p])) : {};
  for (const p of communityPlugins) {
    const entry = byId[p.id];
    if (entry && entry.repo) {
      resolved[p.id] = entry.repo;
      if (p.repo && p.repo !== entry.repo) {
        warn(`  ${p.id}: registry repo ${entry.repo} differs from pinned ${p.repo} — using registry.`);
      }
    } else if (p.repo) {
      if (registry) warn(`  ${p.id}: not found in registry — using pinned repo ${p.repo}.`);
      resolved[p.id] = p.repo;
    } else {
      err(`  ${p.id}: cannot resolve a repo (not in registry, no pinned fallback). Skipping.`);
    }
  }
  return resolved;
}

// ----------------------------------------------------------------------------
// Fetch the latest release and verify assets before download.
// Returns { tag, assets: {name -> browser_download_url} } or throws.
// ----------------------------------------------------------------------------
async function getLatestRelease(repo) {
  // /releases/latest returns the newest non-prerelease. Fall back to the release list.
  let rel;
  try {
    rel = await getJson(`https://api.github.com/repos/${repo}/releases/latest`, ghHeaders());
  } catch (e) {
    const list = await getJson(`https://api.github.com/repos/${repo}/releases?per_page=10`, ghHeaders());
    rel = list.find((r) => !r.draft && !r.prerelease) || list[0];
    if (!rel) throw new Error(`no releases found (${e.message})`);
  }
  const assets = {};
  for (const a of rel.assets || []) assets[a.name] = a.browser_download_url;
  return { tag: rel.tag_name, assets };
}

const REQUIRED_ASSETS = ['manifest.json', 'main.js'];
const OPTIONAL_ASSETS = ['styles.css'];

// ----------------------------------------------------------------------------
// FS helpers
// ----------------------------------------------------------------------------
const exists = (p) => fs.existsSync(p);
async function readJsonIfExists(p) {
  try { return JSON.parse(await fsp.readFile(p, 'utf8')); } catch { return null; }
}
function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// ----------------------------------------------------------------------------
// Main
// ----------------------------------------------------------------------------
async function main() {
  let args;
  try { args = parseArgs(process.argv.slice(2)); }
  catch (e) { err(e.message); process.exit(2); }
  if (args.help) { printHelp(); return; }

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  if (nodeMajor < 18) { err(`Node >= 18 required (found ${process.versions.node}).`); process.exit(2); }

  if (!args.vault) { err('Missing required --vault <path>.  Run with --help for usage.'); process.exit(2); }

  const vault = path.resolve(args.vault);
  if (!exists(vault) || !fs.statSync(vault).isDirectory()) {
    err(`Vault path is not a directory: ${vault}`);
    err('Point --vault at an existing folder (an empty folder is fine for a new vault).');
    process.exit(2);
  }

  const manifest = JSON.parse(await fsp.readFile(path.join(ROOT, 'plugins.json'), 'utf8'));
  const community = manifest.communityPlugins || [];
  const core = manifest.corePlugins || [];

  const obsidianDir = path.join(vault, '.obsidian');
  const pluginsDir = path.join(obsidianDir, 'plugins');
  const settingsDir = path.join(ROOT, 'settings');

  log('');
  log(bold('Obsidian config bootstrap'));
  log(`  vault:          ${vault}`);
  log(`  mode:           ${args.dryRun ? yellow('DRY-RUN (no writes)') : 'write'}`);
  log(`  update plugins: ${args.update ? 'yes (re-download latest)' : 'no (skip installed)'}`);
  log(`  settings:       ${args.forceSettings ? yellow('force overwrite') : 'copy only if missing'}`);
  log('');

  const summary = { installed: [], updated: [], skipped: [], failed: [], settingsCopied: [], settingsKept: [] };

  // --- 1. Backup existing .obsidian -----------------------------------------
  if (exists(obsidianDir) && args.backup) {
    const backup = path.join(vault, `.obsidian.backup-${ts()}`);
    if (args.dryRun) {
      info(`[dry-run] would back up ${dim(obsidianDir)} -> ${dim(backup)}`);
    } else {
      await fsp.cp(obsidianDir, backup, { recursive: true });
      ok(`Backed up existing .obsidian -> ${path.basename(backup)}`);
      info(`Rollback: rm -rf "${obsidianDir}" && mv "${backup}" "${obsidianDir}"`);
    }
  } else if (!exists(obsidianDir)) {
    info('No existing .obsidian — creating a fresh one.');
  }

  if (!args.dryRun) await fsp.mkdir(pluginsDir, { recursive: true });

  // --- 2. Resolve repos & install community plugins -------------------------
  const repos = await resolveRepos(community);
  log('');
  info(bold('Community plugins:'));
  for (const p of community) {
    const repo = repos[p.id];
    if (!repo) { summary.failed.push(`${p.id} (no repo)`); continue; }
    const destDir = path.join(pluginsDir, p.id);
    const alreadyInstalled = exists(path.join(destDir, 'main.js')) && exists(path.join(destDir, 'manifest.json'));

    if (alreadyInstalled && !args.update) {
      const cur = (await readJsonIfExists(path.join(destDir, 'manifest.json')))?.version || '?';
      log(`  ${dim('=')} ${p.name.padEnd(20)} ${dim(`installed v${cur} — skip (use --update to refresh)`)}`);
      summary.skipped.push(p.id);
      continue;
    }

    try {
      const rel = await getLatestRelease(repo);
      const missing = REQUIRED_ASSETS.filter((n) => !rel.assets[n]);
      if (missing.length) {
        throw new Error(`release ${rel.tag} is missing required asset(s): ${missing.join(', ')}`);
      }
      const toDownload = [...REQUIRED_ASSETS, ...OPTIONAL_ASSETS.filter((n) => rel.assets[n])];

      if (args.dryRun) {
        log(`  ${yellow('↓')} ${p.name.padEnd(20)} ${dim(`${repo} @ ${rel.tag}`)} [${toDownload.join(', ')}]`);
        (alreadyInstalled ? summary.updated : summary.installed).push(`${p.id}@${rel.tag}`);
        continue;
      }

      // Download all assets into memory first; only write if all succeed.
      const files = {};
      for (const name of toDownload) {
        const res = await httpGet(rel.assets[name], { headers: ghHeaders() });
        if (res.status !== 200) throw new Error(`download ${name} -> HTTP ${res.status}`);
        files[name] = res.body;
      }
      await fsp.mkdir(destDir, { recursive: true });
      for (const [name, buf] of Object.entries(files)) await fsp.writeFile(path.join(destDir, name), buf);

      const verb = alreadyInstalled ? 'updated to' : 'installed';
      ok(`${p.name.padEnd(20)} ${verb} ${bold(rel.tag)} ${dim(`(${repo})`)}`);
      (alreadyInstalled ? summary.updated : summary.installed).push(`${p.id}@${rel.tag}`);
    } catch (e) {
      err(`${p.name}: ${e.message}`);
      summary.failed.push(`${p.id} (${e.message})`);
    }
  }

  // --- 3. Copy baked-in settings --------------------------------------------
  log('');
  info(bold('Settings (data.json):'));
  const allWithSettings = [...core, ...community];
  for (const p of allWithSettings) {
    const src = path.join(settingsDir, p.id, 'data.json');
    if (!exists(src)) continue; // no baked settings for this plugin
    const destDir = path.join(pluginsDir, p.id);
    const dest = path.join(destDir, 'data.json');

    // Never lay settings for a community plugin whose code failed to install.
    if (p.type === 'community' && !exists(path.join(destDir, 'main.js')) && !args.dryRun) {
      warn(`  ${p.name}: plugin not installed — skipping its settings.`);
      continue;
    }

    const destExists = exists(dest);
    if (destExists && !args.forceSettings) {
      log(`  ${dim('=')} ${p.name.padEnd(20)} ${dim('keeping existing data.json (use --force-settings to overwrite)')}`);
      summary.settingsKept.push(p.id);
      continue;
    }
    if (args.dryRun) {
      log(`  ${yellow('→')} ${p.name.padEnd(20)} ${dim(`would ${destExists ? 'OVERWRITE' : 'copy'} data.json`)}`);
      summary.settingsCopied.push(p.id);
      continue;
    }
    await fsp.mkdir(destDir, { recursive: true });
    // Copy through JSON.parse to strip our "$comment" doc keys before Obsidian sees them.
    const raw = JSON.parse(await fsp.readFile(src, 'utf8'));
    stripComments(raw);
    await fsp.writeFile(dest, JSON.stringify(raw, null, 2) + '\n');
    ok(`${p.name.padEnd(20)} ${destExists ? 'overwrote' : 'copied'} data.json`);
    summary.settingsCopied.push(p.id);
  }

  // --- 4. Enable Bases in core-plugins.json ---------------------------------
  log('');
  info(bold('Enabling core & community plugins:'));
  await enableCorePlugins(obsidianDir, core.map((p) => p.id), args);

  // --- 5. Register community plugins in community-plugins.json ---------------
  await enableCommunityPlugins(obsidianDir, community.filter((p) => !summary.failed.some((f) => f.startsWith(p.id))).map((p) => p.id), args);

  // --- 6. Summary -----------------------------------------------------------
  printSummary(summary, args);

  // --- 7. Ollama check ------------------------------------------------------
  if (args.ollama) {
    log('');
    info(bold('Ollama check:'));
    try {
      const { checkOllama } = require('./check-ollama.js');
      await checkOllama(manifest.ollama);
    } catch (e) {
      warn(`Ollama check skipped: ${e.message}`);
    }
  }

  if (summary.failed.length) {
    log('');
    warn(`${summary.failed.length} plugin(s) failed — see above. The rest were set up successfully.`);
    process.exitCode = 1;
  }
}

// Recursively delete "$comment" keys (our inline docs) so they never reach Obsidian.
function stripComments(obj) {
  if (Array.isArray(obj)) { obj.forEach(stripComments); return; }
  if (obj && typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      if (k === '$comment') delete obj[k];
      else stripComments(obj[k]);
    }
  }
}

async function enableCorePlugins(obsidianDir, ids, args) {
  const file = path.join(obsidianDir, 'core-plugins.json');
  const current = (await readJsonIfExists(file));
  // Obsidian has used two shapes over time: an array of enabled ids (modern),
  // or an object map {id: boolean} (legacy). Preserve whatever shape exists.
  let next, shape;
  if (Array.isArray(current)) {
    shape = 'array';
    next = Array.from(new Set([...current, ...ids]));
  } else if (current && typeof current === 'object') {
    shape = 'object';
    next = { ...current };
    for (const id of ids) next[id] = true;
  } else {
    shape = 'array';
    next = ids.slice();
  }
  for (const id of ids) log(`  ${green('+')} core: ${id}`);
  if (args.dryRun) { info(`  [dry-run] would write core-plugins.json (${shape} form)`); return; }
  await fsp.mkdir(obsidianDir, { recursive: true });
  await fsp.writeFile(file, JSON.stringify(next, null, 2) + '\n');
}

async function enableCommunityPlugins(obsidianDir, ids, args) {
  const file = path.join(obsidianDir, 'community-plugins.json');
  const current = (await readJsonIfExists(file)) || [];
  const arr = Array.isArray(current) ? current : [];
  const next = Array.from(new Set([...arr, ...ids]));
  const added = next.filter((id) => !arr.includes(id));
  for (const id of ids) log(`  ${green('+')} community: ${id}`);
  if (added.length === 0 && arr.length) info('  (all community plugins already registered)');
  if (args.dryRun) { info('  [dry-run] would write community-plugins.json'); return; }
  await fsp.mkdir(obsidianDir, { recursive: true });
  await fsp.writeFile(file, JSON.stringify(next, null, 2) + '\n');
}

function printSummary(s, args) {
  log('');
  log(bold('━━━ Summary ━━━'));
  const line = (label, arr, color) => arr.length && log(`  ${color(label)}: ${arr.join(', ')}`);
  line('installed', s.installed, green);
  line('updated', s.updated, green);
  line('skipped (already installed)', s.skipped, dim);
  line('settings copied', s.settingsCopied, green);
  line('settings kept (existing)', s.settingsKept, dim);
  line('FAILED', s.failed, red);
  if (args.dryRun) { log(''); warn('DRY-RUN: nothing was written.'); }
  else { log(''); ok('Done. Restart Obsidian (or reload the vault) to pick up the new plugins.'); }
}

main().catch((e) => { err(e.stack || e.message); process.exit(1); });
