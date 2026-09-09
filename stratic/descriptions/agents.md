# Command-line interface

The command-line interface exposes the Stratic project model to agents and other programs. It translates requests into project reads, impact calculations, evidence records, prepared proposals, and acceptance. Its responsibility is to make those operations explicit and inspectable while leaving the judgment about descriptive accuracy to the agent and reviewer.

Every project operation is associated with a Git repository selected by the caller or the current directory. Reading operations can distinguish working content from a historical revision; review operations concern a proposed change in the current worktree. Help explains the invocation syntax and available commands. Version identifies the executable and project format, which matters when several Stratic versions are installed.

Reading operations expose the existing account of the program at different scopes. List gives an overview of the descriptions without loading all their prose into the response. Show opens one description together with the connections and context needed to investigate it. Source reads the implementation file that a description refers to, from working files or a chosen revision.

Investigation operations expose structural problems and the recorded relationships affected by a proposal. Validate reports broken structure and passage links while the agent is editing the project. Impact identifies the responsibilities that need investigation and uses recorded decisions to follow the effects of a change. The CLI supplies evidence about where to look; the agent supplies the reasons why a surrounding promise still holds.

Checks run through the project’s existing tools. Snapshot captures selected file contents so check results can identify exactly what was examined. Check record stores an observed result, its evidence, and the content it applies to. Check list retrieves those records without running the checks again.

Preparation and acceptance are separate steps. Prepare combines the investigation and matching check results into a concrete proposal for the user to inspect. Ready retrieves that prepared proposal and its identity without accepting it. Accept commits the prepared content only when given the explicit review identity. Discard withdraws readiness while retaining the project edits and recorded checks.

The desktop connection gives the person and agent a shared focus. UI current reports which description and passage the person is reading. UI open directs the desktop to the description or passage being discussed. Neither operation edits the project or grants permission to commit.

Command responses are structured JSON, except for human-readable help. Errors produce a JSON error and a nonzero exit status; validation also returns a nonzero status when project issues are present. Commands that mutate review state reject unexpected arguments before dispatching the operation. The interface neither generates descriptions nor executes the checks whose results it imports.
