export function deployVersion(options?: { version?: string; fileName?: string }): {
  name: string;
  config(): { define: Record<string, string> };
  generateBundle(this: { emitFile(file: { type: "asset"; fileName: string; source: string }): string }): void;
};
