# Development

From a source checkout, use Node.js 24+ and Git:

```sh
npm ci
npm start -- --project .
```

The checkout CLI is `node src/cli.ts`; `npm run build` compiles the CLI and desktop
into `dist/`. To build from the source included in an npm tarball, install build
dependencies with `npm install --include=dev`, then run `npm run build`.

Available checks:

```sh
npm run typecheck
npm test
npm run test:desktop
npm run test:package
node src/cli.ts validate
```

The package rehearsal builds a tarball and installs it into a temporary npm prefix.
It exercises the installed CLI, skills, an accepted change in a disposable Git
repository, and the desktop. It downloads dependencies and opens test windows;
it does not publish or alter your normal global installation.

`npm run demo` runs the disposable queue example. Add `-- --prepare-only` to leave
its change ready for inspection instead of accepting it. The report gives its
project path, which can be opened with the desktop.

`npm pack --pack-destination /tmp` retains a local package. Packing builds the
runtime files automatically. The explicit package file list includes source,
skills and documentation, and excludes project data, reviews and tests. The
package uses GPL-3.0-only; bundled dependency notices are in
`dist/THIRD_PARTY_NOTICES.txt`. Publication is a separate step.
