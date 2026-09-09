# Following description passages

A passage link lets the reader move from a claim to the explanation or source that supports it. The words remain part of a readable paragraph; the underline indicates that further detail is available at that point.

The reader combines explicit metadata links with child descriptions anchored to the current prose. It resolves each anchor to a range in the description. When links overlap, the text is divided at their boundaries so clicking a segment offers the destinations that actually cover that segment, rather than every link in the paragraph.

If the selected segment has one valid connection, it opens directly. A description becomes the current page; source opens alongside the prose. If several connections apply, the side pane shows their destinations and any supplied reasons so the reader can choose. For example, one promise may have both a more detailed explanation and two implementing source passages; selecting that promise should not guess which destination the reader wants.

Connections without an anchored passage appear under Related responsibilities. A broken anchor remains inspectable with its problem rather than disappearing silently. A failure to open a target is shown as an error; following a link does not repair the metadata or edit the destination.

Text is rendered through text nodes, including linked segments. Link behavior comes from validated Stratic metadata, not from executing Markdown or HTML supplied by the repository.
