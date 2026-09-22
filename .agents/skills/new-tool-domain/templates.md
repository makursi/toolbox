# new-tool-domain · skeleton templates

Used by step 3 of `SKILL.md`. Fill only real content; leave sections empty rather than inventing placeholders.

## Template A · Tool mode → `src/tools/<slug>/rules.md`

```markdown
# <slug> · Rules (tool-scoped)

> **Governs**: <tool display name>'s own rules and vocabulary. Binds this Tool
> only; site-level rules (the shell, the design language, the CSP, the gate and
> instrument tiers, the Tool contract) live in `apps/web/docs/design.md` and
> `apps/web/docs/design/`. Site docs hold site-level rules only; a Tool's own
> rules live here (`docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`).

## Vocabulary

Add terms only when there is one: this Tool's domain words that the site
glossary (`CONTEXT.md`) does not define.

## Pointers

- (Real paths only: this Tool's ADRs, site docs, README. Leave empty for now.)
```

## Template B · Project mode → `docs/projects/<slug>/rules.md`

```markdown
# <slug> · Project rules

> **Governs**: this project's own rules and vocabulary, kept separate from the
> site docs (site docs hold site-level rules only,
> `docs/adr/0014-tool-scoped-rules-live-with-the-tool.md`). Create
> `docs/projects/<slug>/adr/` only when a decision needs one.

## Vocabulary

Add terms only when there is one.

## Pointers

- (Real paths only. Leave empty for now.)
```