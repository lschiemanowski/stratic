---
name: stratic-tdd
description: Develop a Stratic behavior change test-first when the user or project selects TDD. Supplements the core Stratic skill; installation alone does not select this workflow.
---

# Stratic TDD

Use this workflow when the user requests TDD or the project's agent instructions select it for the task. A task-specific choice takes precedence over the project default. If neither selects TDD, use the core workflow without imposing a test-first order.

Read the adjacent [core Stratic skill](../stratic/SKILL.md) for description maintenance, evidence recording, preparation, and acceptance. Project instructions supply the relevant tools and test commands; this skill adds the test-first approach, not another review process.

Choose a coherent behavior to implement. Read its descriptions and source, then refine the intended behavior and important conditions before writing tests. Keep deliberate unimplemented behavior explicit.

Write behavior-focused tests using the project's existing tools. Run them against the current implementation and establish that they fail for the intended missing behavior. An import error, broken fixture, or unrelated failure is not that evidence. Preserve the useful failure output and identify the content tested. A coherent set of tests can precede implementation; one-test microcycles are not required.

Implement the behavior and refactor while the relevant tests pass. Run further checks appropriate to the affected responsibilities and boundaries. Test-first development does not imply running every available check for every change.

Reconcile the descriptions and any summaries with the completed behavior. Link tests to the description claims they actually check, just as implementation links identify the code supporting a claim. Keep the earlier failing evidence distinct from the final passing evidence; each describes the content actually examined. A meaningful earlier failure is useful history, not a passing result for the final proposal.

Complete the core workflow's investigation and preparation. TDD does not authorize acceptance or a commit, and does not change Stratic's acceptance rules.
