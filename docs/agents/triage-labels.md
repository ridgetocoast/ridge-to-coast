# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Not triage labels

`ridgetocoast/ridge-to-coast` also carries an `agent:*` family — `agent:plan`,
`agent:architect`, `agent:implement`, `agent:implement-hard`, `agent:design`.
Those are **multi-agent model-routing triggers** (see the model assignment table
in `CLAUDE.md`), not triage states. They are orthogonal to the five roles above:
an issue can carry one label from each family. Don't treat an `agent:*` label as
evidence that an issue has been triaged.

## Label creation status

`wontfix` already exists on the repo and is reused as-is. The other four are new
and must exist before `/triage` can apply them:

```bash
gh label create needs-triage   --repo ridgetocoast/ridge-to-coast --description "Maintainer needs to evaluate this issue" --color FBCA04
gh label create needs-info     --repo ridgetocoast/ridge-to-coast --description "Waiting on reporter for more information" --color D4C5F9
gh label create ready-for-agent --repo ridgetocoast/ridge-to-coast --description "Fully specified, ready for an AFK agent" --color 0E8A16
gh label create ready-for-human --repo ridgetocoast/ridge-to-coast --description "Requires human implementation" --color 1D76DB
```
