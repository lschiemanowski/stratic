# Agent skills

Agent skills guide the judgment and sequence of work around Stratic’s tools. The CLI can report a broken quote or pin file contents, but it cannot decide whether a description explains the program well or whether an undeclared dependency deserves investigation. The skill makes those responsibilities explicit for the coding agent.

The bundled skill guides investigation, description maintenance, evidence recording, preparation, and user-authorized acceptance. It uses the v3 executable explicitly so another installed Stratic version is not mistaken for this one.

Its central workflow keeps descriptions and code in agreement as a change develops. The agent reads existing intent, refines the affected account, implements the change, explains where effects stop, and records suitable checks. Descriptions should remain understandable without following their links; children add the explanation a reader needs before reaching code.

The skill is a reviewable file bundled with this checkout and is not automatically installed into an agent. The person or agent must make that guidance available in the working environment. Following the skill supports good investigation, but neither its presence nor a tool’s success proves semantic accuracy.
