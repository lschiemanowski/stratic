# impact: Find what needs investigation

Impact exposes the investigation required by a proposed change according to the project’s recorded responsibilities and relationships. The CLI supplies the comparison inputs; the impact model determines the required descriptions and the reasons for including them.

The command constructs a tree from selected working files and compares it with a supplied base, defaulting to HEAD. An optional review input contributes previously recorded examined decisions. The response contains changed paths, whether the base has an exact review, the required descriptions with reasons and available decisions, and unmapped regions.

Analysis uses both the before and after projects, so removed links still contribute their former meaning. Revised responsibilities expand toward parents and explicit dependencies; unchanged decisions stop expansion through those responsibilities. Without a reviewed baseline, all descriptions require initial examination.

The operation does not author the decisions it consumes. Reasons for declaring a responsibility unchanged remain supplied judgments, and the graph cannot account for effects that were never recorded. The CLI returns those distinctions without turning the computed set into a claim that further investigation is impossible.
