# Acceptance and recovery

Acceptance finishes an already investigated and prepared change after the user authorizes its review identity. It checks the live repository against the pinned proposal and creates the commit. This is why the final step can be short: the descriptions, implementation, and check evidence have already been examined.

Acceptance requires the exact prepared review identity and a checked-out branch. It verifies the base and proposed content, rejects unfinished Git operations, and checks structural validity again. It does not rerun the project’s tests or authorize a push.

Commit hooks inspect the prepared index and may amend the commit message. Hook failure or a content change stops acceptance before the branch moves. The commit uses the pinned tree, and only its affected index entries are reconciled; unrelated staged and working edits remain intact.

A recorded commit and index state allow acceptance to resume after interruption without creating another commit. Recovery checks the branch and detects newer staging in the selected files. Only a lock known to belong to a dead accepting process is removed automatically.

Withdrawing readiness retains project edits and recorded checks. It removes an unchanged generated review that has not been committed. If the recorded commit is already HEAD, acceptance must finish recovery instead.

A rejected acceptance is a request to resolve a concrete mismatch, not permission to bypass it. For example, if a description was edited after preparation, that proposal needs fresh preparation before it can be committed. If the process was merely interrupted after the commit, resuming the same identity can complete the remaining bookkeeping.
