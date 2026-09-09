# Desktop reader

The desktop reader lets a person explore a Stratic project and inspect a proposed change. The main pane shows one description of the program; a pane beside it shows linked source or a choice of related destinations. A foldable menu at the bottom keeps nearby descriptions within reach. Open project selects a Git repository containing Stratic descriptions.

The bottom menu shows the active description alongside its parent, siblings, and children, so the reader can move between the overall intent and the details without displaying the entire project tree. Selecting an entry opens it immediately. With the central list focused, up and down move between siblings, left opens the parent, and right opens the first child. Breadcrumbs return to broader descriptions; folding the menu leaves more room to read.

Underlined passages connect the explanation to more detail. A passage with one destination opens it directly: a linked description replaces the current description, while linked source appears beside it. When a passage has several destinations, the side pane lets the reader choose which one to follow.

Linked source is read-only and opens at the passage that implements the selected claim. Line numbers, syntax colors, and a background on the linked lines help the reader relate the explanation to the actual code. The surrounding source stays visible, so a link can be understood in context.

Change highlighting shows how the descriptions differ from the proposal’s starting point. A changed paragraph is highlighted as a whole, and removed text can be expanded. The highlights stay available as the reader moves between descriptions and can be toggled off. The revision selector lets the reader inspect earlier committed descriptions and their source.

The Tests view shows the project’s registered checks, their recorded outcomes, and whether those results apply to the content being viewed. It can open a test’s code or the behavior it checks; it does not run the test. Problems lists malformed metadata and broken links. Draft descriptions remain readable while those problems are being repaired.

The reader does not edit project files or accept changes. Edits made by an agent or editor appear through background refresh, which may take a few seconds. A description marked partial shows what remains to implement, separately from the highlighting of a proposed change.

Repository text is treated as content: HTML and external links in descriptions do not execute or navigate away from the app. The reader currently displays headings and paragraphs; other Markdown syntax stays literal. A restricted connection to the main process supplies project data and navigation, and permission requests are denied.
