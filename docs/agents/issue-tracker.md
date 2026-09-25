# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues on **`ridgetocoast/ridge-to-coast`**.
Use the `gh` CLI for all operations.

## Always pass `--repo`

This clone has two remotes and **`gh` cannot infer the right one**:

| Remote | Repo | Issues |
| --- | --- | --- |
| `origin` | `loobo07/ridge-to-coast` (fork) | **disabled** |
| `upstream` | `ridgetocoast/ridge-to-coast` | enabled — issues live here |

No `gh` default repo is set, so a bare `gh issue list` resolves to the fork and
returns an empty list instead of an error. Every command below therefore pins
`--repo ridgetocoast/ridge-to-coast`. Do not drop that flag.

(Alternative: run `gh repo set-default ridgetocoast/ridge-to-coast` once, which
writes the choice to `.git/config`. The explicit flag still works either way and
survives a fresh clone, so prefer it.)

## Conventions

- **Create an issue**: `gh issue create --repo ridgetocoast/ridge-to-coast --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --repo ridgetocoast/ridge-to-coast --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --repo ridgetocoast/ridge-to-coast --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --repo ridgetocoast/ridge-to-coast --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --repo ridgetocoast/ridge-to-coast --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --repo ridgetocoast/ridge-to-coast --comment "..."`

## Pull requests as a triage surface

**PRs as a request surface: no.** _(Set to `yes` if this repo treats external PRs as feature requests; `/triage` reads this flag.)_

When set to `yes`, PRs run through the same labels and states as issues, using the `gh pr` equivalents:

- **Read a PR**: `gh pr view <number> --repo ridgetocoast/ridge-to-coast --comments` and `gh pr diff <number> --repo ridgetocoast/ridge-to-coast` for the diff.
- **List external PRs for triage**: `gh pr list --repo ridgetocoast/ridge-to-coast --state open --json number,title,body,labels,author,authorAssociation,comments` then keep only `authorAssociation` of `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close` — each with `--repo ridgetocoast/ridge-to-coast`.

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

## When a skill says "publish to the issue tracker"

Create a GitHub issue on `ridgetocoast/ridge-to-coast`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --repo ridgetocoast/ridge-to-coast --comments`.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a single issue with **child** issues as tickets.

- **Map**: a single issue labelled `wayfinder:map`, holding the Notes / Decisions-so-far / Fog body. `gh issue create --repo ridgetocoast/ridge-to-coast --label wayfinder:map`.
- **Child ticket**: an issue linked to the map as a GitHub sub-issue (`gh api` on the sub-issues endpoint). Where sub-issues aren't enabled, add the child to a task list in the map body and put `Part of #<map>` at the top of the child body. Labels: `wayfinder:<type>` (`research`/`prototype`/`grilling`/`task`). Once claimed, the ticket is assigned to the driving dev.
- **Blocking**: GitHub's **native issue dependencies** — the canonical, UI-visible representation. Add an edge with `gh api --method POST repos/ridgetocoast/ridge-to-coast/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` is the blocker's numeric **database id** (`gh api repos/ridgetocoast/ridge-to-coast/issues/<n> --jq .id`, _not_ the `#number` or `node_id`). GitHub reports `issue_dependencies_summary.blocked_by` (open blockers only — the live gate). Where dependencies aren't available, fall back to a `Blocked by: #<n>, #<n>` line at the top of the child body. A ticket is unblocked when every blocker is closed.
- **Frontier query**: list the map's open children (`gh issue list --repo ridgetocoast/ridge-to-coast --state open`, scoped to the map's sub-issues / task list), drop any with an open blocker (`issue_dependencies_summary.blocked_by > 0`, or an open issue in the `Blocked by` line) or an assignee; first in map order wins.
- **Claim**: `gh issue edit <n> --repo ridgetocoast/ridge-to-coast --add-assignee @me` — the session's first write.
- **Resolve**: `gh issue comment <n> --repo ridgetocoast/ridge-to-coast --body "<answer>"`, then `gh issue close <n> --repo ridgetocoast/ridge-to-coast`, then append a context pointer (gist + link) to the map's Decisions-so-far.
