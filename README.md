# react-persist-safe

*Browser storage that never wipes your users' data on a bad day.*

This is the most common way to keep React state in `localStorage`, and it loses data:

```js
const [log, setLog] = useState(() => JSON.parse(localStorage.getItem("log") ?? "[]"));
useEffect(() => { localStorage.setItem("log", JSON.stringify(log)); }, [log]);
```

The effect runs on **mount**, not just on change. If the read failed (the stored JSON was
damaged, a private window blocked storage, a remount happened before data arrived), `log`
is the empty fallback, and the effect writes that empty value over the real data on the
first render. Nobody pressed anything. A workout-logging app lost its history this way.

This package has three parts. Use any of them on their own.

| part | what it does |
|---|---|
| `usePersisted` | Like `useState`, saved to storage. Writes only when you call `set`. Damaged data is backed up before anything replaces it. |
| ESLint rule `no-write-on-mount` | Finds the pattern above in code you already have. |
| `useDeployVersion` + a Vite plugin | Tells a tab that has been open since an older deploy that it should reload. |

No runtime dependencies. React 18 or newer for the hooks; ESLint 9 or newer for the rule.

## Install it (easiest way)

In your project folder (on Windows: open the folder in File Explorer, click the address
bar, type `powershell`, press Enter):

```bash
npm install react-persist-safe
```

### 1. Find the bug in code you already have

Add the rule to `eslint.config.js`:

```js
import persistSafe from "react-persist-safe/eslint";

export default [
  // ...your existing config
  persistSafe.configs.recommended,
];
```

Then run `npx eslint .`. Every effect that writes to storage on mount is reported, with the
file and line.

### 2. Replace it with a hook that can't do it

```jsx
import { usePersisted } from "react-persist-safe";

function Log() {
  const [log, setLog, saved] = usePersisted("log", [], { validate: Array.isArray });

  return (
    <>
      {saved.status === "unreadable" && <p>Your saved log couldn't be read. It has been kept, not overwritten.</p>}
      {saved.error && <p>{saved.error}</p>}
      <button onClick={() => setLog((l) => [...l, Date.now()])}>Add</button>
    </>
  );
}
```

### 3. Tell old tabs to reload (optional)

In `vite.config.js`:

```js
import { deployVersion } from "react-persist-safe/vite";

export default { plugins: [deployVersion() /* , react() ... */] };
```

Each build now has a version: the commit being deployed on Vercel, Netlify, Cloudflare Pages
or GitHub Actions, or the build time anywhere else. The build writes it to `version.json`.
In your app:

```jsx
import { useDeployVersion } from "react-persist-safe";

const deploy = useDeployVersion({ current: __APP_VERSION__ });
// deploy.status is "current", "stale" or "unknown"
{deploy.status === "stale" && <button onClick={() => location.reload()}>New version available: reload</button>}
```

It checks when the tab comes back into view and every 15 minutes while it is visible.
With TypeScript, add `declare const __APP_VERSION__: string;` to a `.d.ts` file.

[examples/App.jsx](examples/App.jsx) puts all three together.

## What `usePersisted` promises

| situation | `status` | what happens |
|---|---|---|
| a value is stored and reads fine | `loaded` | you get it |
| nothing stored yet | `missing` | you get the fallback |
| something is stored but can't be parsed, or fails `validate` | `unreadable` | you get the fallback. The stored text is copied to `<key>:unreadable-backup` before your first `set` replaces it. |
| storage is blocked or reading throws | `unavailable` | changes work but are kept in memory only. What's stored was never read, so it is never replaced. |
| a write fails (storage full) | unchanged | the new value is kept in memory, and `error` says it was not saved |

Also:

- **Mounting never writes.** Only `set(value)`, `set(prev => next)` and `clear()` write.
- **`refuseEmpty: true`** stops `set("")`, `set([])` or `set({})` from replacing a stored
  non-empty value, because an accidental select-all and delete looks just like a deliberate
  erase. `clear()` still empties it on purpose.
- **Other tabs.** A change made in another tab shows up in this one.
- **Not React?** `createPersisted(key, fallback, options)` is the same store without the hook.

## What the ESLint rule reports

Any `useEffect`, `useLayoutEffect` or `useInsertionEffect` whose own callback writes to
storage without a condition. Writes it recognises: `localStorage` and `sessionStorage`
`setItem`, `removeItem` and `clear` (also through `window.`), assignments like
`localStorage.x = v`, and `localforage.setItem`. You can add your own:

```js
rules: { "persist-safe/no-write-on-mount": ["error", { writers: ["db.put", "idb.set"] }] }
```

It does **not** report:

- a write inside a condition (`if (loaded)`, `ready && save()`, `a ? b : c`);
- a write after an early `if (...) return;`;
- a write inside a function the effect registers, such as an event listener.

The rule only checks that a condition exists. It can't tell whether the condition is the
right one.

## What `useDeployVersion` promises

`"stale"` only when `version.json` gives a version different from this build's. A failed
request, a timeout, an HTML page where the JSON should be (a single-page-app fallback for a
missing file), or a build with no version all give `"unknown"`, with `reason` saying which.
Being offline is not the same as being up to date.

## What is not verified

- The hooks are tested under jsdom with React 19 (`test/hook.test.js`), not in a real
  browser. React 18 is allowed by `peerDependencies` but not tested.
- The Vite plugin is tested by calling its hooks directly, not inside a real `vite build`.
- The ESLint rule is tested with ESLint 10. ESLint 9 is allowed but not tested.

## Publishing a release

For the maintainer. One-time setup:

1. On [npmjs.com](https://www.npmjs.com), sign in and publish the first version by hand,
   from the repository folder: `npm login`, then `npm publish --access public`. (npm only
   lets you configure trusted publishing for a package that already exists.)
2. On the package's page on npmjs.com: **Settings → Trusted publishing → GitHub Actions**.
   Owner `Blueangelman36`, repository `react-persist-safe`, workflow `release.yml`,
   environment `npm`.
3. In this repository on GitHub: **Settings → Environments → New environment**, named `npm`.
4. **Settings → Secrets and variables → Actions → Variables** tab (the repository one) →
   New repository variable: `PUBLISH_TO_NPM` = `true`.

Each release after that: set the same version in `package.json` and in `meta.version` in
`src/eslint.js`, merge, then on GitHub go to **Releases → Draft a new release**, create the
tag `v0.1.1` (matching the version) and publish. The workflow checks that the tag and both
versions agree before it publishes.

## License

MIT
