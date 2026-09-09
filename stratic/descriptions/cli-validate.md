# validate: Check structure and links

Validate exposes the structural consistency of the loaded Stratic project as a result suitable for both inspection and automated gating. It concerns the shape of the description graph and the resolution of its selectors, independently of whether the descriptions are semantically accurate.

The command loads the selected working or historical project and returns valid together with its issues. An issue-free project has a successful exit status. Discovered structural problems produce a nonzero status while preserving the complete diagnostic response.

The underlying checks cover configuration and metadata shape, identities, parent chains, description and source targets, and the passages associated with tests. The loader accumulates issues alongside readable drafts, so validation does not require every intermediate edit to form a complete valid project before any content can be inspected.

Validation does not execute tests or derive descriptive meaning from source. A quote can resolve to exactly one passage and still explain the wrong behavior. A passing structural result therefore remains distinct from the investigation and evidence required for a reviewed change.
