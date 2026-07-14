import type { RepositoryFacts } from "../domain/facts.js";
import type { RepositorySnapshot } from "../domain/types.js";
import { TextFileStore } from "../repository/text-file-store.js";
import { detectCi } from "./ci-detector.js";
import { detectDocumentation } from "./documentation-detector.js";
import { detectPackages } from "./package-detector.js";

export async function detectFacts(snapshot: RepositorySnapshot): Promise<RepositoryFacts> {
  const textFiles = new TextFileStore(snapshot);
  const [packages, documentation, ci] = await Promise.all([
    detectPackages(snapshot, textFiles),
    detectDocumentation(snapshot, textFiles),
    detectCi(snapshot, textFiles),
  ]);
  const rootManifest = packages.manifests.find((manifest) => manifest.path === "package.json");
  const hasTypeScript = snapshot.files.some(
    (file) => file.path.endsWith(".ts") || file.path.endsWith(".tsx"),
  );

  return {
    ecosystems: [
      ...(packages.manifests.length > 0 ? ["node"] : []),
      ...(hasTypeScript ? ["typescript"] : []),
    ],
    manifests: packages.manifests,
    ...(rootManifest === undefined ? {} : { rootManifest }),
    lockfiles: packages.lockfiles,
    documentationFiles: documentation.files,
    documentationCommands: documentation.commands,
    ciFiles: ci.files,
    ciCommands: ci.commands,
    workspace:
      (rootManifest?.workspacePatterns.length ?? 0) > 0 ||
      snapshot.files.some((file) => file.path === "pnpm-workspace.yaml"),
    limitations: [
      ...packages.limitations,
      ...documentation.limitations,
      ...ci.limitations,
    ],
  };
}
