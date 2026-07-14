import type { CommandFact } from "../domain/facts.js";
import type { RepositorySnapshot } from "../domain/types.js";
import type { TextFileStore } from "../repository/text-file-store.js";
import { parseCommand } from "./command-parser.js";

function isGitHubWorkflow(repositoryPath: string): boolean {
  return (
    repositoryPath.startsWith(".github/workflows/") &&
    (repositoryPath.endsWith(".yml") || repositoryPath.endsWith(".yaml"))
  );
}

export async function detectCi(
  snapshot: RepositorySnapshot,
  textFiles: TextFileStore,
): Promise<{
  files: string[];
  commands: CommandFact[];
  limitations: Array<{ code: string; message: string; path?: string }>;
}> {
  const files = snapshot.files
    .map((file) => file.path)
    .filter(isGitHubWorkflow)
    .sort();
  const commands: CommandFact[] = [];
  const limitations: Array<{ code: string; message: string; path?: string }> = [];

  for (const file of files) {
    const result = await textFiles.read(file);
    if (result.content === undefined) {
      limitations.push({
        code: "CI_WORKFLOW_UNREADABLE",
        message: result.error ?? "CI workflow could not be read.",
        path: file,
      });
      continue;
    }

    const lines = result.content.split(/\r?\n/);
    let blockIndent: number | undefined;
    for (const [index, line] of lines.entries()) {
      const indentation = line.match(/^\s*/)?.[0].length ?? 0;
      const runMatch = /^\s*-?\s*run:\s*(.*)$/.exec(line);

      if (runMatch !== null) {
        const value = runMatch[1]?.trim() ?? "";
        blockIndent = value === "|" || value === ">" || value === "" ? indentation : undefined;
        if (blockIndent === undefined) {
          const parsed = parseCommand(value, "ci", file, index + 1);
          if (parsed !== undefined) {
            commands.push(parsed);
          }
        }
        continue;
      }

      if (blockIndent !== undefined) {
        if (line.trim() === "") {
          continue;
        }
        if (indentation <= blockIndent) {
          blockIndent = undefined;
        } else {
          const parsed = parseCommand(line.trim(), "ci", file, index + 1);
          if (parsed !== undefined) {
            commands.push(parsed);
          }
        }
      }
    }
  }

  return { files, commands, limitations };
}
