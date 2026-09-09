# ui current: Read the desktop’s focus

UI current exposes the desktop’s semantic focus to the agent interface. It represents the selected project content, allowing the surrounding conversation to refer to a responsibility or passage without inferring that identity from a screenshot.

The response contains the project, revision, optional description identity, and optional passage. It does not contain arbitrary window contents or recursively include the selected description’s prose. Reading that prose remains the responsibility of show.

The request uses the selected worktree’s saved socket information and session token to contact an active desktop. A missing session, connection failure, or timeout is reported as an error. The command does not create a desktop session as a side effect of reading focus.

The returned selection supplies conversational context. It does not move the reader, record an investigation decision, edit the project, or confer acceptance authority.
