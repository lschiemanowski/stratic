# accept: Commit the reviewed proposal

Accept exposes the final authorized transition from a prepared proposal to a Git commit. The required review identity binds the request to one saved proposal, rather than treating the command as permission to commit arbitrary current edits.

The request must provide the identity of the prepared review. A missing or different identity is rejected. A successful result contains the commit identity, whether recovery was performed, and the acceptance duration; the operation requires the branch and repository state supported by the acceptance model.

The model verifies the base and proposed content against the pinned handoff, checks structural validity, and commits the selected tree while honoring hooks and preserving unrelated staged and working edits. Saved commit and index state permit a retry to finish an interrupted acceptance without creating a duplicate commit.

The CLI rejects unexpected arguments before acceptance acts. Completed evidence is reused rather than rerunning tests or investigation. Content drift, hook failure, or a conflicting recovery state prevents normal completion and remains visible as an error. Acceptance has no push operation.
