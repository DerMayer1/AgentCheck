export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type CommandSource = "documentation" | "ci";

export interface PackageManifestFact {
  path: string;
  directory: string;
  name?: string;
  scripts: Readonly<Record<string, string>>;
  declaredPackageManager?: PackageManager;
  workspacePatterns: string[];
}

export interface LockfileFact {
  path: string;
  packageManager: PackageManager;
}

export interface CommandFact {
  source: CommandSource;
  path: string;
  line: number;
  raw: string;
  packageManager?: PackageManager;
  script?: string;
}

export interface RepositoryFacts {
  ecosystems: string[];
  manifests: PackageManifestFact[];
  rootManifest?: PackageManifestFact;
  lockfiles: LockfileFact[];
  documentationFiles: string[];
  documentationCommands: CommandFact[];
  ciFiles: string[];
  ciCommands: CommandFact[];
  workspace: boolean;
  limitations: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
}
