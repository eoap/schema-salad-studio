# Schema Salad Studio

A VS Code visual editor for Schema Salad definitions. Edit type cards, connect references, and configure typed defaults while keeping YAML as the source of truth.

**0.1.0 is the first public release.** The editor works offline and provides local structural checks. Full Schema Salad validation remains separate.

## Get started

1. In VS Code 1.90 or later, run **Extensions: Install from VSIX…** and select `schema-salad-studio-0.1.0.vsix`.
2. Open a `.yml`, `.yaml`, or `.salad` file and run **Schema Salad: Open Visual Editor**.
3. To start from scratch, run **Schema Salad: New Schema**.

## Documentation

The [documentation source](docs/index.md) is organized using Diátaxis and built with MkDocs:

- [Tutorial: create your first schema](docs/tutorials/first-schema.md).
- [How-to guides: install](docs/how-to/install-and-open.md), [edit](docs/how-to/edit-schema.md), and [set defaults](docs/how-to/set-defaults.md).
- [Reference: supported schemas](docs/reference/schema-support.md) and [field controls](docs/reference/field-controls.md).
- [Explanation: the editor model](docs/explanation/editor-model.md) and [dependency ordering](docs/explanation/serialization.md).

For contributor setup, see [development and packaging](docs/how-to/develop.md). To preview or build the site, see [documentation maintenance](docs/how-to/documentation.md).

See [CHANGELOG.md](CHANGELOG.md) for release history and [LICENSE](LICENSE) for the Apache-2.0 license.
