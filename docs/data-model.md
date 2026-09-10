# Proposed data model and file layout

This document describes the model used by the first working version. It supports
the workflow in [the agreed design](design.md) with ordinary files and Git
snapshots. The [README](../README.md) records current implementation limits.

## Files in a managed project

```text
stratic/
  project.json
  descriptions/
    queue.md
    queue.json
    job-lifecycle.md
    job-lifecycle.json
    lease-transitions.md
    lease-transitions.json
    ...
  tests/
    release-by-owner.json
    ...
  reviews/
    <change-id>.json
```

Markdown contains the descriptions. The adjacent JSON contains the parent,
realization, and links. JSON keeps the initial format directly readable by
TypeScript without a separate configuration language. Its main inconvenience
is escaped newlines in quoted code; the CLI should handle those when writing links.

Each description metadata file and test record contains an explicit stable `id`.
Choose a readable value such as `job-lifecycle` and retain it when the title,
filename, or parent changes. IDs are unique within their record kind and project;
do not reuse an identity for a different responsibility. Filenames can initially
match IDs but do not define them. Paired Markdown and JSON files share a stem.
The Markdown heading supplies the description title. There is no duplicate title,
level, revision counter, child list, or source-file inventory to maintain.

Keep the files flat: changing the conceptual hierarchy changes a parent link,
without moving directories. Git records history. A description at a particular
version is identified by its ID and the selected commit.

Flat directories, whole-file selection, and in-memory indexes are initial
implementation choices. The format version supports ordinary file migrations
when a concrete need arises; these choices need not become permanent API rules.

`project.json` holds a format version and the managed resource scope: repository-
relative path patterns and any exclusions with reasons. It does not duplicate
the hierarchy root, repository history, or application project catalog. The root
is the one description whose parent is null.

The application can remember opened folders and navigation locally. Pending
acceptance state is local to the Git worktree, using a location resolved through
Git rather than assuming `.git` is a directory. Neither belongs in the tracked
description model. No database or generated index files are needed initially.

## Descriptions and their links

Each metadata file has the following fields:

| Field | Meaning |
|---|---|
| `id` | Stable identity, independent of title, filename, and parent. |
| `parent` | The parent description and the passage elaborated there; null for the root. |
| `summary` | Optional array of nonempty strings, one per summary bullet. Omitted or empty means no summary. |
| `realization` | `implemented`, `partial`, or `unimplemented`. |
| `remaining` | A short explanation of intentionally absent behavior, when applicable. |
| `links` | Implementation links, dependencies, and contextual references originating here. |

For example, `lease-transitions.md` might contain:

```markdown
# Lease transitions

Successful release clears the lease owner and expiry while retaining the job.
```

The corresponding metadata could be:

```json
{
  "id": "lease-transitions",
  "parent": {
    "description": "job-lifecycle",
    "passage": {
      "quote": "The worker holding a live lease can release the job."
    }
  },
  "realization": "implemented",
  "links": [
    {
      "kind": "implementation",
      "from": {
        "quote": "Successful release clears the lease owner and expiry while retaining the job."
      },
      "to": {
        "path": "src/queue.ts",
        "passage": {
          "quote": "job.leaseOwner = null;\njob.leaseUntil = null;"
        }
      }
    }
  ]
}
```

This is a small illustrative responsibility, not the complete release contract.
The full hierarchy also needs to account for ownership, expiry, missing jobs,
and persistence. The code quoted here is illustrative rather than existing v3 code.

The same connection shape covers three kinds:

| Kind | Target | Effect |
|---|---|---|
| `implementation` | A repository path and exact passage | Connect a claim to the code or configuration realizing it. |
| `depends-on` | A description, preferably a specific passage | Reconsider the source when the relied-upon promise changes. |
| `reference` | A description, optionally a specific passage | Offer context without automatic impact propagation. |

A dependency also includes a short `reason` stating what is relied upon, such
as “Release must persist before another command reads the queue.” The source
passage shows where this reliance belongs in the explanation. A whole-description
endpoint is explicit (`from: null`, or an omitted target passage) and appropriate
only when the relationship applies to the whole description.

One connection names one target. Several connections can share a source passage;
the UI groups them. The parent connection is stored only on the child. Test
connections are stored only on the test. Incoming links and children are derived.
There is no separate span, edge, or resource identity registry.

## Selecting passages and following changes

Initially, prose and text resources use the same selector: a nonempty exact
`quote`, with optional exact `prefix` and `suffix` context. It must resolve to
exactly one location in the selected file version. Positions and line numbers
are derived for display.

Keep this matching logic in one resolver. The UI and impact logic consume
resolved passages and explicit resolution problems. Another selector can later
be introduced for a demonstrated need without changing the surrounding workflow.
The initial implementation needs only the quote resolver.

Inserting text before the selection does not move the link to different content.
Changing the selected text, introducing ambiguity, or renaming its file requires
repair during the change. Suggested matches can help an agent repair a link, but
the system must not silently retarget it. A rename does not require a permanent
identity for every code symbol.

Quotes should cover the smallest coherent block that realizes the claim. This
does duplicate some source text in metadata. It is an intentional starting
tradeoff for language-independent, explicit links; avoid a universal syntax-tree
or symbol-tracking system before practical use demonstrates the need.

