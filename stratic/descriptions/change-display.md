# Change highlighting

Change highlighting helps the reader notice what a proposal changes in the descriptions while moving through the hierarchy. It is a prose comparison, not a judgment that the highlighted behavior is implemented or reviewed. The selected passage and implementation status remain separate visual information.

A changed paragraph receives a green background. Even a one-word edit highlights the whole paragraph so its meaning can be read in context. Removed paragraphs can be expanded as removed text, and descriptions removed entirely are listed from the root. Turning the highlights off does not discard the proposal or change its review state.

Working files compare against a prepared proposal’s base when one exists, or HEAD for unprepared description edits. When the viewed content matches an accepted review, the comparison can show that accepted change against its own base. Switching descriptions retains the comparison and toggle choice, so highlights do not disappear just because the reader follows a link.

The comparator preserves matching paragraphs in order and classifies the remaining occurrences as added or removed. Repeated paragraphs are treated as occurrences, so deleting one repeated paragraph is not lost merely because identical wording remains elsewhere. The view highlights prose changes; a metadata-only link or status edit is not a word change in the paragraph.

For unusually fragmented descriptions, the comparison falls back to marking the whole text changed rather than allocating an unbounded paragraph-comparison table. This loses fine detail but keeps the reader responsive and still indicates that the text differs.

Summary bullets are compared separately against their earlier metadata at the same comparison base. Added or edited bullets are highlighted, and removed bullets can be expanded. Full-description changes and summary changes remain distinct: a prose edit does not mark an unchanged summary as edited.

Recognizing an accepted change uses the files retained in Git: excluding the review’s own newly added record must reproduce its recorded content hash. Comparison therefore survives a normal clone without relying on a temporary preparation tree, and unrelated later edits do not qualify as the accepted change.
