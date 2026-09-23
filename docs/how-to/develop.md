# Develop and package the extension

```sh
npm ci
npm test
npx playwright install chromium
npm run test:ui
npm run package
```

Open this folder in VS Code and press F5 to launch an Extension Development Host.
Open `examples/starter.salad.yml` in the host. JavaScript is used directly; there
is no build-time transpiler. `npm ci --omit=dev` is sufficient for core tests and
packaging. Python 3 is used only by the deterministic VSIX packaging script,
not by the installed extension. Dependencies and their MIT licenses are bundled.
Install dependencies before running the core tests or packaging a source checkout.

`npm run package` produces `dist/schema-salad-studio-0.1.0.vsix`, a ZIP-based
VSIX with manifest, content types, source, UI assets, example, and runtime
parser. No Marketplace publishing is performed. To publish, choose your own
registered publisher identity and package with the official `@vscode/vsce`.

See [verification coverage](../reference/verification.md) for what the automated checks exercise.
