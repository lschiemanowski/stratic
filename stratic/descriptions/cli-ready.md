# ready: Inspect the prepared proposal

Ready exposes the worktree’s saved prepared proposal. Its responsibility is to make the handoff identity and pinned content inspectable, including when work resumes after an interruption.

The response is the locally stored prepared record or null when no record exists. A record identifies the review, base, selected tree, final tree, paths, and generated review file. An interrupted acceptance can leave additional commit and index information needed for recovery.

This is a read of saved state, not a fresh validation of the worktree. Later edits can make the proposal stale while its ready record remains present. Live comparison with the base and proposed files belongs to acceptance, so the presence of a ready record alone does not establish that committing would succeed.
