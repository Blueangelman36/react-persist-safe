import { test, describe, it } from "node:test";
import { RuleTester } from "eslint";
import plugin from "../src/eslint.js";

// RuleTester calls describe/it; point it at node:test.
RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2024, sourceType: "module", parserOptions: { ecmaFeatures: { jsx: true } } },
});

const rule = plugin.rules["no-write-on-mount"];
const err = [{ messageId: "onMount" }];

tester.run("no-write-on-mount", rule, {
  valid: [
    // Saving in the handler that changes the value.
    `function A() { const add = (x) => { localStorage.setItem("log", JSON.stringify([...log, x])); }; }`,
    // Guarded: only after the stored value has been read.
    `useEffect(() => { if (loaded) localStorage.setItem("log", s); }, [log, loaded]);`,
    `useEffect(() => { if (!loaded) return; localStorage.setItem("log", s); }, [log, loaded]);`,
    `useEffect(() => { loaded && localStorage.setItem("log", s); }, [log, loaded]);`,
    `useEffect(() => { loaded ? save() : localStorage.setItem("log", s); }, [log]);`,
    // Registered handlers don't run on mount.
    `useEffect(() => { const h = () => localStorage.setItem("k", v); window.addEventListener("pagehide", h); return () => window.removeEventListener("pagehide", h); }, [v]);`,
    // Reading is fine.
    `useEffect(() => { setV(localStorage.getItem("k")); }, []);`,
    // Not storage.
    `useEffect(() => { map.setItem("k", v); cache.set("k", v); }, [v]);`,
    // A custom writer is only flagged when configured.
    `useEffect(() => { db.put("k", v); }, [v]);`,
  ],
  invalid: [
    { code: `useEffect(() => { localStorage.setItem("log", JSON.stringify(log)); }, [log]);`, errors: err },
    { code: `React.useEffect(() => { window.localStorage.setItem("log", s); }, [s]);`, errors: err },
    { code: `useLayoutEffect(function () { sessionStorage.setItem("tab", tab); }, [tab]);`, errors: err },
    { code: `useEffect(() => localStorage.setItem("k", v), [v]);`, errors: err },
    { code: `useEffect(() => { localStorage.draft = text; }, [text]);`, errors: err },
    { code: `useEffect(() => { localStorage["draft"] = text; }, [text]);`, errors: err },
    { code: `useEffect(() => { localStorage.removeItem("k"); }, []);`, errors: err },
    { code: `useEffect(() => { localforage.setItem("k", v); }, [v]);`, errors: err },
    // A condition on something else, before the write, is not a guard on the write.
    { code: `useEffect(() => { if (debug) console.log(v); localStorage.setItem("k", v); }, [v]);`, errors: err },
    { code: `useEffect(() => { db.put("k", v); }, [v]);`, options: [{ writers: ["db.put"] }], errors: err },
    { code: `useEffect(() => { try { localStorage.setItem("k", v); } catch {} }, [v]);`, errors: err },
  ],
});

test("the recommended config turns the rule on", async () => {
  const { Linter } = await import("eslint");
  const linter = new Linter();
  const messages = linter.verify(`useEffect(() => { localStorage.setItem("k", v); }, [v]);`, [plugin.configs.recommended]);
  if (messages.length !== 1 || messages[0].ruleId !== "persist-safe/no-write-on-mount") {
    throw new Error(JSON.stringify(messages));
  }
});
