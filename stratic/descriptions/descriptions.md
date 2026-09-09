# Descriptions and links

A description explains one responsibility of the program: what it does, the conditions it relies on, and the behavior it promises. It should make sense when opened on its own. A child adds a more detailed account of a meaningful passage in its parent, so readers can stop at the level of detail they need. There are no fixed levels that every branch must fill.

A project stores descriptions as Markdown with JSON metadata under stratic. A stable identity connects each description to its parent and incoming links, independently of its title or filename. The parent relationship identifies the passage being elaborated; it does not require the prose to be a list of its children.

Passage links connect particular claims to explanations, implementation, and tests. They store an exact quote, with surrounding text when needed to distinguish repeated occurrences. A source link therefore identifies the code that supports the claim, rather than only naming a file. A missing or ambiguous match is reported instead of silently pointing somewhere else.

Implementation status distinguishes implemented, partial, and unimplemented intent. A partial description records what remains to do, so intended behavior is not mistaken for existing behavior. Cross-connections have a specific purpose: a dependency states a promise relied on from another responsibility; a reference provides context without making changes propagate through it.

The reader and CLI can load the project from working files or a Git revision, including its test catalog and visible problems. Broken metadata does not cause the Markdown description to disappear: it remains readable as a draft while links and hierarchy are repaired.

Validation checks the hierarchy, metadata, and passage matches. These checks establish that the connections resolve; they cannot establish that a source passage implements the promise made by the prose. Keeping that meaning accurate is part of investigating and reviewing a change.
