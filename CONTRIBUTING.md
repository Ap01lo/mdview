# Contributing to mdview

Thanks for being here! mdview is intentionally small, so please keep your
changes focused.

## Quick checklist

- [ ] Run `node bin/mdview.js` and click around to make sure nothing regressed.
- [ ] For any new theme, drop a `themes/<name>.json` file (see existing ones).
- [ ] For any new feature, update `README.md` and `CHANGELOG.md`.
- [ ] Don't add heavy dependencies â€?mdview ships almost nothing.

## Reporting bugs

Open an issue with:

1. mdview version (`mdview --version`).
2. OS + browser.
3. Steps to reproduce.
4. Expected vs actual.

## Pull requests

1. Fork and create a topic branch.
2. Make focused commits.
3. Run a smoke test: open a few folders, switch themes, edit a font.
4. Open a PR with a clear description.

## Adding a theme

Drop a JSON file in `themes/`:

```json
{
  "name": "My Theme",
  "description": "Brief description shown in the selector",
  "vars": {
    "--bg": "#ffffff",
    "--fg": "#1f2328",
    "--accent": "#0969da",
    "--content-max": "720px"
  }
}
```

The full list of recognised variables is in `public/style.css` (search for
`--`). A theme must include at least `--bg` and `--fg`; everything else has a
sensible default.

## Style

- Two-space indent in JavaScript.
- No build step â€?keep `public/app.js` as a single IIFE-style file.
- Avoid adding frameworks unless absolutely necessary.

## Releases

Maintainers cut releases manually. Bump the version in `package.json`, append
to `CHANGELOG.md`, and tag.