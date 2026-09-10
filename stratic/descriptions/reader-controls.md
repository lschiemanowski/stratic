# Reader controls and project selection

The reader keeps attention on the program being described. Each reading pane begins with its title and prose. Expected states, such as implemented behavior and a clean working tree, do not occupy separate labels. Partial or unimplemented behavior remains explicit, including any stated work still missing. Problems and a prepared review are surfaced because they change what the reader needs to know.

The title bar combines the window controls with the current description’s ancestry. Ancestors open broader descriptions, and the current title returns from supporting views to the active description. Separate compact buttons reveal the project panel, fold the bottom description menu, and open viewing options. The unused title-bar area moves the window; buttons and menus remain interactive.

The View menu contains revision selection, change highlighting, tests, and the active description’s identity and copy action. Historical content is identified in the title bar when selected. These controls remain accessible without repeating metadata above each description. Escape closes the View menu and returns focus to its button.

Project selection lives in a collapsible panel on the left. It lists recently opened project folders and offers a native folder picker for another project. The current folder is selected, and full paths distinguish projects with the same name. Opening a project resets reading to its working root description. An invalid choice leaves the current project available and reports the problem.

Recent folders are stored in the application’s local user data, outside the projects. Only previously opened folders can be selected through the recent-project action; a new folder goes through the native picker. The list is bounded to twelve entries. It remembers locations, not saved reading views, and gives the desktop no editing or acceptance authority.
