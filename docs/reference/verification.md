# Verification coverage

- Automated core tests cover comments and metadata preservation, record/map
  fields, nested references, rename, delete guards, creation, invalid YAML,
  null-type mistakes, and other edit boundaries.
- A Chromium webview harness exercises the actual UI and core edit model:
  context-menu creation, inline Enter/blur/Escape, enum-list CRUD, automatic
  reference arrows, actual mouse-drawn wires with preview and cancellation
  at two zoom levels, card dragging, deletion guards, search, and a mocked
  document undo/redo bridge.
- A separate host API test exercises version rejection, failed-edit handling,
  text edit range, save-time ordering (including clean files), invalid-YAML
  and unrelated-file handling, event refresh, and disposal with API test doubles.
- Serialization regression tests cover forward references, transitive types,
  inheritance, specialization, imports, namespaces, comments, aliases, recursive
  groups, block-style output, and stable repeated saves.
- The browser harness verifies selection, card positions, and subsequent field
  edits after dependency-ordered Save, checkbox toggles, wiring with modifiers,
  and scalar/enum/array/record/mapping default forms.

These harnesses do not launch an actual VS Code Extension Development Host.
A real-host installation smoke test remains necessary before release to users.
