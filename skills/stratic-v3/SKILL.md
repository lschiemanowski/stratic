---
name: stratic-v3
description: Maintain a Stratic v3 project's hierarchical descriptions and passage links while changing code, and prepare or accept an exact reviewed change. Use for projects with stratic/project.json in format version 1.
---

# Stratic v3

Use the v3 CLI from its checkout: `node /path/to/stratic_v3/src/cli.ts --project /path/to/project COMMAND`. Confirm the executable with `version`; another installed `stratic` may be v1 or v2. `help` documents the commands. The CLI supplies structure and snapshots; your investigation supplies semantic judgment.

## Understand and change

Use `ui current` when a desktop selection provides useful context, `show ID` for its description and neighborhood, and `ui open ID` to direct the user's attention. Descriptions have stable IDs independent of their filenames. `list` gives orientation without loading all prose.

For a requested behavior change, clarify consequential uncertainty after investigating existing intent, then refine the affected descriptions before changing implementation. For code-led work, reconcile the descriptions while preserving intentional unimplemented behavior. Work in ordinary files. Broken intermediate links remain readable.

Keep descriptions self-contained. A child adds useful detail to its parent. Write about outcomes and contracts at broader scopes and representations and algorithms where they help explain implementation. Links select complete meaningful passages; a dependency explains the promise being relied on. Use `validate` to detect mechanical problems. It does not establish semantic accuracy.

Descriptions may include an optional `summary` array in their JSON metadata, with one nonempty text string per bullet. When changing a description that has a summary, review and update those bullets in the same change so promises, conditions, and limitations stay consistent. Add summaries where useful; absence is valid. Summarize the program responsibility, not the list of topics or children, and keep implementation passage links in the full description.

Use `impact --paths FILE ...` to start investigation. Record each examined description as `revised` when its contract or implementation meaning changes, or `unchanged` when its abstraction still holds, with a concrete reason. Supply these decisions through `impact --review /tmp/review.json --paths FILE ...` to expand revised branches to parents, dependencies, and dependents. Investigate further effects when evidence warrants it. Describe uncovered changed regions in the review's `unmapped` list, or repair the missing mappings.

## Check and prepare

Run appropriate checks with the project's existing tools. Capture the proposed content with `snapshot --paths FILE ...` before and after execution. Results must identify what was actually checked. When excluded working edits would affect execution, test an isolated checkout of the proposed snapshot.

`check record --file /tmp/result.json` imports a result shaped as:

```json
{
  "tree": "GIT_TREE_FROM_SNAPSHOT",
  "method": "The actual command or manual check performed",
  "outcome": "pass",
  "environment": "Relevant runtime and environment",
  "evidence": "Observed output or a concrete account of the check",
  "tests": []
}
```

Only name individual tests in `tests` when the execution evidence establishes their outcomes (`id` and `outcome`). An aggregate pass alone does not justify individual passes. Results can be recorded without a review. The initial implementation requires exact content equality when reusing them.

Complete a review input with `reviewer`, `summary`, `examined` (`id`, `outcome`, `reason`), `unresolved` (blocking issues), `resultIds`, and `unmapped` (`path`, `reason`) for any unresolved mapping diagnostics you have investigated. Keep deliberate missing implementation in description metadata, distinct from blocking issues.

Use `prepare --review /tmp/review.json --paths FILE ...` after finishing this work. Select only intended files; `--all` is an explicit convenience for a worktree whose entire change is intended. Store transient review/result inputs outside the source tree. Preparation requires valid structure, accounted-for impact, resolved blockers, and matching passing evidence. A manual check may be appropriate when automated tests do not apply; record what you actually examined.

Report the change, checks, remaining limitations, and ready review ID to the user. The ready record pins the final content, including its one review record.

## Accept the prepared change

When the user has authorized acceptance and commit, use `accept --id READY_ID`. If the proposed files are unchanged, this reuses the completed work. Do not repeat the investigation or tests just to enter the commit step. Changes to the proposal or its base require fresh preparation and any newly necessary checks.

A hook failure or hook edit stops acceptance before moving the branch. A terminated acceptance can be resumed with the same ID; inspect `ready` first. `discard --id READY_ID` withdraws readiness while retaining project edits and checks; if the commit already exists, complete recovery instead. Do not bypass failed checks. Acceptance does not authorize a push.
