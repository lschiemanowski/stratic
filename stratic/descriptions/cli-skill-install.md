# skill install: Make project skills available

Skill install exposes repository-local installation through the CLI. The selected Git repository receives the bundled core skill. The optional with argument accepts tdd and adds the test-first supplement alongside the core. Making that supplement available does not select it as the project’s workflow or rewrite project instructions.

The command validates its arguments before installing and rejects historical revisions. It returns JSON listing written skill paths and the resulting skill states. Existing different files are preserved; a conflict produces an error before the planned skill writes. Repeating an identical installation is harmless. The repository-local installer supplies the file comparison and path checks; the CLI neither stages nor commits the result.
