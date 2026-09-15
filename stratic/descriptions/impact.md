# Investigating impact

Impact analysis helps answer which responsibilities need examination after a proposed change. It combines the recorded structure with the agent’s decisions, rather than treating every touched file as a reason to reread the whole program. Its output gives a reason for each required description and identifies changed regions whose meaning is not covered by resolved links.

Changed descriptions, linked implementation passages, and associated tests seed the investigation. Both the before and after projects contribute. This matters when a link is removed: its former responsibility still needs examination, even though the new graph no longer points to the changed code.

A revised responsibility expands the investigation to its parent, the dependencies it relies on, and descriptions that depend on it. An unchanged decision stops expansion through that responsibility and must include a concrete reason. For a baseline without a review bound to its exact content, the initial investigation covers all descriptions before bounded change investigations can be trusted.

For example, adding a queue operation may revise its command description and the job lifecycle. The storage description can remain unchanged if its existing representation and atomic-write promise already support the operation. The recorded reason should explain that compatibility. If an assumption about storage changes, the investigation must continue there instead.

Changes outside resolved source or test ranges are reported as unmapped. The agent can improve the links or explain the inspected regions in the review. This includes shared setup and configuration that may matter even when no description points to them. The graph provides evidence about where to look; it cannot prove that undeclared effects do not exist.

A reviewed baseline is recognized from its retained files: removing the newly added review record must reconstruct the exact content hash recorded in that review. This keeps bounded impact available after a normal clone, even when the temporary pre-review tree was not transferred. A malformed record or a different reconstructed hash cannot establish a reviewed baseline.
