# skill status: Inspect project skills

Skill status reports how the repository’s local Stratic skills compare with this executable’s bundled guidance. Each JSON entry names a bundled skill, its repository-relative path, and whether it is current, outdated, locally modified, missing, not installed, or present without an installation record.

The command reads working files and installation bookkeeping without creating either. It rejects unexpected arguments and historical revisions. A missing installation is a normal status; an invalid record or redirected installation path is an error. Status reports content differences, not whether an agent has loaded or followed a skill.
