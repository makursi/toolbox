# Toolbox

A collection of single-purpose browser utilities. This glossary fixes the words used in code, docs and conversation, so that "a project" cannot quietly mean three different things.

## Language

**Tool**:
One user-facing capability, reachable at `/tools/<slug>`.
_Avoid_: feature, utility, project, app

**Tool page**:
The route `/tools/<slug>` that renders one Tool. The page _is_ the Tool, not a view of one.
_Avoid_: detail page, tool detail, tool view

**Package**:
Code under `packages/*` that other workspace packages import. Not user-facing.
_Avoid_: library, module, shared folder

**App**:
A deployable workspace package. Today the only App is `@toolbox/web`.
_Avoid_: site, project

**Tool Registry**:
The single list of Tools that exist; the homepage grid and the sitemap both read it.
_Avoid_: tool list, manifest, catalog

**Tool Card**:
The card that presents one entry of the Tool Registry on the homepage, and the only place a Tool's cover is used. A Tool without a cover is set in type instead.
_Avoid_: tile, list item, preview

**Site name**:
马库斯的大书箱 — the name a visitor sees, in the header, the page titles and a shared link's card (`siteName` in `apps/web/src/lib/site.ts`). It is not the Project's name, and the two stopped being the same word on 2026-09-18.
_Avoid_: brand, product

**Project**:
toolbox — the repository and the workspace packages (`@toolbox/*`), which is also what these docs are about. Naming a site is not renaming a project, and only the site was renamed.
_Avoid_: app, repo

**Instrument**:
Code that measures the rendered page and reports numbers: what is drawn where, and how big a hit area really is. Some instruments read the same page twice on one machine and compare the two readings; others read it at several widths and colour schemes and hold a threshold. The numbers are the output.
_Avoid_: checker, browser test, snapshot test — and "probe" as a name for the Instrument: to probe a point, or to check that the browser is still there, is what the word is for

**Gate**:
A check that asserts what the site does and whose failure blocks a pull request. It runs unattended, on every change, against the build that ships. A finding that is only written down in prose — however many times it has been reproduced by hand — is not one yet.
_Avoid_: test, CI check, regression suite

**Falsification run**:
A deliberate break of the thing a Claim guards — its source changed, or a style injected into the live page — followed by a re-run of that same Claim, which has to go red. It is how a guard is shown to be able to fail at all: done by hand, as evidence that goes in the log, and — for a geometry property — re-runnable by the Instrument itself (`touch-targets --falsify`). It is not mutation testing: nothing installs a mutation runner and nothing generates the breaks, because the point is the one property the guard is about, chosen by a person. The Chinese design docs write it 红一次 ("red once"), the way the Instrument is 量具 and the Gate is 门禁.
_Avoid_: negative test, mutation test

**Claim**:
One guarded property of the rendered page, named: a unit with its own reading, its own predicate, and the report lines only it prints — so that a Falsification run can re-run _that_ claim rather than a copy of it. The Chinese docs keep the English word, the way they write 红一次 for a Falsification run.
_Avoid_: assertion, check, guard (a Claim is the named unit; a Falsification run is what proves it can go red)

**Design doc set**:
The App's design documentation, in two layers: `apps/web/docs/design.md` is the **entry** — the invariants that must never be missed, the directions already rejected, and the routing table from "what you are touching" to the file that owns the rule — and `apps/web/docs/design/` holds the **modules**, one per area, each owning its rules and their reasoning.
_Avoid_: style guide, design guidelines, design system

**Site-level rule**:
A rule that binds every Tool because it is about the site itself: the shell (header, footer, cards, registry, routes), the design language, the CSP, the gate and instrument tiers, the Tool contract, the copy discipline. It lives in the design doc set or a repo-level ADR, and a Tool that breaks it reopens that decision.
_Avoid_: common rule, shared rule, public rule

**Tool-scoped rule**:
A rule that records one Tool's own product decision — its page structure, its input model, its export surface, its numbers and wording, its vocabulary. It lives with the Tool (`src/tools/<slug>/rules.md`) or in an ADR whose first line states the scope; no other Tool inherits it.
_Avoid_: site rule, universal rule; and never call a Tool's own rule a "site-level" one just because it was written first.
