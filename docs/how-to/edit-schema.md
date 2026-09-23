# Edit a schema on the canvas

There is no right-hand properties panel. Everyday editing happens directly on
cards, with a context menu for creation and less common operations.

- **Add a type:** right-click the canvas, then **Add → Enum / Record / Mapping /
  Union / Documentation**. The new card appears at the clicked canvas position.
  Mapping is serialized as Schema Salad `type: map`. Shift+F10 opens the same
  menu from the focused canvas; arrow keys navigate it.
- **Rename inline:** click a type name or field name and edit it directly. Enter
  or clicking away commits the change; Escape cancels. No Apply button is needed.
  Known local type references update when a named type is renamed.
- **Enum values:** use the list inside the enum card. Type a new value and press
  Enter or click +. Edit existing values inline; × removes a value. Values are
  literal strings, so `null` and `true` do not need YAML quoting. Empty values
  and duplicates are rejected. New enums start with an empty list.
- **Add a field:** click **+ Add field** on a record, or right-click the record
  and choose **Add field**. The new field name is focused for immediate editing.
  A new field initially has `string` type; set its intended type by wiring it
  or editing the adjacent type control.
- **Wire a field:** drag its circular port to an existing type card. A live
  line follows the pointer and the target is highlighted. Releasing assigns the
  target's name as the field type and creates its reference arrow. Escape or
  releasing on empty canvas cancels. A port click followed by a target-card
  click is also supported. Wiring changes the base type (or the array item type),
  preserving the Array and Nullable checkboxes.
- **Type a reference:** type an existing type name next to a field; Enter or
  blur saves it and automatically draws its arrow. Changing the type to a
  primitive removes that reference arrow while preserving the checkboxes. Suggestions include primitive and
  local named types. `Asset[]`, `Asset?`, and `Asset | OtherType` are supported;
  pipe-separated alternatives serialize as a Schema Salad union list.
- **Mapping and union types:** their values/alternatives are editable on their
  cards. Structured inline types remain available through Properties → type
  or Advanced node YAML / JSON.
- **Move cards:** drag the header background or type-kind label. Name text
  remains selectable and editable. Zoom and Arrange are available above the
  canvas. Layout does not modify the schema.
- **Other properties:** right-click a card or field and choose **Properties…**,
  or use a card's ⋯ menu. This opens a dialog for documentation, inheritance,
  JSON-LD annotations, defaults, flags, and advanced node YAML. Default values
  use a type-aware form and its Save default button; other changed properties
  commit on blur and close the dialog. Document metadata is available
  from the explorer or canvas context menu.
- **Delete:** right-click a card or field and choose Delete, then confirm.
  Locally referenced types are protected. Undo restores deletions. To disconnect,
  change the field's type or delete the field.
- **YAML ↗ / Save / Undo / Redo:** use the normal VS Code text document. Source
  changes refresh the diagram and stale visual edits are rejected. Changes
  mark the document dirty; normal Save persists it to disk.

Plain names and enum values never require YAML. Less common structured
properties in the dialog use YAML value controls. Ordinary edits preserve
unrelated comments and extension properties; Advanced node replacement replaces
comments inside that node. Single definitions, list roots, and `$graph` roots
remain supported, including map-style record fields.

See [rename coverage and supported schema features](../reference/schema-support.md) before renaming types shared across files.
