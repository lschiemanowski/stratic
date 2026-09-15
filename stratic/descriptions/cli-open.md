# open: Launch the desktop

Open starts the desktop supplied with Stratic. An explicit directory, provided as the command argument or project option, is resolved as a Git repository before launch. Without either, the desktop starts at project selection. Invalid or conflicting arguments are rejected before starting a process. This operation opens a reader; it does not create descriptions or accept a change.

The launcher resolves the built desktop and Electron runtime from its own installation, independently of the caller’s working directory. The package includes JavaScript, styling, fonts, the logo, and skills; installation obtains Electron through its runtime dependency. A missing build or unavailable Electron runtime produces an actionable error instead of trying to compile or download during launch.

The desktop remains attached to the invoking terminal. Its output is inherited, its exit status is returned, and interrupt or termination signals are forwarded so stopping the command also stops the desktop. The launcher clears Electron’s Node-only environment mode before spawning the application.
