# Claude Code Prompt — Portable Obsidian Setup

Copy everything in the code block below into Claude Code (run it from an empty directory where you want the new repo to live). It's written as a complete spec so Claude Code can build the whole thing in one pass, then you clone and run it on every device.

---

```
Build me a version-controlled, portable Obsidian configuration package: a git repo containing a bootstrap script that installs and pre-configures a fixed set of community plugins into any Obsidian vault, so I get an identical setup on every device I use. This is NOT an Obsidian plugin — it's a deployment tool for other people's plugins plus my baked-in settings.

## Goals
- Clone the repo on any device (macOS, Linux, Windows), run one command with a vault path, and end up with the full plugin stack installed, enabled, and configured identically.
- Idempotent: re-running updates plugins to their latest release and re-applies my settings without duplicating anything or clobbering my notes.
- No secrets in the repo. AI plugins target a LOCAL Ollama backend, so there are no API keys to manage.
- Cross-platform. Prefer a Node.js script (Node is easy to install everywhere) with a thin `bootstrap.sh` / `bootstrap.ps1` wrapper. If you think a pure POSIX shell + PowerShell pair is more robust, justify it and do that instead.

## How Obsidian plugins actually work (build against these facts, verify them)
- Community plugins live in `<vault>/.obsidian/plugins/<plugin-id>/` and consist of `manifest.json`, `main.js`, and optionally `styles.css`.
- Per-plugin settings live in `<vault>/.obsidian/plugins/<plugin-id>/data.json`.
- The list of ENABLED community plugins is a JSON array of plugin IDs at `<vault>/.obsidian/community-plugins.json`.
- Core plugins are toggled in `<vault>/.obsidian/core-plugins.json` (Bases is a CORE plugin — enable it here, do not download it).
- Plugin release assets (`manifest.json`, `main.js`, `styles.css`) are published on each plugin's GitHub Releases page.
- The authoritative mapping of plugin-id → GitHub repo is the file `community-plugins.json` in the `obsidianmd/obsidian-releases` repo. RESOLVE plugin IDs and repos from there at runtime rather than hardcoding them, so the setup doesn't rot. Fall back to a pinned list only if resolution fails.

## Plugins to install (resolve exact IDs/repos from the official registry)
Core (enable, don't download): **Bases**.
Community: **Tasks**, **Periodic Notes**, **Calendar**, **AI Tagger Universe**, **Advanced Note Mover** (the note-mover-shortcut plugin), **Kanban**, **Task Board**, **Copilot** (logancyang/obsidian-copilot), **Smart Connections**, **Templater**, **QuickAdd**.

## Repo structure I want
- `plugins.json` — the manifest of what to install: for each plugin, its id, human name, GitHub repo, and whether it's core vs community. This is the single source of truth I edit to add/remove plugins later.
- `settings/<plugin-id>/data.json` — the pre-baked settings for each plugin, copied into the vault on install. Populate sensible defaults (see below).
- `bootstrap.js` — the installer. Args: `--vault <path>` (required), `--update` (re-pull latest releases), `--dry-run`. It should: back up the existing `.obsidian` folder (timestamped) before touching anything; download each community plugin's latest release assets into the right folder; copy `settings/*` into place ONLY if the target `data.json` doesn't already exist, unless `--force-settings` is passed (so I don't overwrite tweaks I made on-device); enable Bases in `core-plugins.json`; add every community plugin ID to `community-plugins.json`; print a clear summary of what changed.
- `bootstrap.sh` and `bootstrap.ps1` — thin wrappers that check for Node, then call `bootstrap.js`.
- `check-ollama.js` (or fold into bootstrap) — verify Ollama is installed and reachable at `http://localhost:11434`; if a required model isn't present, print the exact `ollama pull` command. Do NOT auto-install Ollama, just detect and instruct.
- `README.md` — install/update/rollback instructions, and how to edit `plugins.json` to change the stack.
- `.gitignore` — ignore any accidental secrets, `node_modules`, and OS cruft.

## Pre-baked settings defaults (put these in settings/<id>/data.json)
- **AI Tagger Universe**: configured for a local Ollama endpoint (`http://localhost:11434`), a default model (use a small capable local model such as `llama3.1:8b` — pick one and document it), and set to read/write tags in frontmatter. Leave a clearly commented placeholder in the README explaining the `ollama pull` step.
- **Advanced Note Mover**: enabled with a couple of EXAMPLE tag→folder rules (e.g. tag `work` → `Work/`, `home` → `Home/`, `gaming` → `Gaming/`) and the on-save trigger with debounce ON, so it works out of the box but is obviously meant to be edited.
- **Periodic Notes**: daily notes enabled, sensible folder + date format.
- **Copilot**: default provider set to local (Ollama) so it matches the no-cloud posture; document how to switch to a cloud key later without committing the key.
- **Smart Connections**: local embedding model defaults (no cloud).
- **Tasks / Kanban / Task Board / Templater / QuickAdd / Calendar**: reasonable defaults; don't over-configure.
Keep every settings file minimal and heavily reference the README so I understand what each knob does.

## Constraints & quality bar
- Verify each downloaded plugin actually has the expected release assets before writing; fail loudly with a helpful message if a plugin can't be resolved, and continue with the rest.
- Never write inside my notes — only inside `.obsidian/`.
- The timestamped `.obsidian` backup + a documented one-line rollback are mandatory.
- Test the script end-to-end against a throwaway empty vault you create in a temp dir, show me the resulting file tree and the contents of `community-plugins.json` and one plugin's `data.json`, and confirm it's idempotent by running it twice.
- Write the README so a future me on a fresh machine needs only: install Node + Ollama, `git clone`, `./bootstrap.sh --vault "/path/to/vault"`, `ollama pull <model>`, restart Obsidian.

Start by resolving the plugin registry and confirming the exact IDs/repos, show me the resolved `plugins.json`, then build the rest.
```

---

## Notes for you before you run it

- **Run it from the folder where you want the repo created** (e.g. `~/code/`), not inside your vault. The output is a *separate* tool repo; you point it *at* your vault.
- **Push the repo to GitHub** once it's built — that's your "share with all devices" mechanism. On each new device: install Node + Ollama, clone, run bootstrap.
- **This coexists with your existing sync.** It only writes into `.obsidian/`, and it backs that folder up first, so it won't touch your notes or fight Obsidian Sync/iCloud/git-of-your-vault.
- **Ollama is the one manual per-device dependency.** The script detects it and tells you the `ollama pull` command, but installing Ollama itself is a one-time step per machine. On mobile (iOS/Android) local Ollama isn't practical — plan to run AI tagging from a desktop, and let sync propagate the tags to mobile.
