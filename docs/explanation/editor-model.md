# How the visual editor relates to YAML

Schema Salad Studio 0.1.0 is a standalone VS Code custom editor for Schema Salad definitions. The YAML document is the source of truth; visual edits update the normal VS Code text document. It is not a CWL workflow editor.

The editor is opt-in, so opening an ordinary YAML file does not replace its text editor. The installed VSIX includes its parser and works offline without external interpreters or diagramming tools.

Everyday edits happen directly on cards. Properties dialogs expose less common structured values. Ordinary edits preserve unrelated comments and extension properties, while replacing a node through Advanced node YAML / JSON replaces comments inside that node. Layout changes do not modify the schema.

Source edits refresh the diagram. Stale visual edits are rejected, and invalid YAML blocks graphical editing rather than being overwritten. Save, Undo, and Redo operate on the normal document. Saving also performs [dependency ordering](serialization.md).

Local checks help catch structural mistakes while editing. They do not resolve imports or replace full Schema Salad validation. See the [supported schema features and boundaries](../reference/schema-support.md) for the exact scope.

## Design references

- [Hackolade JSON Schema Editor](https://hackolade.com/help/JSONSchemaEditor.html) — layout inspiration; no Hackolade artwork or code is bundled.
- [VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors).