The runtime builds lookup tables for parents, incoming connections, and linked
paths. Agent queries return the selected description and requested neighborhood;
they need not return the full graph. Changed paths and diff ranges seed impact
investigation. Both old and new mappings matter when links or files are removed.

Report changed in-scope files or regions that have no useful mapping. Mapping
accuracy, whether a dependency matters, and whether a description is complete
remain semantic judgments. A percentage of linked text is not an acceptance rule.

During editing, descriptions and links may temporarily be incomplete or invalid.
The UI and read commands should expose the readable content and local problems,
keeping unaffected descriptions usable. Broken links, missing parents, and
malformed metadata must not make the entire project unreadable. Do not invent
valid relationships where data is missing. Consistency is required before
reporting readiness and accepting the change.

## Tests

A test record has an explicit ID, a name, a short explanation, one or more exact
test-code locations, and the description passages it verifies. For example:

```json
{
  "id": "release-by-owner",
  "name": "The owner can release a live lease",
  "description": "Checks that release makes the job immediately claimable again.",
  "code": [
    {
      "path": "tests/queue.test.ts",
      "passage": {
        "quote": "await release(job.id, worker);\nexpect(await claim(otherWorker)).toEqual(job.id);"
      }
    }
  ],
  "verifies": [
    {
      "description": "job-lifecycle",
      "passage": {
        "quote": "Release ends the lease and leaves the job available for another worker to claim."
      }
    }
  ]
}
```

The example code is illustrative. Real selectors must cover the meaningful test
logic, using context where needed. There is no second test hierarchy, suite
registry, fixture graph, or test execution engine in the initial model.

Results can be recorded and inspected during ordinary development, before a
review exists. Each is a small record of the command or method, content examined,
outcome, time, and relevant environment. Local result files belong to the Git
worktree's Stratic state. A review includes the results it uses so its historical
evidence remains available independently of those local files.

A result names a test only when the execution report or recorded observation
establishes that individual outcome. A passing command alone must not paint
every registered test green. Aggregate command outcomes can still be recorded.
Unregistered tests may exist; the UI must make the declared catalog scope and
known omissions clear.

## One review record and an exact Git snapshot

Work proceeds in ordinary files. When preparing the change for review, select
its paths explicitly and form the complete proposed snapshot from the base
commit plus those changes. Other working edits and staged content are not
automatically included. The initial workflow can select whole files; partial
file staging need not become another Stratic feature.

Git can represent an exact proposed snapshot before a commit exists. This lets
the ready handoff refer to content already held by Git rather than copying the
project into a separate candidate store. See [git write-tree](https://git-scm.com/docs/git-write-tree)
and [git read-tree](https://git-scm.com/docs/git-read-tree).

One review record stores:

- The base commit and the Git tree identifying the reviewed content.
- Who reviewed it, when, and a short summary of the change.
- The descriptions examined, conclusions, and reasons for stopping investigation.
- Results of checks used, preserving their actual input snapshots, outcomes,
  time, environment, and useful evidence references.
- Unresolved issues. Blocking issues prevent a ready handoff; intentional missing
  behavior remains distinguishable from a defect in the proposed change.

These are bounded review conclusions about the full proposed snapshot, not a
claim that every description was independently audited again. Preparing the
initial hierarchy requires the broader investigation appropriate to adoption.

Each result must name the content its check actually examined. Keep this separate
from the final snapshot approved for commit. If excluded working edits would
affect the checks, use an isolated checkout of the proposed snapshot. Never
rewrite a result's input identity to make it appear to have tested newer content.

The new review file cannot be part of the content fingerprint it contains.
Compute the content tree with only that new file absent, then add the completed
record. Previous review files remain included. A small local ready record pins
the base commit, selected paths, new review path, and final tree including the
review. This also detects edits to the review itself after preparation.

Acceptance checks the unchanged base and proposal, validates the final structure,
and commits the pinned tree after user authorization. It preserves unrelated
working and staged changes. Commit hooks or concurrent edits must not silently
change the result. Git integration details need a focused implementation design;
the model does not require a second history or a sequence of approval objects.

A historical review is applicable only to the content it identifies. Merely
carrying its file into a later commit or merge does not approve that later state.
The reviewed tree can be reconstructed from its commit by removing only its own
review file, so historical inspection need not rely on retaining an otherwise
unreferenced tree object.

Initially, automatic result reuse requires the same content snapshot and stated
execution context. Keep that conservative matching rule separate from result
storage and exact final acceptance. Later, a narrower comparison may establish
that a result still applies after an unrelated edit, while preserving what it
actually ran against. The initial version needs no fine-grained dependency model.
External conditions may also change, so display the run time and environment
rather than promising present external validity. The UI distinguishes
implementation status, uncommitted changes, and recorded review/test information
without storing another mutable status on every node.

## Checks of the proposal so far

In a disposable repository, two code-only contribution cycles followed by
upstream merges preserved the personal descriptions and independent upstream
edits. In both cycles, removing the new review file reconstructed the recorded
content tree exactly. This checked the Git representation, not the proposed
application, concurrent edits, or overlapping merge conflicts.

The first executable workflow now opens a described project, navigates passages
to code, makes the example change, records checks, and prepares and accepts the
unchanged result. Automated tests also exercise stale proposals, hooks, preserved
staged changes, and interruption recovery. See the README for repeatable commands.
