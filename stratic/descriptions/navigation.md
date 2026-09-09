# Navigation and refresh

Navigation lets the reader move through a large description hierarchy while seeing the local context of the active responsibility. The desktop keeps one current description, together with its project, revision, and optional selected passage. Selecting another description changes that focus rather than opening an accumulation of pages.

The bottom menu shows the selected description’s parent, siblings, and children. With the central list focused, up and down open adjacent siblings, right opens the first child, and left opens the parent. Clicking an entry or breadcrumb also opens it immediately. Folding the menu gives the description and source more space without changing the current selection.

This local view avoids requiring the whole project tree on screen. For example, a project can have hundreds of leaf descriptions while the menu shows only the siblings of the active leaf and its parent. Lists scroll within the panel, and the selected entry is kept visible as keyboard navigation moves through it. Broken parent chains are kept reachable at the top rather than trapping a draft in an unusable branch.

Opening a description checks its identity and optional passage before updating the desktop selection. Historical revision names are pinned to a commit, so moving a branch later does not silently change the history being read. A missing description is an error, not permission to show another responsibility.

Description switches reuse a loaded project instead of synchronously reading all files and Git state for each arrow press. A worker refreshes project content and check evidence in the background, with concurrent requests sharing pending work. External edits may therefore take a few seconds to appear; a refresh failure is reported rather than silently treated as a successful update.

The cache serves reading responsiveness. It does not authorize acceptance: the commit path checks the live repository and prepared content independently. An agent can navigate the user to a description through the same selection mechanism without gaining editing or commit authority.
