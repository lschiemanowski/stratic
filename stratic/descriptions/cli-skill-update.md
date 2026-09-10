# skill update: Refresh unmodified project skills

Skill update explicitly refreshes the skills recorded as installed in the selected repository. It does not install unselected optional workflows. An unchanged older installed file can receive its bundled replacement; local edits or deletions stop the operation for manual inspection and merging. Other local files remain untouched.

Arguments are validated before the installer acts, and historical revisions are rejected. The JSON response lists written paths and resulting states. Without an installation record the command reports that installation is needed first. Updated skills and their bookkeeping remain ordinary working changes for review; this command does not stage or commit them.
