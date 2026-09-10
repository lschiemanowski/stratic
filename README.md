# Stratic v3

Stratic helps people and AI coding agents understand and change software through
plain-language descriptions connected to implementation. This first working
version contains a desktop browser, a CLI, and agent skills in a single
TypeScript codebase.

## Run the example

Use Node.js 24 or newer and Git:

```sh
npm install
npm run demo
```

The demo creates a **new disposable Git repository**, checks its baseline queue,
adds early lease release, updates descriptions and links, runs four queue tests,
prepares the review, and accepts the exact change. It prints the project path,
commit, and separate preparation/acceptance timings. It does not commit this
Stratic checkout.

Open the printed project path in the desktop app:

```sh
npm start -- --project /path/printed/by/the/demo
```

The reader shows the active description on the right and its parent on the
left. Selecting a sibling retains the parent; going deeper advances the pair.
Follow underlined passages in either pane through the hierarchy and into source.
Source appears beside the description containing its link. Closing source
restores that description with its parent.
A passage with one destination opens it directly; passages with several
destinations offer a choice in the side pane.
Source syntax colors use [Highlight.js](https://highlightjs.org/), with the
bundled GitHub light theme. TypeScript, JavaScript, Python, Scheme, and other
common languages are selected by filename. Line numbers and linked-passage
backgrounds remain visible. Unknown languages and files above 200,000 characters
use plain text to keep opening source predictable.
The foldable bottom menu shows the current level alongside the selected entry’s
parent and children. Click any description to open it. Use ↑/↓ for siblings, → for the first child, and ← for the parent
throughout the reader, even with the menu folded. Focused form controls retain
their own arrow-key behavior.
Each selection opens immediately. Escape folds the panel. Breadcrumbs open
ancestors directly from the title bar. Partial and unimplemented descriptions
show their status; implemented descriptions start directly with their prose.
The title-bar Projects button reveals a collapsible left panel for switching
between recent folders or opening another project. The View menu contains
revision selection, change highlighting, and Copy ID.
Tests appear with the descriptions they check and beneath open implementation. Each has a short explanation and a result disk; expand it to inspect its code. Earlier and missing results remain distinct from a current pass or failure. The revision selector shows
historical descriptions and source. Editing the project files refreshes the view,
including visible problems for broken draft links.

Changed paragraphs are highlighted against the prepared review's base, or HEAD
for an unprepared edit. On an unchanged accepted revision, the comparison shows
that accepted change. Highlights persist across description navigation; the
Proposed changes / Accepted changes button in View toggles them. Expand Removed text
to inspect deletions. These highlights are separate from the selected passage.

Navigation uses the loaded project. Project files, Git state, and check evidence
refresh in a background worker, so those reads do not block arrow navigation.
External edits can take a few seconds to appear; acceptance always checks live
files and never uses the desktop cache.

To leave the example ready for your own acceptance step:

```sh
npm run demo -- --prepare-only
npm run stratic -- --project /path/to/example ready
npm run stratic -- --project /path/to/example accept --id THE_READY_REVIEW_ID
```

`--destination NEW_DIRECTORY` chooses where the demo is created. Existing
folders are refused. The adjacent `NEW_DIRECTORY-report.json` records timings.

## Read Stratic's own descriptions

```sh
npm start -- --project .
npm run stratic -- --project . show stratic
```

The [self-description](stratic/descriptions/stratic.md) starts with the
project model, desktop reader, command-line interface, and agent skills. The
project model contains descriptions and links alongside reviewed changes. Its
test catalog links existing checks to the behavior they examine. Build and
example instructions stay in this README; the queue fixture retains its own
separate descriptions.

## Work with an agent

Install the [core skill](skills/stratic-v3/SKILL.md) into the managed repository:

```sh
node /path/to/stratic_v3/src/cli.ts --project /path/to/project skill install
```

Add `--with tdd` to include the optional [TDD workflow](skills/stratic-v3-tdd/SKILL.md).
Installation makes it available; select TDD in the task or the project's agent
instructions to use it. Those instructions can also name other project workflows,
test commands, and the v3 executable location. The installer does not rewrite them.

Skills live under `.agents/skills/` and can be committed with the project.
`skill status` compares them with this Stratic checkout; `skill update` updates
recorded skills only when they have not been locally edited. Conflicts stop the
operation before any skill is changed. Inspect the installed and bundled versions
and merge local customizations explicitly. Local additions are left alone.
The small `.agents/skills/.stratic-v3.json` file records installed content hashes;
keep it with the skills. No global skill installation or workflow engine is needed.

```sh
npm run stratic -- help
npm run stratic -- --project /path/to/example version
npm run stratic -- --project /path/to/example list
npm run stratic -- --project /path/to/example show job-lifecycle
npm run stratic -- --project /path/to/example ui current
npm run stratic -- --project /path/to/example ui open lease-transitions
```

Changes are made in ordinary Markdown, JSON, source, and test files. Use `impact`
with recorded decisions to expand an investigation; unchanged abstractions stop
their branches. A baseline without an exact review requires initial examination
before it can support bounded investigations.

Checks are run with the project's existing tools and imported with `check record`.
`prepare` requires explicit `--paths` or `--all`, semantic decisions, valid links,
and matching passing evidence. It pins only the changed files and their review.
`accept --id` reuses this work, checks for drift, honors commit hooks, and commits
that exact snapshot. It preserves unrelated staged and unstaged files and does
not push. An interrupted acceptance can resume with the same ID. `discard --id`
withdraws readiness while retaining project edits and recorded checks.

## Validate the implementation

```sh
npm test
npm run typecheck
npm run test:desktop
```

Tests exercise selectors, draft loading, stable identity, impact, evidence,
exact commits, staged changes, hooks, stale handoffs, and interruption recovery.
The desktop check launches the real Electron app and exercises passage navigation,
agent current/open, test results, history, draft errors, and renderer isolation.
It also checks keyboard and parent/child menu navigation with 300 leaf descriptions.
It writes a screenshot to `artifacts/desktop.png`.

## Scope of this first version

The desktop app runs from the checkout; there is no packaged installer yet. Its
reader displays headings and paragraphs with linked passages; other Markdown
syntax is shown as text. Raw HTML and external links are inert. Files larger than
2 MB and symbolic-link resources are reported as unsupported. Git history is
currently navigated through the twelve most recent commits.

Acceptance supports a checked-out branch and whole-file selection. Initial
adoption assumes an existing Git commit. Results use conservative exact-content
matching; a passing result remains distinguishable from an agent's semantic
review. The prototype is verified on macOS; other platforms are not yet checked.

The example's hierarchy and source are under [examples/queue](examples/queue).
The [design direction](docs/design.md) and [data model](docs/data-model.md) explain
our choices. Internal responsibilities remain small: file reading and links,
impact, review/Git operations, the CLI, and the desktop interface.

The list-style button at the upper right of each reading pane toggles its bullet
summary independently. Descriptions without summaries show full text without a button. Summaries live in the description metadata
as a `summary` array and are maintained alongside the full account.
View → Tree overview places main branches side by side and stacks deeper descriptions vertically.
Fold branches individually or limit visible levels with the depth slider. Drag or
scroll to pan, use the zoom buttons or pinch to zoom, and select a node to return
to paired reading. Escape or Back to reading returns without changing selection.

Descriptions render CommonMark and GitHub-style lists, tables, emphasis, quotations
and code blocks. Use `$...$` for inline equations and `$$` blocks for display
equations. Images use `![alternate text](relative/path.png)`, relative to the
description file, or `/path/from/project/root.png`. Project images follow the
displayed revision; external image URLs are not fetched. See the live
[formatted description](stratic/descriptions/formatted-descriptions.md) for an example.
