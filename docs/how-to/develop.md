# Develop and package the extension

```sh
npm ci
npm run check
npx playwright install chromium
npm run test:ui
npm run package
```

Open this folder in VS Code and press F5 to launch an Extension Development Host.
Open `examples/starter.salad.yml` in the host. JavaScript is used directly; there
is no build-time transpiler. `npm ci --omit=dev` is sufficient for core tests and
packaging. Python 3 is used only by the deterministic VSIX packaging script,
not by the installed extension. The runtime dependency and its license are bundled.
Install dependencies before running the core tests or packaging a source checkout.

`npm run package` produces `dist/schema-salad-studio-0.1.0.vsix`, a ZIP-based
VSIX with manifest, content types, source, UI assets, example, and runtime
parser. No Marketplace publishing is performed. To publish, choose your own
registered publisher identity and package with the official `@vscode/vsce`.

See [verification coverage](../reference/verification.md) for what the automated checks exercise.

## Package to a custom path

```sh
npm run package -- --out dist/custom-name.vsix
```

The extension runs directly from JavaScript; no TypeScript compilation is needed. `npm run check` checks JavaScript syntax and runs the core and host tests. Browser tests run separately with `npm run test:ui`. Python 3 is still required for the VSIX packaging helper.

## Release on GitHub

1. Set `package.json` and `package-lock.json` to the release version and update the changelog.
2. Commit the release changes and complete an installation smoke test in a real VS Code host.
3. Create and push a matching stable tag, such as `v0.1.0` for version `0.1.0`.

The release workflow verifies the tag, installs locked dependencies with `npm ci`, runs syntax, core, host, and Chromium UI checks, and packages the extension. It creates a GitHub Release with generated notes and attaches `schema-salad-studio-0.1.0.vsix` for that version. Rerunning the workflow replaces the asset on the existing release.

CI runs the same checks and packaging on branches and pull requests, uploading the VSIX as an [Actions artifact](https://github.com/actions/upload-artifact). GitHub release uploads use the built-in `GITHUB_TOKEN`; Azure credentials and a Marketplace environment are not required. Marketplace publishing is a separate process.
