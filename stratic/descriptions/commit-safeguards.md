# Committing only the reviewed content

Accepting a proposal must not turn into a general commit of whatever happens to be staged. The user authorizes one review identity, and Stratic must preserve the selected tree while allowing unrelated work to remain in the same repository.

Before committing, acceptance checks that HEAD is still the recorded base and that the proposed files, including the generated review, still produce the pinned final tree. It requires a checked-out branch, rejects unfinished merge or rebase operations, and checks structural validity again. The completed tests and semantic investigation are reused; they are not rerun at this point.

Commit hooks run against an index containing the prepared tree. They may inspect the proposal and amend its commit message. A failing pre-commit or message hook stops acceptance, and a hook that changes project content or the prepared tree also stops it before the branch advances. The live proposal and branch are checked again after the hooks.

The commit is created from the pinned tree with the recorded base as its parent. Updating the branch requires that it still points to that base. This prevents a concurrent branch update from being silently overwritten. A post-commit hook failure is reported as a warning after the commit has already been created.

Before creating the commit, acceptance constructs a reconciled copy of the user’s index. It removes and installs only exact paths changed between the recorded base and the accepted tree; selecting a parent does not authorize removing other staged descendants. For example, replacing a file with a directory can accept resource/included while preserving a separately staged resource/extra even if its working copy has been deleted. If an unrelated staged ancestor or descendant cannot coexist with an accepted replacement, acceptance rejects the conflict before creating any commit or changing the real index. After the branch update, the reconciled copy becomes the user’s index. Working files remain intact. File selection is whole-file; selected files cannot carry a second, unreviewed version into acceptance.
