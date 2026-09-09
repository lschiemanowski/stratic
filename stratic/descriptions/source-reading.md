# Source reading

The source reader helps a person check how a described promise is implemented. Following an implementation link opens the whole source file beside the prose, positioned around the quoted passage. The view is read-only, so exploring implementation does not accidentally edit the proposal.

Line numbers and a background on the linked lines show where the selected claim points. The rest of the file stays visible so callers, surrounding conditions, and neighboring operations can be read in context. A missing or ambiguous quote is reported as a link problem; a working edit does not silently move the selected target to a different occurrence.

Highlight.js supplies syntax colors for registered languages chosen by filename. Unknown languages and files over 200,000 characters use plain text, avoiding unreliable language guessing and expensive highlighting of large input. This is a coloring limit, separate from the repository’s larger file-read limit. Cached token spans are reused only when both the path and source text still match.

The renderer combines syntax colors with passage backgrounds without altering the source text. Tokens that span lines are split for display while original line endings and blank lines are preserved. Source strings that resemble HTML are inserted as text, not executable markup.

For example, a file with CRLF line endings and a comment spanning several lines must keep those characters and line positions even while syntax colors are applied. Colors aid reading; the quoted passage and repository revision identify what is actually being inspected.
