# Stratic

Stratic helps a person and a coding agent understand and change a program without having to reconstruct its intent from source files. The project keeps descriptions of what the program should do, with links to the code that carries it out. When a change is proposed, the descriptions explain what will change and the review records why the surrounding behavior remains valid.

The project model gives these descriptions a common structure. Each description explains one responsibility, children add detail where needed, and links connect meaningful passages to implementation and tests. Reviewed changes preserve the connection between the intended behavior, the investigation, and the exact content being accepted.

The desktop reader is where a person explores that account of the program. They can read a description, move to a broader or more detailed explanation, inspect linked source alongside the prose, and see what a proposed change alters. The reader also shows recorded test outcomes and broken links while work is in progress.

The command-line interface lets agents, scripts, and people read the same project and prepare changes for acceptance. It exposes descriptions, source, link validation, impact analysis, and recorded checks, and can direct the desktop to a description being discussed.

Agent skills guide the work around those commands: investigate existing intent, update descriptions and code together, check the affected behavior, and prepare a change for the user to review. The agent supplies the judgment about accuracy that structural checks cannot provide.

Descriptions and code are ordinary files in the same Git repository. The desktop is a reader; edits happen through an agent or editor. Preparing a change does not commit it. Acceptance requires separate authorization and commits the reviewed content without pushing it. Publishing, deployment, and project management remain outside Stratic.
