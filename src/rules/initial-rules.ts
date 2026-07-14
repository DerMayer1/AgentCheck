import type { PackageManager, RepositoryFacts } from "../domain/facts.js";
import type { Evidence, Finding } from "../domain/types.js";
import { skippedFinding, type RuleDefinition } from "./rule.js";

function manifestEvidence(path: string, message: string): Evidence {
  return { kind: "manifest", path, message };
}

function commandEvidence(
  command: { path: string; line: number; raw: string; source: "documentation" | "ci" },
  message = command.raw,
): Evidence {
  return {
    kind: command.source === "ci" ? "workflow" : "file",
    path: command.path,
    line: command.line,
    message,
  };
}

function lockfileEvidence(path: string, manager: PackageManager): Evidence {
  return { kind: "file", path, message: `${manager} lockfile detected.` };
}

function rootLockfiles(facts: RepositoryFacts) {
  return facts.lockfiles.filter((lockfile) => !lockfile.path.includes("/"));
}

function managerEvidence(facts: RepositoryFacts): Map<PackageManager, Evidence[]> {
  const evidence = new Map<PackageManager, Evidence[]>();
  const add = (manager: PackageManager, item: Evidence): void => {
    evidence.set(manager, [...(evidence.get(manager) ?? []), item]);
  };

  if (facts.rootManifest?.declaredPackageManager !== undefined) {
    add(
      facts.rootManifest.declaredPackageManager,
      manifestEvidence(
        facts.rootManifest.path,
        `packageManager declares ${facts.rootManifest.declaredPackageManager}.`,
      ),
    );
  }
  for (const lockfile of rootLockfiles(facts)) {
    add(lockfile.packageManager, lockfileEvidence(lockfile.path, lockfile.packageManager));
  }
  for (const command of [...facts.documentationCommands, ...facts.ciCommands]) {
    if (command.packageManager !== undefined) {
      add(command.packageManager, commandEvidence(command));
    }
  }

  return evidence;
}

function canonicalScript(facts: RepositoryFacts): { name: string; command: string } | undefined {
  const scripts = facts.rootManifest?.scripts ?? {};
  for (const name of ["verify", "validate", "check"]) {
    const command = scripts[name];
    if (command === undefined) {
      continue;
    }
    const signals = new Set(
      ["test", "lint", "typecheck", "type-check", "build"].filter((signal) =>
        command.toLowerCase().includes(signal),
      ),
    );
    if (signals.size >= 2) {
      return { name, command };
    }
  }
  return undefined;
}

function evaluatedFinding(
  rule: Omit<RuleDefinition, "evaluate">,
  values: Omit<Finding, "ruleId" | "category" | "title" | "severity" | "maxPoints"> & {
    severity?: Finding["severity"];
  },
): Finding {
  return {
    ruleId: rule.id,
    category: rule.category,
    title: rule.title,
    severity: values.severity ?? rule.severity,
    maxPoints: rule.maxPoints,
    status: values.status,
    confidence: values.confidence,
    impact: values.impact,
    ...(values.recommendation === undefined ? {} : { recommendation: values.recommendation }),
    evidence: values.evidence,
    earnedPoints: values.earnedPoints,
  };
}

const dependencyLockRuleMetadata = {
  id: "AC-ENV-001",
  category: "environment",
  title: "Dependency resolution is locked",
  severity: "high",
  maxPoints: 5,
} as const;

