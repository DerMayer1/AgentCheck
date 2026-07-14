import path from "node:path";

import type { LocatedFact } from "../domain/facts.js";
import type { RepositorySnapshot } from "../domain/types.js";
import type { TextFileStore } from "../repository/text-file-store.js";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);
const ENV_EXAMPLE_NAMES = new Set([".env.example", ".env.sample", ".env.template"]);

export async function detectEnvironment(
  snapshot: RepositorySnapshot,
  textFiles: TextFileStore,
): Promise<{
  required: LocatedFact[];
  documented: string[];
  limitations: Array<{ code: string; message: string; path?: string }>;
}> {
  const required: LocatedFact[] = [];
  const documented = new Set<string>();
  const limitations: Array<{ code: string; message: string; path?: string }> = [];

  const sourceFiles = snapshot.files
    .map((file) => file.path)
    .filter(
      (file) =>
        SOURCE_EXTENSIONS.has(path.posix.extname(file)) &&
        !file.startsWith("tests/") &&
        !file.includes("/fixtures/"),
    );
  for (const file of sourceFiles) {
    const result = await textFiles.read(file);
    if (result.content === undefined) {
      continue;
    }
    for (const [index, line] of result.content.split(/\r?\n/).entries()) {
      for (const match of line.matchAll(/(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]*)/g)) {
        const variable = match[1];
        if (variable !== undefined) {
          required.push({ path: file, line: index + 1, value: variable });
        }
      }
    }
  }

  const examples = snapshot.files
    .map((file) => file.path)
    .filter((file) => ENV_EXAMPLE_NAMES.has(path.posix.basename(file)));
  for (const file of examples) {
    const result = await textFiles.read(file);
    if (result.content === undefined) {
      limitations.push({
        code: "ENV_EXAMPLE_UNREADABLE",
        message: result.error ?? "Environment example could not be read.",
        path: file,
      });
      continue;
    }
    for (const line of result.content.split(/\r?\n/)) {
      const match = /^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/.exec(line);
      if (match?.[1] !== undefined) {
        documented.add(match[1]);
      }
    }
  }

  return {
    required,
    documented: [...documented].sort(),
    limitations,
  };
}
