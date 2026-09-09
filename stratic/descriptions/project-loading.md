# Loading projects and readable drafts

Project loading turns the files in a Git repository into the descriptions, connections, tests, and problems that both the CLI and desktop display. It can read current working files or the content of a requested Git revision, so a historical description is interpreted together with that revision’s metadata and source.

The loader reads the project configuration, pairs Markdown descriptions with JSON metadata, and loads the test catalog. It then checks identities, parent chains, references, and quoted passages. Structural problems are accumulated alongside the project rather than treating the first malformed description as a reason to abandon all readable content.

For example, while an agent repairs a JSON file, the associated Markdown can remain visible under a temporary draft identity based on its path. Duplicate stable identities likewise become visible drafts with errors, rather than allowing an incoming link to select one at random. Metadata without its Markdown partner is reported too. If the prose file itself cannot be read, the loader reports that problem instead of manufacturing a description.

Connections resolve description identities and exact passage selectors against the loaded project. Missing targets and stale or ambiguous quotes become visible issues. The Problems view and validate expose these findings; a successful load does not imply that the descriptions accurately explain the code.

Loading uses repository-relative reads and a source cache tied to the loaded project object. A fresh project load can therefore see working edits without accidentally using source text cached for a different revision. Validation remains a mechanical check of the account, not a substitute for understanding it.
