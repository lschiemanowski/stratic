# Formatted descriptions

Formatted descriptions let a program’s account contain structured prose, mathematical statements, and visual explanations. CommonMark headings, emphasis, lists, quotations, inline code and code blocks render as their usual elements. GitHub-style tables, strikethrough and task lists add compact structure; task checkboxes are read-only. The stored Markdown remains unchanged, including when read through the CLI.

The renderer parses Markdown with Remark into a syntax tree carrying original source positions. It creates only the supported elements, with repository text inserted as text. Explicit Stratic passage links retain their exact source ranges across formatting, escapes and character references. Inline code, equations and images are treated as whole objects when a passage selects part of their source. Changed blocks are highlighted against the existing comparison base. A formatted block can contain several source paragraphs; its highlight indicates an intersecting change, not that every displayed word changed.

Equations use KaTeX for inline $x^2 + y^2 = z^2$ and display mathematics. For example, the expression below is typeset from its LaTeX source rather than drawn by a bespoke equation renderer:

$$
\bar{x} = \frac{1}{n} \sum_{i=1}^{n} x_i
$$

Only mathematical rendering is enabled: commands that load resources or add trusted HTML are disabled, and macro expansion and dimensions are bounded. Invalid equations remain visible with their source and an error instead of breaking the description. Styles and fonts ship with the desktop, so rendering needs no network request.

Images use ordinary Markdown image syntax. A relative path is resolved from the description file’s directory; a path beginning with a slash is relative to the project root. PNG, JPEG, GIF, WebP and SVG images load from the displayed Git revision, or the working content snapshot used by the reader. Paths cannot leave the project, read Git internals or traverse symbolic links. Images share the existing two-megabyte resource limit. Missing, unsupported or blocked images show their alternate text and a compact explanation; remote URLs do not trigger downloads.

![Markdown source is parsed into structure and rendered as readable content.](../assets/description-rendering.svg)

Images are supplied as image data through the main process and displayed only as images, including SVG. Raw HTML stays literal. Ordinary Markdown links retain their labels and destinations for inspection but do not open external pages; Stratic’s metadata links remain the mechanism for navigating descriptions and implementation. This preserves the reader’s authority boundary while allowing richer project content.

Historical image requests identify the same resolved Git tree as the displayed description. The selected commit is resolved before checking that identity, and image bytes come from that tree rather than current working files. Requests left over from a different selected revision are rejected.
