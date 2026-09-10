# Desktop reader

The desktop reader lets a person explore a Stratic project and inspect a proposed change. Its reading area shows a parent description on the left and the active child on the right, so the broader promise and its elaboration can be understood together. Source can take the right-hand pane while the description it implements remains on the left. A foldable menu at the bottom keeps nearby responsibilities within reach.

The bottom menu shows the active description alongside its parent, siblings, and children, so the reader can move between the overall intent and the details without displaying the entire project tree. Selecting an entry opens it immediately. Arrow keys navigate throughout the reader, even with the bottom menu folded: up and down move between siblings, left opens the parent, and right opens the first child. The title bar locates the active description in its ancestry; folding the menu leaves more room to read.

Underlined passages connect the explanation to more detail. Opening a child makes it active on the right while retaining its parent on the left. A single destination opens directly; overlapping destinations are offered as a choice before navigation. Following an implementation link places the description containing that link beside the selected source.

Linked source is read-only and opens at the passage that implements the selected claim. Line numbers, syntax colors, and a background on the linked lines help the reader relate the explanation to the actual code. Closing source returns to the active description and its parent. The surrounding source stays visible while open, so a link can be understood in context.

Descriptions can be read as short bullet summaries when a full account would interrupt orientation. A list-style button in the upper-right corner of each pane switches that pane between its summary and full description. Each pane retains its own choice as the reader navigates. A description without a summary continues to show its full text, without a redundant button. The complete account and its passage links remain available by switching back.

The tree overview shows the project’s hierarchy as a spatial diagram, with the root above a horizontal row of main branches and deeper descriptions stacked vertically within each branch. It exposes the overall shape beyond the local navigation menu. Individual folds and a global depth slider control the amount of detail shown. The active description is highlighted, and selecting a node returns to paired reading. Pan and zoom make larger trees explorable.

Change highlighting shows how the descriptions differ from the proposal’s starting point. A changed paragraph is highlighted as a whole, and removed text can be expanded. The highlights stay available as the reader moves between descriptions and can be toggled off. The revision selector lets the reader inspect earlier committed descriptions and their source.

Tests accompany the descriptions they check and appear alongside implementation when source is open. Each has a short expandable description, linked test code, and a small result indicator that distinguishes current outcomes from earlier evidence. Reading a test does not run it. Problems lists malformed metadata and broken links; draft descriptions remain readable during repairs.

The title bar carries the current location and compact controls for navigation, project selection, and viewing options. A collapsible left panel lists recently opened projects and opens another folder. Reading panes start with their titles and prose; normal implementation and committed states are not announced. Unfinished behavior and actual problems remain visible, while revision, highlighting, tests, and identity controls are available in the View menu.

The reader does not edit project files or accept changes. Edits made by an agent or editor appear through background refresh, which may take a few seconds. A description marked partial shows what remains to implement, separately from the highlighting of a proposed change.

Descriptions support Markdown formatting, LaTeX equations, and project images while retaining passage links and change highlighting. Repository content cannot execute HTML or navigate away from the app. A restricted connection to the main process supplies project data, images, and navigation; permission requests are denied.
