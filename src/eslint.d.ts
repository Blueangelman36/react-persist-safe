import type { ESLint, Linter, Rule } from "eslint";

export const noWriteOnMount: Rule.RuleModule;
declare const plugin: ESLint.Plugin & { configs: { recommended: Linter.Config } };
export default plugin;
