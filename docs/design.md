# Stratic v3 design direction

This document records the direction agreed on 7 September 2026. It guides the
reimplementation. The [README](../README.md) describes the first working subset
and how to run it.

The [data model and file layout](data-model.md) develops these choices.

## Purpose

Stratic lets a person understand software and request changes at a useful level
of abstraction. AI coding agents maintain descriptions, implementation, and the
connections between them as the project evolves.

The hierarchy helps both readers and agents work with a manageable part of the
system. A local change should require local investigation, expanding when its
effects cross a responsibility or dependency boundary. The agent explains where
investigation stops and what remains uncertain.

Stratic v3 is one TypeScript product with a desktop application, an agent-facing
CLI, and skills that guide the work. New features need a concrete place in the
everyday workflow before they earn a place in the product.

## Descriptions and connections

Descriptions form a rooted tree. Every description except the root has one
parent and elaborates a responsibility introduced there. Branches can have
different depths; there are no prescribed L0–L3 levels.

Each description must be understandable without opening its children. Children
add useful detail. A branch reaches implementation when precise code links can
meaningfully connect its claims to the source. Descriptions have stable identities
and can be inspected in their historical Git versions.

Meaningful passages link to their elaborations and exact implementation ranges.
Cross-branch connections begin with two kinds:

- A dependency states which promise a responsibility relies upon. Changes to
  that promise can require investigation of its dependents.
- An ordinary reference provides useful context without automatically propagating
  change impact.

A shared topic alone is insufficient reason to add a dependency. The tree and
implementation links already carry much of the structure. Connections should
help explain and investigate the program without overwhelming the prose.

Descriptions can state intended behavior before it exists. Implemented, partial,
and unimplemented behavior remain distinguishable from whether a description
has been checked against recent changes. In-scope responsibilities need a place
in the account; omissions and uncertain relationships must be visible.

Writing should establish the subject, behavior, and relevant boundaries at the
chosen scope. Clarity comes before brevity. Remove repetition and unnecessary
procedural language, and split responsibilities when doing so helps understanding.

## Making and accepting changes

Changes can begin with intended behavior or with existing code and other project
resources. Agents propagate intended changes into implementation and reconcile
resource changes with the descriptions. Reconciliation must preserve intentional
future behavior; unclear product intent goes back to the user.

The graph supplies a starting point for investigation. Agents follow evidence of
effects beyond the declared connections and repair missing links when discovered.
Absence from the graph is not evidence that an effect is impossible.

Maintaining descriptions, checking links, reviewing the affected contracts, and
running appropriate tests are part of making the change. When an agent reports
that a change is ready, this work has already completed and the exact proposed
content is identified. Unrelated working changes remain outside that proposal.

Start with one review record for the proposed change. It records what was checked,
the conclusions, test results, and unresolved issues. Mechanical checks establish
structural properties; the agent judges whether the descriptions and links mean
the right things. More records cannot establish semantic correctness.

After the user says “accept and commit,” Stratic checks that the proposed content
still matches the reviewed content, performs quick structural validation, and
commits the exact change. It reuses completed checks when their inputs are
unchanged. If content has changed, the agent identifies the difference and
performs the necessary additional checks. Acceptance does not authorize a push.

## Reading, agent interaction, and tests

The desktop application supports passage-based navigation through descriptions
to implementation, source inspection, and history. It shows working descriptions
with a clear indication of uncommitted changes. Incomplete edits and broken links
remain inspectable, with problems shown where they occur; consistency is required
at readiness and acceptance. Cross-connections are available
when inspecting a passage or its relationships without requiring every connection
to have simultaneous visual emphasis.

The initial agent–UI interface needs two operations: read the current selection
and open a description, optionally at a passage. Both identify the project and
displayed revision. Description editing remains part of the agent workflow.

Tests are individually inspectable and connected to the behavior they check.
Show their last recorded result and whether it applies to the inspected state.
Results can be recorded during ordinary work before any acceptance review exists;
the review includes the results it uses. The content a check examined stays
distinct from the final content approved for commit. Existing project tools run
the tests. This scope does not require a large independent verification system.

## Git and excluded scope

Use embedded descriptions on ordinary Git branches. For contributions to a
project that does not use Stratic, keep descriptions on a personal working branch
and prepare a separate contribution branch containing the selected project
changes, including relevant tests and configuration. A direct merge of the
working branch would also bring its Stratic files. A filtered patch can transfer
the selected changes instead.

Bring upstream updates into the working branch and reconcile its descriptions.
This replaces companion repositories in the proposed design. Before treating the
workflow as settled, exercise two successive contribution-and-update cycles,
including upstream changes. References: [Git merge](https://git-scm.com/docs/git-merge)
and [Git apply](https://git-scm.com/docs/git-apply).

A disposable Git experiment on 7 September passed two such cycles with independent,
non-conflicting upstream edits. It preserved the descriptions on the working
branch and kept them out of both contribution branches. Overlapping edits and
conflict resolution remain to be exercised before implementing this workflow.

The initial scope excludes live document management and generation, saved
project-view systems, PR and general repository-management features, configurable
workflow frameworks, and extensive durable agent–UI command infrastructure.
These are outside the initial scope, with no commitment to add them later.

## Worked example: releasing a leased job

A local queue lets workers claim jobs under temporary leases and acknowledge
completed jobs. The user is reading its lifecycle description and requests:

> Let a worker release a job before its lease expires, so another worker can
> claim it immediately. Only the worker holding the current lease may release it.

The agent reads the selected description and relevant context, then proposes:

> The worker holding a live lease can release the job. Release ends the lease
> and leaves the job available for another worker to claim. A missing job, an
> expired lease, or a request from another worker leaves the queue unchanged.

Existing lifecycle rules inform the failure behavior. Consequential choices that
remain unresolved after investigation are discussed with the user before coding.

| Responsibility | Investigation outcome |
|---|---|
| Job lifecycle | Add the release behavior. |
| Lease transitions | Explain how release changes job state. |
| Command interface and handling | Expose the release operation. |
| Persistent storage | Confirm the existing representation and write operation suffice. |
| Queue engine and overall purpose | Confirm their broader descriptions remain accurate. |

The agent checks enough implementation context to support these conclusions,
changes the affected descriptions and code, and maintains their passage links.
Tests check release, invalid ownership, expiration, and persistence.

Before reporting readiness, the agent reviews the completed change, validates
the hierarchy and links, runs relevant tests and appropriate project checks, and
accounts for each identified impact. The handoff briefly states what changed,
what remained valid, what passed, and any unresolved issues. Supporting detail
remains available without filling the main conversation.

The user's “accept and commit” then completes this already-checked work. It does
not restart the investigation when the proposed content is unchanged.

## Findings from the first change trial

Description changes are highlighted against their review base, including removed
text that can be expanded. Keep this separate from passage selection and from
implementation status: edited text does not by itself tell us which behavior is
still missing. Highlights persist across navigation and remain available after
acceptance. Arrow navigation opens the selected description immediately.

Project and Git refreshes run off the UI thread. Description switches use the
loaded view; the acceptance path always verifies the live candidate independently.

## Reading interface

Show information when it changes the reader's understanding or next action.
Expected states, such as implemented behavior and a clean working tree, do not
need labels. Keep unfinished behavior and actual problems visible; place
secondary controls and identity details in the View menu. Reading panes begin
with the description itself, without repeating the hierarchy or routine metadata.

Use the title bar for location and navigation. Keep project selection in a
collapsible left panel, and local description navigation in the bottom panel.
