---
name: new-tool-domain
description: Establishes the documentation domain for a new Tool or project — its own rules document, with the site docs kept site-level.
disable-model-invocation: true
---

# new-tool-domain

User-invoked: run it when the user starts a new project — usually a new Tool in this toolbox — so the project gets its own documentation domain before anything else is written. The domain is where the project's own rules and vocabulary will live; the site docs stay site-level (ADR-0014). This skill creates the domain and its skeleton only: it writes no code, does not edit the site docs on its own, and commits nothing.

## Steps

1. **Settle the name and slug.** Take the project name from the prompt. If there is none, ask — create no file until you have one. If the name is not kebab-case (most picked tool names are not), translate it to an English kebab-case slug (a cover generator becomes `cover-generator`) and confirm the slug with the user before creating anything. If the target path already exists (`src/tools/<slug>/` or `docs/projects/<slug>/`), stop and report — never overwrite, never merge.
   _Done when_: name and slug are confirmed, and the target path is confirmed not to exist.

2. **Pick the mode.** A Tool project gets its domain at `src/tools/<slug>/rules.md`; a generic project at `docs/projects/<slug>/rules.md`. Treat it as a Tool when the prompt names a tool page, a feature of the toolbox, or a `/tools/` route — or when in doubt, because this is a toolbox; otherwise treat it as generic.
   _Done when_: the mode is chosen and the target path is final.

3. **Create the domain and the skeleton.** Take the matching template from `templates.md` (same directory as this skill):
   - Tool mode: write `src/tools/<slug>/rules.md` from template A; if `src/tools/<slug>/README.md` exists, add one line to its layout tree pointing at `rules.md` — do not create a README for a tool that does not exist yet.
   - Project mode: write `docs/projects/<slug>/rules.md` from template B (`adr/` only when a decision needs one).
   Fill the scope block with the real name and slug; leave the vocabulary section empty, keeping its "add when there is one" note; list only pointers that are real paths.
   _Done when_: the file matches its template, contains no placeholder content, and every pointer is a real path.

4. **Run the ADR-0014 guard.** Scan the site docs (`apps/web/docs/design.md` routing table and rejected list, the `apps/web/docs/design/` modules, `CONTEXT.md`) for this project's name or a rule that belongs to it. Found any: list them, cite `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`, and do not edit. Found none: say so plainly.
   _Done when_: a verdict is reported — "clean" or a list of violations.

5. **State the next step.** Tell the user the repo flow: branch `feat/<slug>` (or `docs/<slug>`), `pnpm fmt`, the CI check list, and that merging is the owner's call. Do not branch, commit, or open a PR yourself.
   _Done when_: the next step is stated.