# Why saving reorders definitions

Saving a schema orders local definitions so dependencies precede their users.
For example, an enum is written before a record whose field uses that enum.
This applies to list roots and `$graph` roots. The single-definition form is
unchanged.

The visual editor's Save button and Ctrl+S explicitly normalize even a clean
file. VS Code's normal save/autosave also orders a changed document after it
has been opened in Schema Salad Studio during the current session. Unrelated
YAML files are not affected. In-memory editing order stays unchanged until Save.

Ordering covers field types, nullable/array shorthand, nested array/map/record
and union types, mapping values, named union alternatives, `extends`, and both
sides of `specialize` in list or map form. Exact local identifiers, fragment
references, and references expanded using document `$base`/`$namespaces` are
matched; unknown external identifiers are not guessed from their basenames.

Imports retain their relative order and are emitted before local type
declarations. They are not fetched or expanded. Defaults, documentation strings,
and extension-property values are not mistaken for type references.

The serializer performs a stable topological sort, using original position to
break ties between ready definitions. YAML nodes are moved intact, preserving
comments, anchors, aliases, and custom metadata; anchor dependencies are also
respected. Edits and saves emit block-style YAML, including when opening JSON
or flow-style YAML. Empty collections use the YAML forms `[]` and `{}`.
New files default to `schema.salad.yaml`; `.yml` files remain supported.
Repeated saves are idempotent. The diagram retains its card positions and
selection when YAML definitions move.

Mutually recursive definitions cannot all precede one another. Their relative
order is preserved inside a dependency group, external dependencies come first,
and a warning is shown in local checks/Problems. A self-referential record does
not require reordering. Ordering is not a substitute for full Schema Salad
validation or import resolution. Invalid YAML remains saveable without rewriting.
