import path from "node:path";

import type { CommandFact } from "../domain/facts.js";
import type { RepositorySnapshot } from "../domain/types.js";
import type { TextFileStore } from "../repository/text-file-store.js";
import { parseCommand } from "./command-parser.js";

const ROOT_DOCUMENT_NAMES = new Set([
  "AGENTS.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
]);

function isDocumentation(repositoryPath: string): boolean {
  const basename = path.posix.basename(repositoryPath);
  return (
    (!repositoryPath.includes("/") && ROOT_DOCUMENT_NAMES.has(basename)) ||
    (repositoryPath.startsWith("docs/") && repositoryPath.endsWith(".md"))
  );
}

export async function detectDocumentation(
  snapshot: RepositorySnapshot,
  textFiles: TextFileStore,
): Promise<{
  files: string[];
  commands: CommandFact[];
  limitations: Array<{ code: string; message: string; path?: string }>;
}> {
  const files = snapshot.files
    .map((file) => file.path)
    .filter(isDocumentation)
    .sort();
  const commands: CommandFact[] = [];
  const limitations: Array<{ code: string; message: string; path?: string }> = [];

  for (const file of files) {
    const result = await textFiles.read(file);
    if (result.content === undefined) {
      limitations.push({
        code: "DOCUMENTATION_UNREADABLE",
        message: result.error ?? "Documentation could not be read.",
        path: file,
      });
      continue;
    }

    for (const [index, line] of result.content.split(/\r?\n/).entries()) {
      const parsed = parseCommand(line, "documentation", file, index + 1);
      if (parsed !== undefined) {
        commands.push(parsed);
      }
    }
  }

  return { files, commands, limitations };
}
