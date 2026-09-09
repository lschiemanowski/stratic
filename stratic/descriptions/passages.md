# Passage matching

A passage selector connects a description’s claim to particular text, either in another description or in source. It stores a nonempty exact quote and can include the text immediately before or after it when needed to distinguish repeated occurrences. The same matching rule is used for prose and implementation.

For example, if “return state” occurs twice in a file, the quote alone is ambiguous. Adding the preceding function context or following text can select the intended occurrence. The context must sit immediately next to the quote; it is not a search hint or a fuzzy similarity score.

Matching succeeds only when exactly one occurrence satisfies the quote and any context. No match is reported as stale, and multiple matches are reported as ambiguous. Inserting lines before an unchanged passage preserves the target, while editing a word inside the quote breaks the link until its meaning and selector are checked again.

The resolved range contains string offsets and line numbers so the reader can underline prose and highlight source. Offsets refer to the exact source string, including Markdown syntax and original line endings. The matcher does not normalize whitespace or decide that slightly different wording means the same thing.

Repository reads constrain where those targets can point: paths must stay inside the project, symbolic links are rejected, and oversized resources exceed the display limit. Historical links read regular files from the selected Git state. A link cannot escape those boundaries merely because its quote is valid.
