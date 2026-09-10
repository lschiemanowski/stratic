# Agent skills

Agent skills guide the judgment and sequence of work around Stratic’s tools. The CLI can report a broken quote or pin file contents, but it cannot decide whether a description explains the program well or whether an undeclared dependency deserves investigation. The skill makes those responsibilities explicit for the coding agent.

The bundled skill guides investigation, description maintenance, evidence recording, preparation, and user-authorized acceptance. It uses the v3 executable explicitly so another installed Stratic version is not mistaken for this one.

Its central workflow keeps descriptions and code in agreement as a change develops. The agent reads existing intent, refines the affected account, implements the change, explains where effects stop, and records suitable checks. Descriptions should remain understandable without following their links; children add the explanation a reader needs before reaching code.

Skills are ordinary reviewable files installed in the managed repository, so its working conventions can travel with its descriptions and code. The core skill supplies the shared responsibilities; optional workflow skills add an approach such as test-first development. Making a workflow available does not make it mandatory. The user can select it for one task, or the project can name a default in its ordinary agent instructions. A task-specific choice takes precedence over that default.

Installation copies the core skill and any selected optional workflow into the repository’s skill directory. Explicit updates replace only installed files that have not been locally edited. Local additions and project instructions are preserved; conflicts are reported for inspection and manual merging. Following a skill supports good investigation, but neither its presence nor a tool’s success proves semantic accuracy.
