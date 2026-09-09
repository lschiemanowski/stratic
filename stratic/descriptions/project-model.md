# Project model

A Stratic project contains an account of what a program is intended to do and how that intent is realized. Descriptions, implementation links, test associations, and reviews are stored as ordinary files in its Git repository, so they can change and be inspected together. The desktop and CLI read this same model.

Descriptions and links organize that account around responsibilities. A description should explain its subject without requiring the reader to follow its links. Children elaborate particular passages at whatever depth is useful; implementation links identify the source that realizes a claim. Descriptions can also state behavior that is only partly implemented, with the remaining work made explicit.

Reviewed changes keep that account accurate as the program evolves. The agent examines the descriptions and code affected by a proposal, records what changed and what remains valid, and supplies appropriate check results. Preparation binds this work to the selected file contents; acceptance then commits that exact proposal when the user authorizes it.

The model distinguishes three questions: what behavior is intended, what has been implemented, and what was checked for a particular change. A passing test does not answer all three. Stratic can check that the hierarchy is well formed and quoted passages still resolve, but whether the prose accurately explains the program requires investigation and judgment.
