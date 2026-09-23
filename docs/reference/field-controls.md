# Field types and default values

Each record field has **Array** and **Nullable** checkboxes. Both are false
for new fields. Existing documents initialize the controls from their types,
including shorthand such as `Asset[]?` and expanded nullable union/array forms.
The inline type input displays the base type; use the checkboxes to add/remove
wrappers. A named type entered or wired to the field preserves the flags.
Advanced shorthand typed explicitly in the input still works.

Nullable applies to the field value (the array itself if Array is checked),
not to every element. Existing nullable array-item types are retained when
changing the outer Nullable flag. Multi-type unions and inline definitions are
preserved when wrapping/unwrapping them. For nested inline record fields,
the same checkboxes are available through their Properties dialog.

## Default-value controls

Right-click a field → **Properties… → Default value**. Choose **No default**,
**Set a value**, or **Null** when permitted. Then edit using:

| Field type | Default-value control |
| --- | --- |
| String | Plain text, including empty strings; no YAML quoting |
| Boolean | Checkbox |
| Integer / number | Numeric input with whole-number/range checks |
| Local enum | Dropdown of symbols, including inherited symbols |
| Array | Add/remove list items, each using its own type's control |
| Local record | Include controls and typed inputs for its fields |
| Mapping | Key/value rows with add/remove controls |
| Union | Choice of branch and a matching value editor |
| Any / unresolved external type | Choice of text, number, boolean, list, or object |

**Save default** commits one typed value. No default, null, empty text, false,
zero, and an empty list remain distinct. The host validates defaults against
supported local types before accepting them. Incompatible defaults after a type
change are preserved and reported in local checks rather than silently coerced.

The form supports finite nested values, including records/maps and inherited
local fields. Very deeply nested values can still use Advanced node editing.
Numeric integer inputs are restricted to JavaScript's safe integer range;
`int` also respects its signed 32-bit bounds. Imported types are not resolved,
so their generic form cannot enforce the external schema. Full Schema Salad
validation, including specialization semantics, remains separate.

For a worked procedure, see [set a field default](../how-to/set-defaults.md).
