export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export type CommandSource = "documentation" | "ci";

export interface PackageManifestFact {
  path: string;
  directory: string;
  name?: string;
  scripts: Readonly<Record<string, string>>;
  declaredPackageManager?: PackageManager;
  nodeVersionConstraint?: string;
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

export interface LocatedFact {
  path: string;
  line: number;
  value: string;
}

export interface PathReferenceFact extends LocatedFact {
  exists: boolean;
}

export interface RepositoryFacts {
  files: string[];
  ecosystems: string[];
  manifests: PackageManifestFact[];
  rootManifest?: PackageManifestFact;
  lockfiles: LockfileFact[];
  documentationFiles: string[];
  documentationCommands: CommandFact[];
  pathReferences: PathReferenceFact[];
  unsafeInstructions: LocatedFact[];
  ciFiles: string[];
  ciCommands: CommandFact[];
  requiredEnvironmentVariables: LocatedFact[];
  documentedEnvironmentVariables: string[];
  workspace: boolean;
  limitations: Array<{
    code: string;
    message: string;
    path?: string;
  }>;
}
