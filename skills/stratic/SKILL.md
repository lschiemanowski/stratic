---
name: stratic
description: Maintain a Stratic project's hierarchical descriptions and passage links while changing code, and prepare or accept an exact reviewed change. Use for projects with stratic/project.json in format version 1.
---

# Stratic

Use the installed CLI: `stratic --project /path/to/project COMMAND`. When working on Stratic itself, follow its repository instructions to use `node src/cli.ts` from the checkout. Confirm the executable with `version`: this product reports Stratic and formatVersion 1. `help` documents the commands. The CLI supplies structure and snapshots; your investigation supplies semantic judgment.

## Choose the workflow

Read the repository's agent instructions for project conventions, the executable location, and check commands. A task-specific choice takes precedence over project defaults. Keep those conventions in ordinary project instructions; installing or updating Stratic skills does not rewrite them.

This core workflow does not require test-first implementation. When the user or project selects TDD, use the adjacent optional [Stratic TDD skill](../stratic-tdd/SKILL.md) if installed. If it is absent, report that and use the user's requested approach with the core guidance; the workflow choice does not depend on installing a file. Additional repository skills can supply other approaches without replacing the shared description, evidence, and acceptance responsibilities.

## Understand and change

Use `ui current` when a desktop selection provides useful context, `show ID` for its description and neighborhood, and `ui open ID` to direct the user's attention. Descriptions have stable IDs independent of their filenames. `list` gives orientation without loading all prose.

For a requested behavior change, clarify consequential uncertainty after investigating existing intent, then refine the affected descriptions before changing implementation. For code-led work, reconcile the descriptions while preserving intentional unimplemented behavior. Work in ordinary files. Broken intermediate links remain readable.

Keep descriptions self-contained. A child adds useful detail to its parent. Write about outcomes and contracts at broader scopes and representations and algorithms where they help explain implementation. Links select complete meaningful passages; a dependency explains the promise being relied on. Use `validate` to detect mechanical problems. It does not establish semantic accuracy.

Whenever creating or changing a description or its metadata, create a nonempty `summary` array if missing and review any existing summary against the full description. Update the bullets in the same change when promises, conditions, or limitations change; retain accurate bullets when they still apply. Use concise, self-contained strings that summarize the responsibility’s behavior, not a list of topics, children, or code files. Keep implementation passage links in the full description. The file format permits absent summaries for older content and drafts, but that compatibility is not a reason to omit a summary from newly created or changed descriptions.

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
