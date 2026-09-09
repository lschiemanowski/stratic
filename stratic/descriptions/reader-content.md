# Rendering repository content

The desktop displays files supplied by the project being read. Those files are content to inspect, not instructions for the Electron application to execute. A description containing HTML or an external URL should remain readable without gaining control of the reader.

The renderer creates text nodes for repository prose and implements links through Stratic’s own targets. It currently recognizes headings and paragraphs; other Markdown syntax is shown literally. Source rendering likewise preserves text while adding syntax token classes. This keeps repository strings from becoming executable HTML.

The Electron window disables Node integration, enables context isolation and sandboxing, and exposes a small preload API for reading project data, navigating, choosing a project, and copying an identity. The main process checks the sender of those calls, rejects external navigation and new windows, and denies permission requests.

The page markup and styles provide the description pane, source or destination pane, and bottom navigation menu. Their job is presentation; they do not define project semantics or grant authority to edit and accept changes. The app remains a reader even when an agent changes the files it is displaying.
