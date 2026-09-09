# help: Find a command

Help describes the command vocabulary exposed by this executable: the available operations, their arguments, and the shared project-selection convention. It provides the reference needed to construct a request without reading the dispatcher implementation.

The help path is selected by an explicit help request, a help option, or an invocation with no command. It returns plain text before repository resolution. This makes the command reference available even when there is no Git repository or readable Stratic project.

The text is bundled with the executable and enumerates the implemented command surface. It does not inspect a project, report operational readiness, or change review state. Its plain-text response is the deliberate exception to the structured results of project operations.
