# discard: Withdraw a prepared proposal

Discard exposes withdrawal of a proposal’s readiness while retaining the work from which that proposal was built. It changes the local handoff state, not the intended program change or the Git history.

The request must identify the current prepared review. An absent or different identity is rejected, preventing withdrawal of an unrelated handoff. The response identifies the discarded review and whether its generated review file was removed.

The model retains project edits and independent check results. It removes an unchanged generated review when eligible and clears the ready record. If the recorded commit is already HEAD, recovery through acceptance is required instead of treating the commit as an uncommitted proposal.

Withdrawal does not restore source files to their base versions or erase the evidence accumulated during investigation. A later preparation can form a new handoff from the retained or further revised work.
