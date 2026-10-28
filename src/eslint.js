/**
 * ESLint rule `persist-safe/no-write-on-mount`.
 *
 * Flags an effect that writes to storage unconditionally:
 *
 *     useEffect(() => { localStorage.setItem("log", JSON.stringify(log)); }, [log]);
 *
 * An effect runs on mount as well as on change, so this writes back whatever the first render
 * held. When the read behind that render failed (corrupt JSON, a private window, blocked
 * storage, a remount before data arrived) that is the empty fallback, and it replaces the real
 * data before anyone touches anything. A workout log lost its history this way.
 *
 * A write inside a condition (`if (loaded) ...`, `ready && save()`) or after an early return
 * is left alone: someone thought about when it may run. Writes inside a nested function
 * (an event handler the effect registers) are left alone too, because they don't run on mount.
 *
 *   // eslint.config.js
 *   import persistSafe from "react-persist-safe/eslint";
 *   export default [persistSafe.configs.recommended];
 */

const EFFECT_HOOKS = new Set(["useEffect", "useLayoutEffect", "useInsertionEffect"]);
const STORAGE_OBJECTS = new Set(["localStorage", "sessionStorage"]);
const STORAGE_WRITE_METHODS = new Set(["setItem", "removeItem", "clear"]);
const DEFAULT_WRITERS = ["localforage.setItem", "localforage.removeItem"];

function calleeName(node) {
  if (node.type === "Identifier") return node.name;
  if (node.type === "MemberExpression" && !node.computed && node.property.type === "Identifier") {
    const object = calleeName(node.object);
    return object ? `${object}.${node.property.name}` : null;
  }
  if (node.type === "ThisExpression") return "this";
  return null;
}

/** `localStorage`, `window.localStorage`, `globalThis.sessionStorage`. */
function isStorageObject(node) {
  const name = calleeName(node);
  if (!name) return false;
  const last = name.split(".").pop();
  return STORAGE_OBJECTS.has(last) && (name === last || /^(window|globalThis|self)\.\w+$/.test(name));
}

function isEffectCall(node) {
  const name = calleeName(node.callee);
  return name != null && EFFECT_HOOKS.has(name.split(".").pop());
}

function isFunction(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
}

function returnsSomewhere(node) {
  if (!node || typeof node !== "object") return false;
  if (node.type === "ReturnStatement") return true;
  if (isFunction(node)) return false;
  for (const [k, v] of Object.entries(node)) {
    if (k === "parent") continue;
    if (Array.isArray(v) ? v.some(returnsSomewhere) : v && typeof v.type === "string" && returnsSomewhere(v)) return true;
  }
  return false;
}

export const noWriteOnMount = {
  meta: {
    type: "problem",
    docs: {
      description: "Disallow effects that write to storage on mount, before anything has changed",
      url: "https://github.com/Blueangelman36/react-persist-safe#no-write-on-mount",
    },
    schema: [
      {
        type: "object",
        properties: { writers: { type: "array", items: { type: "string" } } },
        additionalProperties: false,
      },
    ],
    messages: {
      onMount:
        "This effect writes to storage on mount, before anything has changed. If the read behind the first render failed, its fallback replaces the stored data. Save in the handler that changes the value, guard the write (`if (loaded)`), or use usePersisted from react-persist-safe.",
    },
  },
  create(context) {
    const writers = new Set([...DEFAULT_WRITERS, ...((context.options[0] && context.options[0].writers) || [])]);

    function isWrite(node) {
      if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
        const method = node.callee.computed ? null : node.callee.property.name;
        if (method && STORAGE_WRITE_METHODS.has(method) && isStorageObject(node.callee.object)) return true;
      }
      if (node.type === "CallExpression") {
        const name = calleeName(node.callee);
        if (name && writers.has(name)) return true;
      }
      // localStorage.key = value, localStorage[key] = value
      if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && isStorageObject(node.left.object)) return true;
      return false;
    }

    /** True when `node`, inside `body`, only runs under a condition someone wrote. */
    function isGuarded(node, body) {
      let child = node;
      for (let p = node.parent; p; child = p, p = p.parent) {
        if (p.type === "IfStatement" && child !== p.test) return true;
        if (p.type === "ConditionalExpression" && child !== p.test) return true;
        if (p.type === "LogicalExpression" && child === p.right) return true;
        if (p.type === "SwitchCase" || p.type === "CatchClause") return true;
        // An early `if (...) return;` before this statement guards everything after it.
        if (p.type === "BlockStatement") {
          for (const statement of p.body) {
            if (statement === child) break;
            if (statement.type === "IfStatement" && returnsSomewhere(statement)) return true;
          }
        }
        if (p === body) break;
      }
      return false;
    }

    function check(node) {
      // Walk up to the nearest function. Only an effect's own callback counts.
      let fn = node.parent;
      while (fn && !isFunction(fn)) fn = fn.parent;
      if (!fn || !fn.parent || fn.parent.type !== "CallExpression") return;
      const call = fn.parent;
      if (call.arguments[0] !== fn || !isEffectCall(call)) return;
      if (isGuarded(node, fn.body)) return;
      context.report({ node, messageId: "onMount" });
    }

    return {
      CallExpression(node) {
        if (isWrite(node)) check(node);
      },
      AssignmentExpression(node) {
        if (isWrite(node)) check(node);
      },
    };
  },
};

const plugin = {
  meta: { name: "react-persist-safe", version: "0.1.0" },
  rules: { "no-write-on-mount": noWriteOnMount },
  configs: {},
};

plugin.configs.recommended = {
  name: "react-persist-safe/recommended",
  plugins: { "persist-safe": plugin },
  rules: { "persist-safe/no-write-on-mount": "error" },
};

export default plugin;
