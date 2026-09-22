# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, or
- **`CONTEXT-MAP.md`** at the repo root if it exists: it points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in. In multi-context repos, also check `src/<context>/docs/adr/` for context-scoped decisions.
- **`apps/web/docs/design.md`**: read the entry first when the work is visual. It carries the invariants that must never be missed, the directions already rejected, and the routing table from "what you are touching" to the file that owns the rule. The modules are one file per area under `apps/web/docs/design/`: `colour.md` (values and light/dark), `typography.md`, `layout.md`, `components.md` (a component's look, its hit area, its icon), `motion.md`, `copy.md` (a sentence a visitor reads), `assets.md` (an image, a font, an icon), `checklist.md` (before merging), `log.md` (what is unfinished, and the evidence of a past run).
- **`apps/web/docs/adding-a-tool.md`**: read it when the work is adding or changing a Tool. It carries the gates a Tool has to pass, the files it touches, where its code lives, and the order the work happens in.
- **`src/tools/<slug>/design.md`**: when the work is inside one Tool and its own design doc exists, read it first — it holds rules that bind only that Tool (`docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`); the site's design doc set holds site-level rules only.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## File structure

Single-context repo (most repos):

```
/
├── CONTEXT.md
├── docs/
│   └── adr/
│       ├── 0001-monorepo-single-site.md
│       └── 0002-oxlint-oxfmt-over-eslint-prettier.md
└── apps/
    └── web/
        ├── docs/                    ← the App's own docs: design.md (the entry) + design/ (the modules), adding-a-tool.md
        └── src/
```

Multi-context repo (presence of `CONTEXT-MAP.md` at the root):

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← system-wide decisions
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context-specific decisions
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
