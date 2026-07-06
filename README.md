# Obsidian Setup — portable, version-controlled plugin stack

A deployment tool that installs and pre-configures a fixed set of Obsidian **community plugins**
into any vault, so you get an identical setup on every device (macOS, Linux, Windows).

> **This is not an Obsidian plugin.** It is a bootstrap script that downloads *other people's*
> plugins from their GitHub Releases and copies your baked-in settings into a vault's `.obsidian/`
> folder. It never touches your notes.

All AI features run against **Ollama** — either this device's **local** Ollama or a shared **rig**
(a beefier GPU box) reached over Tailscale. There are **no API keys** anywhere in this repo, and
nothing phones home to a cloud provider by default. See [Hybrid AI backends](#hybrid-ai-backends).

---

## Quick start (fresh machine)

1. **Install Node.js 18+** — <https://nodejs.org> (or `brew install node` / your package manager).
2. **Install Ollama** — <https://ollama.com/download> (do *not* install it via this tool).
3. **Clone this repo:**
   ```bash
   git clone <this-repo-url> obsidian-setup && cd obsidian-setup
   ```
4. **Run the bootstrap against your vault:**
   ```bash
   ./bootstrap.sh --vault "/path/to/your/vault"          # macOS / Linux
   .\bootstrap.ps1 --vault "C:\path\to\your\vault"       # Windows PowerShell
   ```
   (An empty folder is a valid brand-new vault.)
5. **Pull the AI models** the script tells you are missing (on whichever host serves them):
   ```bash
   ollama pull llama3.1:8b        # chat + tagging (required)
   ollama pull nomic-embed-text   # local embeddings for Copilot vault QA (optional)
   ```
6. **Restart Obsidian** (or reload the vault) to pick up the new plugins.

That's it. The `.sh`/`.ps1` wrappers just verify Node is present and call `bootstrap.js`. On a
device with its own Ollama (this MacBook, the rig) that's all you need; to use the shared rig from
elsewhere, see [Hybrid AI backends](#hybrid-ai-backends) first.

---

## What gets installed

**Core plugin (enabled, not downloaded — it ships with Obsidian):**

| Plugin | ID |
|---|---|
| Bases | `bases` |

**Community plugins (downloaded from each project's GitHub Releases):**

| Plugin | ID | Repo |
|---|---|---|
| Tasks | `obsidian-tasks-plugin` | obsidian-tasks-group/obsidian-tasks |
| Periodic Notes | `periodic-notes` | liamcain/obsidian-periodic-notes |
| Calendar | `calendar` | liamcain/obsidian-calendar-plugin |
| AI Tagger Universe | `ai-tagger-universe` | niehu2018/obsidian-ai-tagger-universe |
| Advanced Note Mover | `note-mover-shortcut` | bueckerlars/obsidian-note-mover-shortcut |
| Kanban | `obsidian-kanban` | obsidian-community/obsidian-kanban |
| Task Board | `task-board` | tu2-atmanand/Task-Board |
| Copilot | `copilot` | logancyang/obsidian-copilot |
| Smart Connections | `smart-connections` | brianpetro/obsidian-smart-connections |
| Templater | `templater-obsidian` | silentvoid13/Templater |
| QuickAdd | `quickadd` | chhoumann/quickadd |

Plugin IDs → repos are resolved **at runtime** from the official registry
(`community-plugins.json` in `obsidianmd/obsidian-releases`), so the list can't rot. The `repo`
field in `plugins.json` is only a pinned fallback if that lookup fails.

---

## Commands

```bash
./bootstrap.sh --vault "<path>"                    # install missing plugins, keep existing settings
./bootstrap.sh --vault "<path>" --update           # re-download every plugin to its latest release
./bootstrap.sh --vault "<path>" --force-settings   # overwrite on-device data.json with the baked settings
./bootstrap.sh --vault "<path>" --dry-run          # show what would happen; write nothing
node check-ollama.js                               # just check Ollama + required models
```

| Flag | Effect |
|---|---|
| `--vault <path>` | **(required)** the vault folder (contains, or will contain, `.obsidian/`). |
| `--profile <auto\|local\|rig>` | Which AI backend to bake into this device. `auto` (default) = local Ollama if it answers, else the rig. See [Hybrid AI backends](#hybrid-ai-backends). |
| `--rig-host <url>` | Override the rig's Ollama URL for this run (e.g. `http://rig.your-tailnet.ts.net:11434`), instead of editing `plugins.json`. |
| `--update` | Re-download every community plugin to its latest release. Without it, already-installed plugins are skipped. |
| `--force-settings` | Overwrite an existing per-plugin `data.json` with the repo's baked settings. Without it, existing files are **kept** so your on-device tweaks survive. |
| `--dry-run` | Print the full plan and write nothing. |
| `--no-backup` | Skip the timestamped `.obsidian` backup (not recommended). |
| `--skip-ollama` | Don't run the Ollama check at the end. |

**Environment:** set `GITHUB_TOKEN` to any GitHub token to raise the API rate limit from 60 to
5000 requests/hour (useful if you re-run `--update` a lot).

### Idempotency

Re-running is safe. Default runs skip installed plugins and keep your settings; `--update` refreshes
plugin code; neither ever duplicates entries in `community-plugins.json` / `core-plugins.json`. Every
run backs up the existing `.obsidian/` first (see below).

---

## Rollback

Every run (unless `--no-backup`) copies the existing `.obsidian/` to a timestamped
`.obsidian.backup-YYYYMMDD-HHMMSS/` beside it, and prints the exact one-line rollback command. It is:

```bash
rm -rf "<vault>/.obsidian" && mv "<vault>/.obsidian.backup-YYYYMMDD-HHMMSS" "<vault>/.obsidian"
```

---

## Changing the stack

`plugins.json` is the single source of truth. To **add** a plugin, add an entry to
`communityPlugins` with its `id`, `name`, and `repo` (find the exact `id`/`repo` in the
[official registry](https://github.com/obsidianmd/obsidian-releases/blob/master/community-plugins.json)),
then re-run bootstrap. To **remove** one, delete its entry (bootstrap won't *uninstall* it — remove the
plugin folder and its line in `.obsidian/community-plugins.json` manually, or just disable it in
Obsidian). Optionally add a `settings/<id>/data.json` to pre-bake its configuration.

---

## Pre-baked settings — what each file does

Settings live in `settings/<plugin-id>/data.json` and are copied to
`<vault>/.obsidian/plugins/<plugin-id>/data.json` **only if the vault doesn't already have one**
(unless you pass `--force-settings`). Each file has a `$comment` key documenting it; bootstrap
**strips `$comment` keys** before writing, so Obsidian never sees them. Every file is intentionally
minimal — anything not set falls back to the plugin's own defaults, which each plugin merges in on load.

- **AI Tagger Universe** — points at Ollama (local or rig, chosen per device — see below). The endpoint
  is Ollama's *OpenAI-compatible* path (`…:11434/v1/chat/completions`; the plugin sends OpenAI-style
  requests — do **not** use the native `/api` path), model `llama3.1:8b`. Tags are written to YAML
  **frontmatter** (no inline-tag mode). The `data.json` is a template; bootstrap fills in the
  `__OLLAMA_*__` tokens from the resolved backend.
- **Advanced Note Mover** (`note-mover-shortcut`) — the on-edit/on-save trigger is **on**, with three
  **example** tag→folder rules: `work`→`Work/`, `home`→`Home/`, `gaming`→`Gaming/`. These are meant to be
  edited. Note: this plugin has **no debounce/delay setting** in its schema; the only timing knob is the
  periodic-mode interval (disabled here).
- **Periodic Notes** — daily notes enabled, folder `Journal/Daily`, format `YYYY-MM-DD`. Weekly/monthly/
  etc. are left off. (Uses the `calendarSets` schema shipped in the current release.)
- **Copilot** — chat model Ollama `llama3.1:8b`, embeddings Ollama `nomic-embed-text` (both point at the
  resolved backend — local or rig). No API keys are committed. Ollama `baseUrl` is the bare host with
  **no `/v1`**, and `enableCors: true` routes through Obsidian's safe fetch (needed for `http://` hosts,
  including calling the rig over Tailscale). The `data.json` is a template filled in from the backend.
  **Want both at once?** Add a second entry to `activeModels` with a **distinct** `name` and the other
  host's `baseUrl`, then switch models from Copilot's dropdown (e.g. small local model + a bigger rig
  model). **Cloud provider:** add the key **in the app** (Settings → Copilot), never in this repo.
- **Smart Connections** — **no file is baked.** This plugin stores its config in
  `<vault>/.smart-env/smart_env.json` (outside `.obsidian/`, which this tool deliberately does not write
  to), and its default embedding model is already **local** (`TaylorAI/bge-micro-v2`, via transformers.js,
  no API key). It initializes itself correctly on first run — nothing to configure.
- **Templater** — templates folder set to `Templates`; does not auto-run templates on file creation.
- **Calendar** — `weekStart` follows your locale; weekly-note button off.
- **QuickAdd** — no pre-defined choices/macros (these are personal; add your own in-app).
- **Tasks / Kanban / Task Board** — intentionally left at plugin defaults (their config is either highly
  personal or stored per-board in note frontmatter). These `data.json` files are effectively `{}`.

### The Ollama models

| Model | Used by | Purpose | Required? |
|---|---|---|---|
| `llama3.1:8b` | AI Tagger Universe, Copilot | chat + tagging (small, capable, ~4.7 GB) | **yes** |
| `nomic-embed-text` | Copilot | embeddings for vault Q&A | optional |

`node check-ollama.js [--profile …] [--rig-host …]` (also run at the end of bootstrap) resolves the
backend, verifies that host's Ollama is up, and prints exactly which `ollama pull` commands to run and
**where**. It never installs Ollama or any model for you.

---

## Hybrid AI backends

Run models **locally when the device can, call the rig when it can't** — from one repo.

**The two backends** (defined in `plugins.json` → `ai.backends`):

| Backend | Host | Who uses it |
|---|---|---|
| `local` | `http://localhost:11434` | This MacBook (M4 Pro), the rig itself — anything with its own Ollama |
| `rig` | `http://<rig>.<tailnet>.ts.net:11434` | iPad, iPhone, and any device without a local model |

**How the backend is chosen** (`--profile`, default `auto`):

- `auto` → probe `localhost:11434`; if it answers use **local**, otherwise use the **rig**. This is the
  hybrid default: capable devices run local, others fall back to the rig automatically.
- `local` / `rig` → force one explicitly.

Bootstrap templates the chosen host + model into the AI plugins' `data.json` (the `__OLLAMA_*__`
tokens). If `auto` finds neither (local down *and* rig still a placeholder), it **skips only the AI
settings** — the rest of the install still succeeds — and tells you how to fix it.

### One-time rig setup (Tailscale)

You already run Tailscale on the iPad, iPhone, and rig. Two things to finish:

1. **Install Tailscale on this MacBook** (<https://tailscale.com/download>) and sign into the same
   tailnet, so it can reach the rig by name when you want the rig from here.
2. **Make the rig's Ollama serve the tailnet.** By default Ollama binds to localhost only. On the rig
   (CachyOS), set `OLLAMA_HOST=0.0.0.0` and restart it:
   ```bash
   sudo systemctl edit ollama         # add:  [Service]\n Environment="OLLAMA_HOST=0.0.0.0"
   sudo systemctl restart ollama
   tailscale status                   # note the rig's name / 100.x.y.z address
   ```
   Then verify from another device on the tailnet: `curl http://<rig>:11434/api/tags`.

3. **Tell the repo the rig's address.** Edit `plugins.json` → `ai.backends.rig.host` to the rig's
   Tailscale **MagicDNS name** (e.g. `http://rig.tail1234.ts.net:11434`) or its `100.x.y.z:11434` IP.
   (Or skip editing and pass `--rig-host` per run.) Bootstrap refuses to target the rig while the host
   is still the `CHANGE-ME…` placeholder, so you can't accidentally ship a broken endpoint.

Security note: Ollama has no auth. Serving it on `0.0.0.0` is fine **because Tailscale keeps it on your
private tailnet** — do not port-forward `11434` to the public internet.

### Per device

| Device | Command | Result |
|---|---|---|
| MacBook M4 Pro | `./bootstrap.sh --vault "…"` | `auto` → **local** (24 GB runs `llama3.1:8b` easily) |
| CachyOS rig | `./bootstrap.sh --vault "…"` | `auto` → **local** (its own Ollama) |
| iPad Pro / iPhone | *can't run the script* — see below | uses the **rig** |

The rig's 3090 Ti (24 GB) can serve a bigger model than the laptops if you like — set
`ai.backends.rig.chatModel` to e.g. `qwen2.5:14b`, pull it on the rig, and (optionally) add it as a
second switchable model in `settings/copilot/data.json`.

### iPad & iPhone (Obsidian Sync)

Mobile can't run Node, so it gets the vault — including `.obsidian/` — via **Obsidian Sync**. The catch:
Sync shares each plugin's `data.json`, so a single synced file can't be both `localhost` (MacBook) and
the rig (iPhone). Keep the AI endpoints device-specific:

1. In **Settings → Sync**, sync *installed community plugins* and general settings, but turn **off**
   community-plugin **settings** sync — so each device keeps its own AI `data.json`. (Everything else in
   this repo is identical across devices anyway.)
2. On the desktops, `bootstrap` sets local (or rig) per device as above.
3. **Seed mobile once** (pick one):
   - *Easiest:* on iPad/iPhone, open **Settings → Copilot** and **Settings → AI Tagger Universe** and set
     the Ollama base URL to the rig's Tailscale URL (Copilot: bare host, no `/v1`; AI Tagger: append
     `/v1/chat/completions`). Do this once per device; it sticks.
   - *Or:* temporarily flip community-plugin-settings sync **on**, run `bootstrap --profile rig
     --force-settings` on a desktop so the rig `data.json` propagates to mobile, then flip it back off.

If you'd rather not fuss with any of this, the simplest uniform setup is `--profile rig` on **every**
device (mobile works out of the box) and switch to local on the MacBook only when you want, via Copilot's
model dropdown.

---

## How Obsidian plugins work (reference)

- Community plugins live in `<vault>/.obsidian/plugins/<id>/` as `manifest.json`, `main.js`, and
  optionally `styles.css`.
- Per-plugin settings are `<vault>/.obsidian/plugins/<id>/data.json`.
- Enabled community plugins are listed in `<vault>/.obsidian/community-plugins.json` (a JSON array of IDs).
- Core plugins are toggled in `<vault>/.obsidian/core-plugins.json`. **Bases is a core plugin** — enabled
  here, never downloaded.
- Release assets are published on each plugin's GitHub Releases page.

## Requirements

- **Node.js 18+** (uses only the standard library — no `npm install`, no dependencies).
- **Ollama** for the AI plugins (Copilot, AI Tagger Universe). Everything else works without it.

## Troubleshooting

- **`GitHub API rate limit hit`** — set `GITHUB_TOKEN` and re-run.
- **A plugin fails to resolve/download** — bootstrap logs the error, skips that plugin, and continues
  with the rest; the exit code is non-zero so you notice. Re-run to retry.
- **AI plugin can't reach Ollama (local)** — run `ollama serve` (or open the Ollama app) and `node check-ollama.js`.
- **Can't reach the rig** — confirm Tailscale is connected on this device (`tailscale status`), the rig is up
  and running Ollama with `OLLAMA_HOST=0.0.0.0`, and `ai.backends.rig.host` is the rig's real Tailscale name.
  Test with `node check-ollama.js --profile rig`.
- **`the rig host is still a placeholder`** — set `ai.backends.rig.host` in `plugins.json` (or pass `--rig-host`).
- **Plugins don't appear in Obsidian** — fully restart Obsidian; enabling happens via the JSON files, which
  Obsidian reads at startup.
