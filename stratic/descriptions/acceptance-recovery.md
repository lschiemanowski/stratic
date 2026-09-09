# Recovering or withdrawing acceptance

Acceptance can be interrupted after a commit has been recorded or the branch has moved but before the index and local handoff have been cleaned up. Recovery must distinguish that unfinished bookkeeping from an entirely new proposal, so retrying does not create a duplicate commit.

Before moving the branch, Stratic saves the commit identity, branch, and the selected index entries expected before and after reconciliation. When the recorded commit is already HEAD, resuming with the same review identity checks the branch and those entries, finishes index reconciliation, and clears readiness. If selected entries have changed since the interruption, it stops so those newer staged edits can be preserved.

Acceptance uses an index lock and records ownership information. A retry can remove a lock only when the recorded process is dead and the file still has the recorded identity. An unrelated or active lock is not treated as abandoned. This protects concurrent Git work while allowing a terminated Stratic process to recover.

Withdrawing an uncommitted proposal removes its ready record and, when still unchanged, its generated review. It keeps the project edits and independent check results so work can continue. If the recorded commit is already at HEAD, withdrawal requires finishing recovery through acceptance instead; it does not undo the commit.