const dependencyLockRule: RuleDefinition = {
  ...dependencyLockRuleMetadata,
  evaluate(facts) {
    if (facts.manifests.length === 0) {
      return skippedFinding(dependencyLockRuleMetadata, "No Node.js manifest was detected.");
    }
    const lockfiles = rootLockfiles(facts);
    const managers = new Set(lockfiles.map((lockfile) => lockfile.packageManager));
    if (lockfiles.length === 1) {
      const lockfile = lockfiles[0];
      if (lockfile === undefined) {
        return skippedFinding(dependencyLockRuleMetadata, "No root lockfile was available.");
      }
      return evaluatedFinding(dependencyLockRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Agents can resolve the same dependency graph as maintainers and CI.",
        evidence: [lockfileEvidence(lockfile.path, lockfile.packageManager)],
        earnedPoints: 5,
      });
    }
    return evaluatedFinding(dependencyLockRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact:
        lockfiles.length === 0
          ? "Dependency installation can resolve different versions between agent runs."
          : "Multiple root lock strategies make dependency installation ambiguous.",
      recommendation:
        lockfiles.length === 0
          ? "Commit the lockfile produced by the repository's canonical package manager."
          : "Keep one root lock strategy and remove conflicting lockfiles.",
      evidence:
        lockfiles.length === 0
          ? [manifestEvidence(facts.rootManifest?.path ?? "package.json", "Node.js manifest has no root lockfile.")]
          : lockfiles.map((lockfile) => lockfileEvidence(lockfile.path, lockfile.packageManager)),
      earnedPoints: managers.size === 1 ? 2 : 0,
    });
  },
};

const packageManagerRuleMetadata = {
  id: "AC-ENV-003",
  category: "environment",
  title: "Package-manager choice is unambiguous",
  severity: "high",
  maxPoints: 5,
} as const;

const packageManagerRule: RuleDefinition = {
  ...packageManagerRuleMetadata,
  evaluate(facts) {
    if (facts.manifests.length === 0) {
      return skippedFinding(packageManagerRuleMetadata, "No Node.js manifest was detected.");
    }
    const byManager = managerEvidence(facts);
    if (byManager.size === 0) {
      return evaluatedFinding(packageManagerRuleMetadata, {
        status: "fail",
        confidence: "medium",
        impact: "An agent must guess which package manager owns installation and scripts.",
        recommendation: "Declare packageManager in package.json and commit its lockfile.",
        evidence: [manifestEvidence(facts.rootManifest?.path ?? "package.json", "No package-manager evidence was found.")],
        earnedPoints: 0,
      });
    }
    if (byManager.size === 1) {
      return evaluatedFinding(packageManagerRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Repository evidence consistently identifies one package manager.",
        evidence: [...byManager.values()].flat(),
        earnedPoints: 5,
      });
    }
    return evaluatedFinding(packageManagerRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact: "Manifest, lockfile, documentation, or CI disagree about the package manager.",
      recommendation: "Choose one package manager and align package.json, lockfiles, documentation, and CI.",
      evidence: [...byManager.values()].flat(),
      earnedPoints: 0,
    });
  },
};

const testCommandRuleMetadata = {
  id: "AC-VER-001",
  category: "verification",
  title: "Test command is declared",
  severity: "high",
  maxPoints: 5,
} as const;

const testCommandRule: RuleDefinition = {
  ...testCommandRuleMetadata,
  evaluate(facts) {
    if (facts.rootManifest === undefined) {
      return skippedFinding(testCommandRuleMetadata, "No root package.json was detected.");
    }
    const testScript = facts.rootManifest.scripts.test;
    if (testScript !== undefined) {
      return evaluatedFinding(testCommandRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Agents have a declared entry point for repository tests.",
        evidence: [manifestEvidence(facts.rootManifest.path, `test script: ${testScript}`)],
        earnedPoints: 5,
      });
    }
    return evaluatedFinding(testCommandRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact: "An agent cannot determine the canonical test entry point from package.json.",
      recommendation: "Add a test script to the root package.json.",
      evidence: [manifestEvidence(facts.rootManifest.path, "Root manifest has no test script.")],
      earnedPoints: 0,
    });
  },
};

const canonicalVerificationRuleMetadata = {
  id: "AC-VER-003",
  category: "verification",
  title: "Canonical verification command exists",
  severity: "high",
  maxPoints: 8,
} as const;

