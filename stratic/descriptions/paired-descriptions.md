# Paired descriptions

The paired reading view makes a responsibility and its elaboration visible at the same time. The left pane supplies the immediate parent’s account; the right pane supplies the active child’s more detailed account. This is a view of one hierarchy relation, not a history of the last two pages visited.

Opening a child keeps its parent on the left and displays the child on the right. Selecting a sibling changes the active child while retaining the same parent. Going deeper promotes the active child to the left and opens its selected child on the right. Moving to a parent makes that parent active and displays it with its own parent, if it has one.

For example, opening Navigation from Desktop reader shows Desktop reader on the left and Navigation on the right. Opening Paired descriptions from Navigation then shows Navigation on the left and Paired descriptions on the right. The previous broader page is no longer part of the displayed pair, but remains reachable through the hierarchy.

The active description determines the bottom menu’s siblings and children, and is the identity reported to agents. Both descriptions are read at the same project revision. Direct navigation through a link, breadcrumb, menu entry, or agent request constructs the pair from the target’s actual parent rather than the page from which the request originated.

The two descriptions scroll independently. Changing siblings retains the visible parent’s reading position, so comparing their explanations does not repeatedly move the shared context. A description with no usable parent, including the root or a broken draft, is shown on its own. An empty detail pane contributes no placeholder content.

Following implementation temporarily shows the description containing the selected link on the left and its source on the right. That description becomes active; closing source restores it with its own parent. Choosing a different description leaves source view and constructs that description’s parent-and-child pair.

The pair adds reading context without adding a second independent selection to the project or CLI. Description identities, hierarchy links, source selectors, and acceptance authority remain unchanged.
