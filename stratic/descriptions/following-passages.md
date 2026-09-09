# Following description passages

A passage link lets the reader move from a claim to the explanation or source that supports it. The words remain part of a readable paragraph; the underline indicates that further detail is available at that point.

The reader combines explicit metadata links with child descriptions anchored to the current prose. It resolves each anchor to a range in the description. When links overlap, the text is divided at their boundaries so clicking a segment offers the destinations that actually cover that segment, rather than every link in the paragraph.

If a selected segment has one valid connection, it opens directly. A child description becomes active on the right with its parent on the left. A link to another responsibility displays that destination with its own parent, preserving the meaning of the pair even when the link crosses the hierarchy. Multiple connections are offered as a choice beside the description containing the selected passage; choosing a destination then applies the same navigation rules.

Passages in either visible description can be followed. Selecting another child of the visible parent replaces the right-hand description; following a child of the active description moves that description left and opens the next level on the right. Connections without an anchored passage remain available under Related responsibilities. A broken anchor stays inspectable with its problem, and a failed target does not silently substitute another responsibility.

Text is rendered through text nodes, including linked segments. Link behavior comes from validated Stratic metadata, not from executing Markdown or HTML supplied by the repository.
