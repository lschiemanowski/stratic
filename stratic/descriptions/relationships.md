# Implementation status and relationships

A description records intended behavior even when the implementation is unfinished. Its status tells the reader whether that intent is implemented, partial, or unimplemented. The remaining field can explain the work still needed. These fields describe the state of the responsibility; they do not say that a reviewer has approved a particular change.

An implementation link connects a claim in the prose to a quoted source passage. A dependency connects responsibilities when one relies on a promise supplied by another, and includes a reason explaining that promise. A reference supplies useful context without declaring that a change must propagate through it. Parent relations separately express which responsibility is being elaborated.

For example, a queue’s claim operation might rely on storage replacing the saved state atomically. A dependency should name that guarantee, so changing storage prompts examination of the caller’s assumptions. A related explanation of queue terminology may be a reference instead. The choice depends on what the first responsibility actually needs from the second.

Metadata validation checks the allowed status values, target shapes, and the presence of a dependency reason. It cannot decide whether the dependency is real, whether important ones are missing, or whether an “implemented” label is truthful. Those judgments belong to the investigation; extra links should earn their place by clarifying a concrete relationship.
