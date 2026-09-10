# Rendering repository content

The desktop displays files supplied by the project being read. Those files are content to inspect, not instructions for the Electron application to execute. A description containing HTML or an external URL should remain readable without gaining control of the reader.

Descriptions render Markdown structure, inline and display equations, and images stored in the project. The reader keeps the original Markdown as the authority for passage selectors and comparison, while formatting makes the account easier to read. Raw HTML stays literal, ordinary web links do not navigate the app, and project content cannot create executable elements. Source rendering likewise preserves text while adding syntax token classes.

The Electron window disables Node integration, enables context isolation and sandboxing, and exposes a small preload API for reading project data, navigating, choosing a project, and copying an identity. The main process checks the sender of those calls, rejects external navigation and new windows, and denies permission requests.

The page markup and styles provide the reading panes, title-bar navigation, collapsible project panel, and bottom description menu. Native window controls remain available, the title bar can drag the window, and interactive controls are excluded from its draggable region. Their job is presentation; they do not define project semantics or grant authority to edit and accept changes. The app remains a reader even when an agent changes the files it is displaying.
