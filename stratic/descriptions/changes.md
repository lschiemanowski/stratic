# Reviewed changes

A reviewed change combines selected project edits with an explanation of why the descriptions and implementation still agree. The agent records which responsibilities it examined, what was revised, and why other behavior remains valid. This is separate from implementation status: a description can intentionally include unfinished behavior, while a review concerns one particular proposal.

Impact analysis gives the investigation a starting point by finding changed descriptions, linked code, and connected tests. The agent then follows effects through parents and explicit dependencies, recording a reason wherever a surrounding responsibility remains unchanged. These decisions explain why investigation can stop; the graph does not rule out effects the agent discovers elsewhere.

Checks use the project’s existing tools. Their recorded results identify the exact content tested, the method, environment, and evidence. Appropriate manual checks can be recorded too. Results may exist before a review; preparation selects passing evidence for the proposal, rather than treating an earlier pass as proof about changed content.

When the work is ready, preparation checks that affected responsibilities have been accounted for, links resolve, and the selected evidence matches the proposed content. It writes a review and pins the final snapshot, including that review. The user can then inspect one concrete proposal before deciding to commit it.

Acceptance is the final authorized commit step. It verifies that the prepared proposal and its base have not changed, reuses the completed checks, and commits only that content. It does not repeat the investigation or run tests again. If the proposal changes, it must be prepared again; acceptance does not authorize a push.

Preparing a proposal uses temporary Git indexes, so the user’s staging area is not repurposed for review. Selection is currently by whole file, and initial adoption requires an existing Git commit. Unrelated staged and working edits can remain outside the accepted proposal.

Pending reviews and recorded checks are local to the Git worktree until preparation writes the review into the project. Updating these local records replaces each JSON file as a unit. An interrupted acceptance can be resumed, and withdrawing an uncommitted proposal keeps the project edits and recorded checks.
