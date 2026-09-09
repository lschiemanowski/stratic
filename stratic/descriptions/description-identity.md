# Identity and hierarchy

A description has two roles: it explains one responsibility to a reader, and it has an identity that other parts of the project can refer to. Its title is a readable label. Its Markdown filename is a storage location. Neither is used as the permanent identity of the responsibility.

The Markdown file has paired JSON metadata containing a stable id and a parent relation. The parent names another description by identity and selects the meaningful passage that this child elaborates. The project has one root with no parent; every other description belongs beneath a parent, and parent chains must not cycle. Branches may have different depths because some responsibilities need more explanation than others.

For example, a description can be renamed from “Commands” to “Command-line interface” without changing its id. Existing incoming links still refer to the same responsibility. Moving it under a different parent instead changes the parent relation and its passage; it does not require inventing a new identity.

Identity makes links stable across ordinary editorial changes, but it does not make quoted text stable. Renaming a title can leave identities intact while editing an anchored paragraph requires the relevant passage links to be updated. Duplicate identities are reported as problems rather than resolved by choosing an arbitrary file.
