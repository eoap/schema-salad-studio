# Install and open the editor

1. In VS Code 1.90 or later, run **Extensions: Install from VSIX…** and select
   `schema-salad-studio-0.1.0.vsix`.
2. Open a Schema Salad `.yml`, `.yaml`, or `.salad` file.
3. Run **Schema Salad: Open Visual Editor**, or **Reopen Editor With… → Schema Salad Studio**.
4. Alternatively, run **Schema Salad: New Schema**. Choose a filename; the
   visual editor opens with an empty canvas. New files contain the valid empty
   YAML sequence `[]`, with no sample types or fields.

The new-file dialog starts in the active file's directory, including a schema
open in the visual editor. With no active file, it starts in the first open
workspace folder. Remote workspace URI schemes are retained. With no file or
workspace folder open, VS Code chooses the dialog's normal default location.
Right-click the empty canvas → **Add** to create your first definition.
The populated example remains available separately in `examples/starter.salad.yml`.

The editor is opt-in: it does not take over all YAML files. The VSIX includes
its YAML parser. Users do not need Python, schema-salad, Node, npm, Graphviz,
PlantUML, or a network connection to use the installed editor.

Continue with [your first schema](../tutorials/first-schema.md).
