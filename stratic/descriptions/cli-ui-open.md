# ui open: Direct attention to a description

UI open exposes a controlled change to the desktop’s semantic focus. It lets an agent identify the responsibility or passage being discussed while leaving project content and review authority unchanged.

The request names a stable description identity, an optional revision, and an optional exact quote. Working content is the default revision. The response is the resulting selection rather than a screenshot or the destination’s complete prose.

The request travels through the worktree’s local session connection. Desktop navigation validates the selection, resolves the description and passage, and pins historical navigation to a commit. Invalid targets and unavailable sessions produce errors instead of selecting substitute content. An authenticated navigation request allows up to 30 seconds for a cold project or historical revision to load. Connection setup, unauthenticated input, and current-selection queries retain their three-second idle limits. Both endpoints use the longer limit only for navigation.

The only intended state change is the reader’s selection. This operation neither edits files nor prepares or accepts a review. Source-file retrieval is a separate operation, and source display follows the reader’s implementation links.
