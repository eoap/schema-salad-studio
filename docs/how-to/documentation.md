# Preview and build the documentation

From the repository root, create a Python environment and install the documentation dependencies:

```sh
python3 -m venv .venv-docs
. .venv-docs/bin/activate
python -m pip install -r requirements-docs.txt
python -m mkdocs serve -f mkdocs.yaml
```

Open the local URL printed by MkDocs. Changes to Markdown pages are reflected in the preview.

To check the site before submitting changes:

```sh
python -m mkdocs build --strict -f mkdocs.yaml
```

Generated files go into `site/`, which is ignored by Git. Configuration follows the [MkDocs configuration reference](https://www.mkdocs.org/user-guide/configuration/).

## Choose where to put a page

The documentation follows [Diátaxis](https://diataxis.fr/):

- **Tutorials** teach through a complete guided exercise.
- **How-to guides** describe steps to achieve a specific task.
- **Reference** records controls, supported behavior, and limits.
- **Explanation** describes design decisions and why the editor behaves as it does.

Add pages to the matching directory under `docs/` and to `nav` in `mkdocs.yaml`. Use relative Markdown links between pages. Store screenshots in `docs/assets/screenshots/` and provide descriptive alternative text.

## Deployment

The docs workflow checks pull requests and pushes to `main` or `develop` with a strict build. Successful pushes to `main` deploy to the `gh-pages` branch using [MkDocs deployment](https://www.mkdocs.org/user-guide/deploying-your-docs/). Configure GitHub Pages to serve that branch's root directory. Local builds do not publish the site.
