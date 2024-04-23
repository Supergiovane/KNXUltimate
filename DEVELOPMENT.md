
![Sample Node](img/logo.png)

<br/>

# Development

This guide aims to provide a quick overview of the development process for this project.

## PRs and Commits

General rules for PRs and commits:

- Use conventional commit standard: <https://www.conventionalcommits.org/en/v1.0.0/>
- Always use "Squash and Merge" for clean commit history on `main` branch.
- CI workflow must pass before merging PRs.

## Releases

Release process is handled by [release-it](https://github.com/release-it/release-it). In order to create new releases you can run:

```bash
npm run release
```

This command will firstly ask you for your GH token and then wll start an interactive prompt to select the type of release you want create. After selecting the type, it will automatically:

- Bump the version in `package.json`
- Update the `CHANGELOG.md` with the release notes
- Create a new tag and release commit like `chore: release v1.0.0`
- Push the tag and commit to the repository `main` branch
- Create a new release on GitHub with the release notes
- Publish the package to npm

The command can also accept a `--dry-run` flag to simulate the release process without actually publishing anything.

In order to create a new major beta release run:

```bash
npm run release -- major --preRelease=beta
```

To create consecutives beta patches:

```bash
npm run release -- --preRelease=beta
```

## Testing

Actually there is no test suite but you can use examples from `examples` folder to run manual tests:

```bash
node -r esbuild-register --inspect examples/discovery.ts
```

This will run the `discovery.ts` example with `--inspect` flag to enable debugging.

## Building

To build the project you can run:

```bash
npm run build
```

This will generate the `build` folder with the transpiled code.

## Linting/Formatting

To lint the project you can run:

```bash
npm run lint
```

This will run ESLint+Prettier with the TypeScript parser and the recommended rules.

To fix lint issues code wise you can run:

```bash
npm run lint-fix
```

This will fix all the auto-fixable issues.
