# check list: Retrieve recorded results

Check list exposes the independent evidence records stored for the selected worktree. It provides the result identities and observations from which a later review can select evidence, including unsuccessful checks that remain relevant to understanding the work.

The operation returns the local records as a JSON array, retaining their tree identities, methods, evidence, timestamps, overall outcomes, and individual results. With no saved records, the result is an empty array.

Retrieval does not execute checks, discard failed outcomes, or label every record as applicable to the current files. Each record continues to describe its own tree. Preparation separately enforces content equality for selected evidence.

Committed reviews contain copies of the evidence they used. This operation reads the independent local record store rather than traversing historical reviews, preserving the distinction between newly accumulated evidence and the durable account of an accepted change.
