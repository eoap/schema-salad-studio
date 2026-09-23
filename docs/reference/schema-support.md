# Supported schemas and validation boundaries

The 0.1.0 coverage baseline is the upstream metaschema inspected on 2026-09-23:

- [metaschema.yml](https://github.com/common-workflow-language/schema_salad/blob/main/src/schema_salad/metaschema/metaschema.yml), blob `f696e0aed7d89d892fd460664ac619715d5c97fd`.
- [metaschema_base.yml](https://github.com/common-workflow-language/schema_salad/blob/main/src/schema_salad/metaschema/metaschema_base.yml), blob `3bdf639034d516344205796dcda0bc52ffa26c7c`.

Named root definitions: record, enum, map, union, documentation. Arrays are
inline types, not offered as named top-level definitions in this metaschema.
Supports list roots, `$graph` wrappers, single definitions, list and map-style
record fields, primitive types, nullable/array shorthand, structured types,
`extends`, `specialize`, `abstract`, `documentRoot`, `inVocab`, `default`,
`jsonldPredicate`, namespaces, and documentation. Unknown properties survive
normal edits and can be edited in the advanced inspector.

This first version provides **local structural checks**, not a complete Schema
Salad implementation. Checks cover required local names, duplicate names,
field/type structure, enum symbols, array items, maps, unions, and boolean
properties. Results appear in the editor and VS Code Problems. Invalid YAML
blocks graphical editing rather than being overwritten.

Imports/includes are preserved and shown but **not fetched or expanded**.
No full URI resolution, JSON-LD processing, inheritance/specialization
expansion, or full metaschema validation is performed. Default values receive
local type checks for the supported types described above.
Inherited fields are represented by inheritance edges rather than flattened
into cards. Unresolved external reference arrows are not drawn. Use the
reference `schema-salad` implementation in your existing validation workflow.
This editor never executes schema content or invokes an external interpreter.

## Rename coverage

Automatic rename updates recognized local references, including shorthand
suffixes, array items, map values, union alternatives, and extends.
Specialization map keys need an explicit YAML edit. References in other files,
fully resolved URI identities, and documentation links are outside automatic
rename coverage; use your usual Schema Salad validation to review changes.
