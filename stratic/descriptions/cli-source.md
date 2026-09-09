# source: Inspect implementation

Source exposes the exact file text behind an implementation connection. Its responsibility is to retrieve the selected repository content without interpreting the programming language or substituting a summary for the source.

The request supplies a repository-relative path and an optional historical revision. The response contains that path, the requested revision, and the complete decoded file text. Passage selection and syntax coloring are separate concerns; this command neither crops the file to a quote nor decorates its text.

Repository reads enforce path boundaries, reject symbolic links and files beyond the display limit, and select regular files for historical content. Working and historical reads share those restrictions. Missing or unsupported resources produce errors rather than successful empty content.

The description’s connection and the requested revision determine how the file relates to a claim. Retrieving it establishes availability, not that the code fulfills the claim. The command has no project-editing or review-state effect.
