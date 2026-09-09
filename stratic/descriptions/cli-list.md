# list: Find descriptions

List exposes the project hierarchy as a compact set of identities and relationships. Its purpose is to make the available responsibilities discoverable without returning the complete prose of every description.

The command loads the selected project at the requested revision, defaulting to working content. Its JSON result contains the resolved project and revision, description identities, titles, parent identities, implementation status, and project issues. The hierarchy is represented by parent references in a flat collection.

The projection is built from the same loaded descriptions used elsewhere in Stratic. Readable drafts therefore remain present even when metadata is incomplete, and their issues accompany the result. List does not independently reconstruct or repair a hierarchy that the loader rejected.

Omitting description bodies keeps the response bounded by the catalog rather than the total prose. Detailed reading is handled by show. Reported issues are data in this response; the dedicated validation operation additionally represents invalid structure through its exit status.
