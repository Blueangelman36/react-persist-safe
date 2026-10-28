# Notes for coding agents

Before handing back a change, run:

```bash
npm test
npm run lint
```

The package lints itself with its own rule (`eslint.config.js`). If that rule flags
something here, fix the code; never disable the rule for this repository.

Things that look odd and must stay:

- `createPersisted` never writes while reading, and `usePersisted` never writes in an
  effect. Writing on mount is the bug this package exists to prevent.
- A write after a read that *threw* (`status: "unavailable"`) stays in memory. The stored
  value was never seen, so it is not ours to replace.
- The `:unreadable-backup` copy is written once and never overwritten by later saves.
- `checkDeployVersion` returns `"unknown"` for anything that is not a clear answer.
  Do not make a failed request return `"current"`.
- The version lives in two places, `package.json` and `meta.version` in
  `src/eslint.js`; the release workflow refuses a tag when they differ.
