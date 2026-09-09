# prepare: Make a reviewed proposal ready

Prepare exposes the transition from investigated edits to a pinned proposal. Its responsibility at the CLI boundary is to require an explicit file selection and review input before invoking the model’s preparation rules.

The request supplies a review file and either selected paths or explicit selection of the entire eligible change. The review contains examined decisions with reasons, a summary and reviewer, unresolved blockers, result identities, and explanations of unmapped regions. Missing selection and unexpected command arguments are rejected before preparation proceeds.

The preparation model validates the selected project, accounts for the required investigation, and selects matching passing evidence. It writes a review into the proposed content and a local ready record containing the base, content tree, final tree, paths, and identity. The CLI returns that record together with the preparation duration.

The resulting proposal is concrete but uncommitted. Replacing a pending proposal retains its identity while still requiring an unchanged generated review and appropriate evidence for its new content. The command neither runs the checks nor supplies the user’s authorization to accept.
