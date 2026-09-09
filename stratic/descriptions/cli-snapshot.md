# snapshot: Identify the content being checked

Snapshot gives proposed file contents a stable identity that check records can name. Its responsibility is content selection and capture, allowing evidence and review to refer to the same proposal even while the working repository continues to change.

The request can select whole repository-relative files, including deletions; otherwise the project file list is used. The response identifies the resulting tree, base, and selected paths. Generated and historical review files are excluded from the CLI’s selection of proposed edits because preparation handles the review record separately.

The tree starts from HEAD and overlays the selected working-file contents through a temporary Git index. Unselected files retain their base contents. Git objects are written, but the branch and the user’s staging area are not changed. This distinguishes a captured proposal from both a commit and the current staged state.

A snapshot does not isolate test execution. Excluded working edits may still influence tools run in that directory even though they are absent from the captured tree. Consequently, identifying a tree and establishing that a check examined that tree are separate responsibilities.
