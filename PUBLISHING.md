# Publishing mdview to npm

This guide walks maintainers through cutting a release and shipping it to npm.

## Prereq

- npm account at https://www.npmjs.com
- Logged in locally: `npm login`
- Two-factor authentication enabled (recommended)

## Pre-flight checklist

- [ ] `git status` is clean â€?no uncommitted changes
- [ ] You're on the `main` branch and pulled the latest
- [ ] `package.json` version bumped (semver: patch / minor / major)
- [ ] `CHANGELOG.md` updated with a dated entry
- [ ] `npm test` runs and passes (we just print `--help` â€?sanity check the JS is loadable)
- [ ] Screenshots up to date: `npm run screenshots` (if visual changes)

## Dry-run

Always do a dry-run first to inspect what would be published:

```bash
npm pack --dry-run
```

This lists every file that would go into the tarball. Sanity check:

- `bin/mdview.js`, `public/`, `themes/`, `examples/`
- `README.md`, `README.zh.md`, `LICENSE`
- **NOT** `node_modules/`, `docs/screenshots/` (we keep that on GitHub only)

If something leaks in, add it to `.npmignore`.

## Publishing

For the first release, or when changing package scope:

```bash
# If the package is brand new on npm:
npm publish --access public

# For subsequent versions (after bumping version in package.json):
npm publish
```

If you need to use a tag (e.g. beta):

```bash
npm publish --tag beta
```

## After publishing

1. Verify the package page: https://www.npmjs.com/package/mdview
2. Tag the commit: `git tag v1.0.0 && git push --tags`
3. Test installation in a clean directory:

   ```bash
   cd /tmp
   npx mdview --help
   npx mdview
   ```

   Confirm `--help` lists the right options and the server starts cleanly.

4. Announce: pin to your README, GitHub Discussions, social, etc.

## Versioning policy

We follow **semver**:

- **PATCH** (`1.0.x`) â€?bug fixes, dependency bumps, theme polish.
- **MINOR** (`1.x.0`) â€?new feature that doesn't break existing flags/configs.
- **MAJOR** (`x.0.0`) â€?breaking changes to themes / themes / API / config files.

## Rolling back a bad release

```bash
npm unpublish mdview@1.0.1      # within 72 hours
npm deprecate mdview@1.0.1 "broken, please use 1.0.2"
```

`unpublish` is restricted â€?npm may deny it for popular packages. Prefer
`deprecate` to nudge users to the fixed one.