const canonicalVerificationRule: RuleDefinition = {
  ...canonicalVerificationRuleMetadata,
  evaluate(facts) {
    if (facts.rootManifest === undefined) {
      return skippedFinding(canonicalVerificationRuleMetadata, "No root package.json was detected.");
    }
    const canonical = canonicalScript(facts);
    if (canonical !== undefined) {
      return evaluatedFinding(canonicalVerificationRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Agents can validate a complete change through one declared command.",
        evidence: [manifestEvidence(facts.rootManifest.path, `${canonical.name} script: ${canonical.command}`)],
        earnedPoints: 8,
      });
    }
    return evaluatedFinding(canonicalVerificationRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact: "Agents must assemble a completion check from separate commands and may omit a gate.",
      recommendation: "Add a verify script that combines at least two of typecheck, lint, test, and build.",
      evidence: [manifestEvidence(facts.rootManifest.path, "No composite verify, validate, or check script was found.")],
      earnedPoints: 0,
    });
  },
};

const ciAlignmentRuleMetadata = {
  id: "AC-VER-004",
  category: "verification",
  title: "CI and local verification agree",
  severity: "high",
  maxPoints: 8,
} as const;

const ciAlignmentRule: RuleDefinition = {
  ...ciAlignmentRuleMetadata,
  evaluate(facts) {
    if (facts.ciFiles.length === 0) {
      return skippedFinding(ciAlignmentRuleMetadata, "No supported GitHub Actions workflow was detected.");
    }
    const canonical = canonicalScript(facts);
    if (canonical === undefined) {
      return skippedFinding(ciAlignmentRuleMetadata, "No canonical local verification script was detected.");
    }
    const matchingCommands = facts.ciCommands.filter((command) => command.script === canonical.name);
    if (matchingCommands.length > 0) {
      return evaluatedFinding(ciAlignmentRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Local completion checks use the same entry point as CI.",
        evidence: matchingCommands.map((command) => commandEvidence(command)),
        earnedPoints: 8,
      });
    }
    return evaluatedFinding(ciAlignmentRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact: "An agent can pass local checks while CI enforces a different command path.",
      recommendation: `Invoke the ${canonical.name} script from CI, or make command equivalence explicit.`,
      evidence: facts.ciCommands.length > 0
        ? facts.ciCommands.map((command) => commandEvidence(command))
        : facts.ciFiles.map((file) => ({ kind: "workflow" as const, path: file, message: "No package-manager run command was extracted." })),
      earnedPoints: 0,
    });
  },
};

const documentedScriptsRuleMetadata = {
  id: "AC-INT-001",
  category: "integrity",
  title: "Documented package scripts exist",
  severity: "medium",
  maxPoints: 5,
} as const;

const documentedScriptsRule: RuleDefinition = {
  ...documentedScriptsRuleMetadata,
  evaluate(facts) {
    if (facts.rootManifest === undefined) {
      return skippedFinding(documentedScriptsRuleMetadata, "No root package.json was detected.");
    }
    const documentedScripts = facts.documentationCommands.filter(
      (command): command is typeof command & { script: string } => command.script !== undefined,
    );
    if (documentedScripts.length === 0) {
      return skippedFinding(documentedScriptsRuleMetadata, "No documented package scripts were detected.");
    }
    const missing = documentedScripts.filter(
      (command) => facts.rootManifest?.scripts[command.script] === undefined,
    );
    if (missing.length === 0) {
      return evaluatedFinding(documentedScriptsRuleMetadata, {
        status: "pass",
        confidence: "high",
        impact: "Package scripts named in repository instructions resolve to real scripts.",
        evidence: documentedScripts.map((command) => commandEvidence(command)),
        earnedPoints: 5,
      });
    }
    return evaluatedFinding(documentedScriptsRuleMetadata, {
      status: "fail",
      confidence: "high",
      impact: "Agents following repository documentation will invoke scripts that do not exist.",
      recommendation: "Update stale commands or add the documented scripts to the root package.json.",
      evidence: missing.map((command) => commandEvidence(command, `Missing script referenced by: ${command.raw}`)),
      earnedPoints: 0,
    });
  },
};

export const INITIAL_RULES: readonly RuleDefinition[] = [
  dependencyLockRule,
  packageManagerRule,
  testCommandRule,
  canonicalVerificationRule,
  ciAlignmentRule,
  documentedScriptsRule,
];

export function getCanonicalScriptName(facts: RepositoryFacts): string | undefined {
  return canonicalScript(facts)?.name;
}
