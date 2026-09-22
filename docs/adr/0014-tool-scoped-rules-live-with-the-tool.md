# Tool-scoped rules live with the Tool

The design doc set (`apps/web/docs/design.md` and its modules) is the site's single source of truth for how the site looks and why. The Image Converter, the first Tool, left its own product decisions there — its three-step page structure, its format rows and file list, the ban on output settings, its vocabulary (`Conversion`, `Lossless` in `CONTEXT.md`). The second Tool collides with rules that were never the toolbox's. The extraction and the per-rule disposition are recorded in `docs/drafts/decouple-tool-rules.md`; this ADR is the decision itself.

## Decision

1. **The design doc set holds site-level rules only.** A rule binds a Tool because it is about the site itself: the shell (header, footer, cards, registry, routes), the design language, the CSP, the gate and instrument tiers, the Tool contract, the copy discipline.
2. **A Tool's product decisions live with the Tool.** The first tool-scoped rule creates `src/tools/<slug>/rules.md`; the Tool's README links it. Its page structure, input model, export surface, numbers, wording and vocabulary are its own, and the next Tool does not inherit them.
3. **A repo-level ADR may record a tool-scoped decision, but its first line states the scope.** `docs/adr/0010-no-output-settings.md` is the model: a scope note at the top, the reasoning below.
4. **A site-level exemption born inside a tool decision is restated where it binds the whole site's reading of a rule.** The ban on pure white does not reach exported file pixels (a JPEG's flattened background is pure white); that exemption lives in the design doc set even though ADR-0010 is where the flattening is decided.

## Consequences

- `apps/web/src/tools/image-converter/rules.md` now owns the converter's rules; the site docs keep only the site's.
- `CONTEXT.md` defines site vocabulary only; `Conversion` and `Lossless` moved to the Tool's own doc (its ADRs and README keep using the words).
- `docs/adr/0010-no-output-settings.md` gained the scope note called for in decision 3.
- `apps/web/docs/adding-a-tool.md` and `docs/agents/domain.md` point new Tools and agents at the Tool's own rules doc before the site's.
- The `cover-generator` draft's C3 stops citing a site-wide ban that no longer exists; its export surface is its own product decision, settled in its own issue.

## Considered Options

- **Keep the Tool's rules in the doc set, marked "image-converter only".** Rejected: the doc set then carries every Tool's private rules in the context of every other, and a reader has to skip what is not theirs.
- **Let each new Tool negotiate its own exception.** Rejected: the same fight reopens per Tool, and exceptions to site rules multiply.
- **Put the Tool's design rules in its README.** Rejected: the README owns what the Tool does and what to check by hand; a design rule is neither.
- **Move ADR-0010 itself into the Tool.** Rejected for now: the decision is still worth not re-litigating where it is, and the scope note does the work a move would.
