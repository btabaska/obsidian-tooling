# Obsidian Research Pass: Organization, AI Tagging, and Your Plugin Stack

*Prepared July 6, 2026*

You asked three things: how people set up Obsidian, whether your AI-tagging-and-sorting idea already exists, and what else you should be running. Short version up front: **your idea already has a mature open-source implementation, so you almost certainly don't need to build a plugin.** You can assemble the "organization becomes automatic" system you're describing today by combining 2–3 existing plugins. Details below.

---

## 1. How people are setting up Obsidian

There are a handful of named systems, but the consensus among experienced users is a *hybrid*, and — importantly for you — the ADHD/NVLD community has converged on something simpler and more forgiving than the power-user norm.

**The two organizing questions.** The cleanest mental model people use: folders answer *"where does this belong?"* and tags answer *"what is this about?"* Tags are signals for discovery and filtering, not your primary structure. Most experienced users land on PARA (Projects, Areas, Resources, Archive) for top-level folders, tags for cross-cutting topics, and MOCs ("Maps of Content" — a note that's just curated links to other notes) as a navigation layer. Johnny Decimal (rigid numbered categories like `11.01`) exists but tends to fight Obsidian's link graph and creates constant renaming, so it's a minority choice.

**The ADHD/NVLD consensus is the part worth internalizing.** Across every ADHD-focused guide I found, the same advice repeats: the elaborate setup is a trap. Complicated systems are fun to build and then quietly make your life worse. The recommended core is deliberately dumb:

- **Capture everything into a daily note first**, with zero categorization. One searchable "junk drawer" per day eliminates the "where should this go?" decision that freezes executive function. Sorting happens *later* (or automatically — see section 2), never at capture time.
- **Lean on the graph and search instead of perfect filing.** Obsidian works as an external brain that mirrors associative thinking; you don't have to file things correctly if you can find them by link or search.
- **Impose a plugin freeze when starting.** Multiple guides literally say: no new plugins for the first two weeks. The 2,000+ plugin ecosystem is itself an ADHD trap. (You already sensed this — it's a real and named failure mode, not just intimidation.)

The takeaway for your situation: the goal isn't a beautiful taxonomy you maintain by hand. It's *capture with no friction* + *automatic sorting behind the scenes*. That's exactly what you described wanting, and it's the right instinct.

---

## 2. Does your idea already exist? Yes — and you can skip building it

Your concept ("AI tags and sorts files so organization is automatic") is essentially a solved problem in the ecosystem. It's split across two cooperating plugins rather than one, but the combined result is what you're imagining:

**Step 1 — AI tagging.** Several open-source plugins read a note's content with an LLM and write tags into the frontmatter, learning your existing tag vocabulary so it stays consistent:

- **AI Tagger Universe** (open source, actively developed) — the most capable. Analyzes note content, matches your existing tags, suggests new ones, and supports 15+ backends including local models (Ollama, LM Studio) so notes never leave your machine. Can auto-tag on create/modify.
- **Metadata Auto Classifier** — writes tags *and* arbitrary frontmatter fields; multi-provider (OpenAI, Gemini, Ollama).
- **LLM Tagger**, **AI Tagger** (lucagrippa), **Auto Classifier** — similar, lighter-weight alternatives.

**Step 2 — automatic filing.** A separate plugin watches for tags and moves notes into the right folder automatically:

- **Advanced Note Mover** — the strongest current option. Moves notes by tags, frontmatter, filename, dates, or links; runs on save (2-second debounce) or on a schedule. Set rules once and it maintains the vault.
- **Auto Note Mover** — the long-standing, simpler classic (rules from tags/regex).
- **Multi-Level Note Mover** / **Folder by Tags Distributor** — variants that map nested tags (`#work/project/x`) onto nested folders.

**The combined pipeline** — AI Tagger Universe → Advanced Note Mover — is a documented, popular setup. People are already running "local LLM tags my chaotic vault, rules file it away" exactly as you pictured. You define a tag list once (a simple `Tag List` note in your vault root keeps the AI consistent), and capture-then-forget becomes real.

**Build vs. buy recommendation.** Don't build a plugin *yet*. Building an Obsidian plugin means learning TypeScript, the Obsidian API, and the LLM plumbing that these projects already solved — a big lift for someone who's (reasonably) intimidated by just *installing* plugins. Instead:

1. Adopt the AI-tagger + note-mover stack and live with it for a few weeks.
2. Note precisely where it falls short of *your* brain (e.g., "I want it to also split my daily note into separate notes," or "I want a Claude-specific tagging prompt").
3. *Then*, if a real gap remains, the highest-leverage move is usually a lightweight custom **Templater script** or a small tweak — or, since you have Claude with direct access to your vault via the Obsidian connector, letting me do bespoke tagging/sorting passes on demand rather than shipping a plugin at all.

That last point matters: I can already read, search, tag, and reorganize your vault directly. For a lot of what you want, "an AI that organizes my Obsidian" might just be *me on a schedule*, not a plugin you maintain.

---

## 3. The plugin stack I'd recommend

Grouped by job. Everything here is free and open source. Start with the "install now" tier and resist the rest until you feel a specific need.

### Tier 1 — Install now (the foundation)

- **Bases** (core plugin, built into Obsidian since v1.9, no install needed) — turns notes into filterable database tables/cards from their frontmatter properties, *without* the query language Dataview requires. This is the single biggest reason you can retire Notion: it's the "database view" Notion holdouts were waiting for, and Kanban/calendar views are rolling out. Start here for the Notion-replacement goal.
- **Tasks** — full task management inside notes: due dates, priorities, recurring tasks, and queries that pull every checkbox across your vault into one view. Replaces Todoist/Things for personal use.
- **Periodic Notes** + **Calendar** — daily/weekly notes on a schedule. This is the backbone of the ADHD "capture into today's note" workflow.

### Tier 2 — The automatic-organization layer (your actual request)

- **AI Tagger Universe** — AI tagging (section 2).
- **Advanced Note Mover** — automatic filing by tag (section 2).

### Tier 3 — Notion / scrum-board replacement

- **Kanban** — Trello-style boards where each card is a note; drag through To Do → In Progress → Done. The direct scrum-board swap.
- **Task Board** or **CardBoard** — Kanban views generated *from* your existing tasks/tags rather than a separate board file, so a task lives in one place and shows up on the board automatically. Better than plain Kanban if you dislike double-entry.
- **Dataview** — the power-user database engine. More capable than Bases but requires a query syntax. Recommendation: use Bases first; only add Dataview if you hit its ceiling.

### Tier 4 — AI / "Claude & other AI context" use

- **Copilot for Obsidian** (logancyang) — the strongest all-rounder: chat with your vault, semantic search, inline generation, cloud *or* local models. Best if you want conversational synthesis over your notes.
- **Smart Connections** — generates local embeddings and *passively* surfaces related notes as you write, no prompting, nothing leaves your machine. Best for serendipitous recall. Many people run both (Copilot for asking, Smart Connections for suggesting).

### Tier 5 — Quality-of-life (add later, one at a time)

- **Templater** — scripted templates; the escape hatch for any custom automation you can't buy off the shelf (and where a future "build it yourself" would likely start).
- **QuickAdd** — one-hotkey capture into predefined notes/templates; pairs with the daily-note capture habit.

---

## 4. A concrete starting setup for you

Given ADHD/NVLD + your all-of-life scope + wanting to absorb Notion, here's a sequence that avoids the plugin-overwhelm trap:

**Week 1 — capture only.** Enable core plugins Bases, Daily Notes. Do nothing but dump everything into the daily note. No folders, no tags, no filing. Get comfortable.

**Week 2 — add structure lightly.** Create top-level PARA-ish folders (Work, Life, Home, Gaming, Hobbies, Archive) and an `AI Context` folder for your Claude material. Install Tasks + a board (Task Board). Start tagging by hand just enough to see what vocabulary you actually use.

**Week 3 — turn on automation.** Now install AI Tagger Universe + Advanced Note Mover. Feed the tagger the small tag list you naturally developed in week 2 (this keeps it consistent instead of inventing 200 tags). Let it tag; let the mover file. Adjust rules.

**Week 4+ — AI recall + Notion migration.** Add Copilot and/or Smart Connections. Rebuild your Notion scrum board as a Kanban/Bases view. Migrate task tracking over.

The reason for the staging: every ADHD guide warns that installing the whole stack on day one is how vaults get abandoned. One layer at a time, each earning its place before the next.

---

## Sources

**Organization systems & ADHD setup**
- [How to Set Up an Obsidian Vault in 2026](https://saturnitystools.com/blog/how-to-set-up-obsidian-vault/)
- [Obsidian Folder Structure – Best Practices](https://studio-obsidian.com/obsidian-folder-structure/)
- [Obsidian Note Organization: Folders vs MOCs vs Tags](https://blog.shuvangkardas.com/obsidian-note-organization/)
- [Note-Taking for the Chronically Distracted: An ADHD Guide to Obsidian](https://www.littleyellowdifferent.com/p/note-taking-for-the-chronically-distracted)
- [Obsidian for ADHD (adhdftw.com)](https://adhdftw.com/second-brain-tool-obsidian/)
- [How to Build a Planning System in Obsidian for ADHD and Autistic Brains](https://www.addielamarr.com/how-to-build-a-planning-system-in-obsidian-that-actually-works-for-adhd-and-autistic-brains/)
- [How to get started with Obsidian: a guide for Autistics & ADHDers](https://www.autisticasfxxk.com/blog/obsidian-guide/)

**AI tagging & auto-filing plugins**
- [Awesome Obsidian AI Tools (danielrosehill)](https://github.com/danielrosehill/Awesome-Obsidian-AI-Tools)
- [AI Tagger Universe (GitHub)](https://github.com/niehu2018/obsidian-ai-tagger-universe)
- [Metadata Auto Classifier](https://www.obsidianstats.com/plugins/metadata-auto-classifier)
- [Auto Classifier (GitHub)](https://github.com/HyeonseoNam/auto-classifier)
- [I let my local LLM organize my chaotic Obsidian vault (MakeUseOf)](https://www.makeuseof.com/letting-local-llm-organize-obsidian-notes/)
- [Auto Note Mover](https://www.obsidianstats.com/plugins/auto-note-mover)
- [Advanced Note Mover](https://community.obsidian.md/plugins/note-mover-shortcut)
- [Multi-Level Note Mover (GitHub)](https://github.com/jrjakiro/multi-level-note-mover)

**Plugin stack & Notion replacement**
- [Obsidian Plugins Productivity Guide 2026](https://aiproductivity.ai/blog/obsidian-plugins-productivity/)
- [The Best Obsidian Plugins for 2026 (Sébastien Dubois)](https://www.dsebastien.net/the-must-have-obsidian-plugins-for-2026/)
- [Introduction to Bases (Obsidian Help)](https://obsidian.md/help/bases)
- [An Overview of the Bases Core Plugin](https://practicalpkm.com/bases-plugin-overview/)
- [7 Best Obsidian Task Plugins of 2026](https://taskforge.md/blog/obsidian-task-plugins-guide/)

**AI-in-vault plugins**
- [Obsidian + AI in 2025: Smart Connections vs Copilot vs Claude Code](https://codeculture.store/blogs/developer-culture/obsidian-ai-plugin-comparison-2025)
- [Obsidian Copilot (GitHub)](https://github.com/logancyang/obsidian-copilot)
- [Smart Connections](https://smartconnections.app/obsidian-copilot/)
