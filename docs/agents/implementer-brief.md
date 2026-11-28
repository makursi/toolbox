# The implementer brief

The invariant half of a background implementer's dispatch: what every implementer does, whatever the ticket. A dispatch names the ticket, the worktree, the branch and the integration branch; it adds the ticket's own scope and nothing else.

## Setup

- Confirm the base: `git log --oneline -3` shows the integration tip; if it does not, `git reset --hard <integration>`.
- Read the ticket and its spec (`gh issue view <n>`), then the rules the root and App `AGENTS.md` name. Read the closest prior Tool end to end before writing.
- Build exactly the ticket. Anything it does not name is a later ticket.

## Checks

- From `apps/web` when a root `turbo` command dies on the pnpm store lock: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`.
- The gate with this worktree's own `PW_PORT` (`PW_PORT=<port> pnpm exec playwright test <spec>`); `.next` must exist from the build.
- Watch one new claim fail on purpose, restore it, rebuild, re-run.
- `pnpm gate` before reporting when the change touches code.

## Landing

- Commit in conventional-commit English.
- `git merge <integration>` before reporting, and resolve what comes up.
- Report once: what landed, the exact commands and outcomes, anything unresolved, branch and commit. A second copy by message is processed as new input.

## What this file does not repeat

The repo's rules — copy, hit areas, dependencies, no third-party requests — are in the root and App `AGENTS.md`, and an implementer reads them there. This file carries only the dispatch protocol.
