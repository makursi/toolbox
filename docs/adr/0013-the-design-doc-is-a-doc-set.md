# The design doc is a doc set

`apps/web/docs/design.md` was one 260-line file. Every UI change read all of it, and the only way to point at a rule was a section number (`§9`, `第五节`) — which its name carried on 48 lines across 26 files had to carry, and which nothing kept in step with the headings. It is a doc set now.

**`apps/web/docs/design.md` keeps its path and becomes the entry**: the invariants that must never be missed, the directions already rejected, and the routing table from "what you are touching" to the file that owns the rule. The rules themselves live in `apps/web/docs/design/`, one module per area, each named for the work that reaches it: `colour.md`, `typography.md`, `layout.md`, `components.md`, `motion.md`, `copy.md`, `assets.md`, `checklist.md`, `log.md`.

`§1` and `§12` folded into the entry, and `§13` became the entry's routing table. The legacy numbers map like this, for anyone reading an older pull request or commit:

| legacy section                                | now                                  |
| --------------------------------------------- | ------------------------------------ |
| §1 遵循的规范, §12 明确否掉的做法, §13 怎么改 | `apps/web/docs/design.md`            |
| §2 色彩 token, §7 明暗配色                    | `apps/web/docs/design/colour.md`     |
| §3 字体与排版                                 | `apps/web/docs/design/typography.md` |
| §4 布局                                       | `apps/web/docs/design/layout.md`     |
| §5 组件                                       | `apps/web/docs/design/components.md` |
| §6 动效                                       | `apps/web/docs/design/motion.md`     |
| §8 文案                                       | `apps/web/docs/design/copy.md`       |
| §9 图片资源                                   | `apps/web/docs/design/assets.md`     |
| §10 合并前检查清单                            | `apps/web/docs/design/checklist.md`  |
| §11 待办（含历次验证的证据）                  | `apps/web/docs/design/log.md`        |

## Consequences

- **A single file guarantees co-location; a doc set only approximates it.** A reader of `components.md` is no longer certain to have met the colour invariant. Two conventions pay for that, and both are the reader's to keep: the entry states each invariant in one line and **never** its reasoning (the module that owns the rule owns the "why"), and every module opens with a line naming what it governs and what to read alongside it. An entry that grows reasoning is the failure mode of this design.
- **The entry's path is now load-bearing.** It is what every pointer in the repo, both READMEs and `docs/agents/domain.md` name, so moving it renames the whole set. Modules may be added, split or renamed; the entry stays.
- **A reference names the owning file, from the repository root** — `apps/web/docs/design/components.md`, never `§5` and never a bare `components.md` — the same rule `apps/web/AGENTS.md` already applies to every documentation path. Where an enumeration is what is needed, the directory is named once in full and its files may then be listed by bare name: the trees in `README.md` and `apps/web/AGENTS.md`, and the pointer in `docs/agents/domain.md`.
- **`docs/agents/domain.md` carries the branch list**, because a pointer that says "read the design doc" would now load ten files and lose the entire saving. It names the module per kind of work.
- **A rule change is one file, and one line at most.** The owning module always; the entry only when an invariant or the routing changed; `adding-a-tool.md` never, since it points at the file per case rather than at a section.
- **No numbers in the new names.** A numeric prefix would assert an order that does not exist and resurrect the numbering this change retires; the order is the routing table's.

## Considered Options

- **Keep the one file and sharpen its headings.** Rejected: it is the same 260 lines in context for the change that touches four of them, and the four are not the ones a change touches — the saving is the point.
- **Split by phase instead of by area** (rules / checklist / rejected / history): rejected — "rules" is then 180 lines, which is the file we started with.
- **One module per legacy section, thirteen of them.** Rejected: `motion.md` alone is 10 lines, and pointer overhead would exceed what the smallest files save. `§2` and `§7` merged into `colour.md` for the same reason.
- **Move the entry into the directory** (`design/README.md` or `design/index.md`). Rejected: it would rewrite every pointer in the repo to buy nothing an entry beside its modules does not already have.
- **Keep `§N` as stable identifiers with a lookup table.** Rejected: it retains two naming schemes, and the table becomes the thing people edit instead of the rule.
- **Move the ten rounds of browser evidence out of the design doc entirely**, to the Tool's `README.md` or the pull request. Not rejected, merely deferred: it is a content decision, and this change is a move.
