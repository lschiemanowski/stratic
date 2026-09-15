# Source reading

The source reader presents the implementation of a claim beside the description that makes it. Following an implementation link in either visible description makes that description active on the left and opens the whole source file on the right, positioned around the quoted passage. Source temporarily replaces the parent-and-child reading pair; closing it restores the active description with its parent. The file view remains read-only. Tests directly associated with the owning description appear below the implementation as compact rows; expanding one shows its code without replacing the implementation or moving the description.

Line numbers and a background on the linked lines show where the selected claim points. The rest of the file stays visible so callers, surrounding conditions, and neighboring operations can be read in context. A missing or ambiguous quote is reported as a link problem; a working edit does not silently move the selected target to a different occurrence.

Highlight.js supplies syntax colors for registered languages chosen by filename. Unknown languages and files over 200,000 characters use plain text, avoiding unreliable language guessing and expensive highlighting of large input. This is a coloring limit, separate from the repository’s larger file-read limit. Cached token spans are reused only when both the path and source text still match.

The renderer combines syntax colors with passage backgrounds without altering the source text. Tokens that span lines are split for display while original line endings and blank lines are preserved. Source strings that resemble HTML are inserted as text, not executable markup.

For example, a file with CRLF line endings and a comment spanning several lines must keep those characters and line positions even while syntax colors are applied. Colors aid reading; the quoted passage and repository revision identify what is actually being inspected.

An open source file can disappear, be renamed, or become unreadable while the user is reading it. Refresh then clears the old source text and passage background and displays the read failure in that pane. Description and problem updates continue, and restoring a readable file at the same path restores its content on a subsequent refresh.
