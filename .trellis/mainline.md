# Trellis Mainline

## Initiative

- title: Hosted workspaces, resource API, and cell navigation
- parent task: `.trellis/tasks/07-17-url-cell-navigation`
- objective: Preserve Rakuseru's browser-local editor while adding a self-hosted, access-controlled workspace, read-only resource API, and durable hosted-cell navigation.
- owner decision: the parent plan and `hosted-service-foundation` child start were approved on 2026-08-10; later children and serial continuation are not authorized.

## Continuation

- mode: guided
- serial authorization: none
- next pulse: user-requested or after an authorized child is archived

## Ordered Work

| order | task / proposed child | state | readiness and dependency evidence |
| --- | --- | --- | --- |
| 1 | `.trellis/tasks/07-17-url-cell-navigation` | approved parent plan | PRD, design, implementation plan, UUPM research, and both 13-entry context manifests passed planning validation; parent approval was received on 2026-08-10. |
| 2 | `.trellis/tasks/archive/2026-08/08-10-hosted-service-foundation` | completed | Automated root, independent security review, real MariaDB, clean image, Compose, and matching/wrong-key restore gates passed; submit-ready human review was approved on 2026-08-10. |
| 3 | proposed `hosted-sheet-resource-api` | blocked | Depends on the foundation child passing its quality gate and committing its interface contracts. |
| 4 | proposed `dual-mode-hosted-editor` | blocked | Depends on both backend children; its planning must generate approved task-specific UUPM research and bootstrap the missing browser-validation setup. |

## Evidence and Decisions

- completed evidence: the foundation child's automated evidence is recorded in `.trellis/tasks/archive/2026-08/08-10-hosted-service-foundation/evidence.md`; required human review was approved on 2026-08-10.
- current blocker / dirty-state warning: the worktree contains an uncommitted Trellis 0.6.14 update, Trellis Plus customizations, `.gitattributes`, and the active planning task; do not auto-continue or batch these as product work.
- next user decision: choose whether to plan/start `hosted-sheet-resource-api`; it remains blocked until separately authorized even though the foundation child is complete.
