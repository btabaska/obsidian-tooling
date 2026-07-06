# User Guide: Your New Obsidian Tooling

This assumes you already know Obsidian. It covers only what's new: the plugin stack the bootstrap installs, how the pieces fit together, and the handful of daily habits that make the automation pay off. Read it once, then keep it around for the "wait, how does the tagger work again" moments.

## The mental model

Three layers, working together:

1. **Capture** — you dump everything into a daily note (Periodic Notes + Calendar). No filing decisions at capture time.
2. **Automatic organization** — AI Tagger Universe reads notes and writes tags; Advanced Note Mover watches those tags and files notes into folders. This is the part that replaces the manual sorting you don't want to do.
3. **Surface & manage** — Bases turns your notes into filterable databases (your Notion replacement); Tasks + Kanban/Task Board run your scrum board; Copilot and Smart Connections let you and Claude reason over the vault.

You mostly live in layer 1. Layers 2 and 3 run quietly or on demand.

## First-run setup on each device

1. Install **Node.js** and **Ollama**.
2. `git clone` your setup repo, then `./bootstrap.sh --vault "/path/to/your/vault"`.
3. Run the `ollama pull <model>` command the script prints.
4. Restart Obsidian. Enable the plugins if Obsidian prompts you to trust them.

To update everything later (new plugin versions): `./bootstrap.sh --vault "/path" --update`. If a setup ever goes sideways, the script left a timestamped `.obsidian` backup — the README has the one-line rollback.

## The automatic-organization pipeline (the core of what you asked for)

**AI Tagger Universe** is the tagger. It sends a note's text to your local Ollama model and writes tags into the note's frontmatter. Because it's local, nothing leaves your machine and there are no API bills.

- Keep a `Tag List` note in your vault root with the tags you actually want it to use. This is the single most important thing you can do — it stops the AI from inventing 200 near-duplicate tags and keeps filing predictable.
- Run it on a note via the command palette ("AI Tagger: tag current note"), or enable tag-on-save if you want it fully hands-off. Start manual for a week so you can see what it does before trusting it.

**Advanced Note Mover** is the filer. It watches tags/frontmatter and moves notes into folders by rules you define, on save (with a debounce) or on a schedule.

- The bootstrap ships a few example rules (`work → Work/`, `home → Home/`, `gaming → Gaming/`). Open its settings and rewrite them to match your real folder structure.
- Rule of thumb: one top-level tag per life-area, mapped to one folder. Nested tags like `work/project-x` can map to nested folders if you install the multi-level behavior later.

**The loop in practice:** you write into today's daily note → periodically (or on save) the tagger tags new/edited notes → the mover files anything that's ready. You review the results occasionally, fix a rule, move on. Filing stops being a decision you make and becomes a thing that happens.

A caveat on mobile: local Ollama doesn't run well on phones. Do tagging from a desktop and let your sync carry the tags to mobile. Or, since Claude has direct vault access, have Claude run a tagging/sorting pass for you on a schedule — that's a real alternative to running the tagger on-device at all.

## Bases — your Notion replacement

Bases is a built-in core plugin that shows your notes as filterable tables and cards, driven by their frontmatter properties. No query language (unlike Dataview).

- Create a base, point it at a folder or a tag, and add columns from your frontmatter (status, priority, due, area).
- This is how you rebuild Notion databases: a "Projects" base, a "Reading" base, a "Someday" base — each just a saved view over notes that already exist.
- Kanban and calendar views for Bases are rolling out; until then, pair Bases (the database) with the Kanban plugin (the board) for the scrum workflow.

## Tasks + your scrum board

- **Tasks** lets you write checkboxes anywhere with due dates, priorities, and recurrence, then query them into one place. A single "Dashboard" note with a Tasks query = your master to-do list pulled from every corner of the vault.
- **Kanban** gives you a Trello-style board file where each card is a note — drag through To Do → Doing → Done. Good for a visible sprint board.
- **Task Board** builds a board *from your existing tasks/tags* instead of a separate file, so a task lives in exactly one place and still shows on the board. If you dislike double-entry (you will), prefer Task Board over plain Kanban.

Suggested setup: keep tasks inline in your notes with Tasks syntax, surface them on a Task Board for sprint work, and use a Bases view for longer-horizon project tracking.

## AI over your vault

- **Copilot** — chat with your vault, semantic search, inline generation. Defaulted to local Ollama in your setup. Use it for "summarize everything I wrote about X" or drafting from your own notes. Switch it to a cloud key later if you want higher quality — the README shows how without committing the key.
- **Smart Connections** — no prompting; it passively surfaces related notes in a sidebar as you write. Great for rediscovering things you forgot you wrote. Runs on local embeddings.

Many people run both: Copilot when you want to *ask*, Smart Connections when you want to be *reminded*.

## Templater + QuickAdd (power tools, adopt last)

- **Templater** — scripted templates. This is your escape hatch: any custom automation the off-the-shelf plugins don't cover (auto-splitting a daily note, injecting a project scaffold) can be a Templater script. It's also where a future "build it myself" would start, without needing a full plugin.
- **QuickAdd** — one-hotkey capture into a predefined note/template. Pair it with the daily-note habit: a single shortcut to jot a task or idea without breaking flow.

## A sane weekly rhythm

- **Daily:** capture into the daily note. Don't organize.
- **A few times a week:** run the tagger over recent notes (or let on-save handle it), glance at where the mover filed things, fix any rule that misfired.
- **Weekly:** review your Task Board / Bases dashboard, groom the sprint, archive done projects.
- **Monthly:** prune your `Tag List` note and mover rules. This is the only real maintenance the system needs.

## When to actually build something custom

You now have the whole pipeline without writing code. Only reach for a custom Templater script — or a real plugin — when you hit a *specific, repeated* gap the stack can't close. Write the gap down when you notice it; don't build speculatively. And remember Claude can operate on your vault directly, so "I want an AI to do X to my notes" is often a scheduled Claude task, not code you maintain.
