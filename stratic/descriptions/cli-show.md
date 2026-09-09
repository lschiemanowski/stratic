# show: Read a description

Show exposes one responsibility as an inspection unit: its explanation, metadata, and the relationships relevant to understanding it. It bridges the compact catalog returned by list and the individual source files returned by source.

The request identifies a description by stable identity within the selected project and revision. The identity is resolved after loading that project; a missing or ambiguous identity is an error. Renaming the Markdown file or title does not change which responsibility the request denotes.

The result combines the description body and metadata with its parent, outgoing connections, incoming cross-connections, associated tests, and relevant issues. Child descriptions appear as elaboration destinations. Connections include resolved ranges or reported passage problems, so consumers can distinguish an available relationship from a broken selector.

Destination bodies are not recursively expanded. This preserves the distinction between a responsibility’s own explanation and the further detail available through its links, avoiding an unbounded response on a large hierarchy. Show does not update the desktop selection or create an investigation decision.
