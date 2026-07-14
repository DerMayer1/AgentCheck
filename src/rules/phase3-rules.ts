import type { Evidence, Finding } from "../domain/types.js";
import { skippedFinding, type RuleDefinition } from "./rule.js";

type RuleMetadata = Omit<RuleDefinition, "evaluate">;

function result(
  rule: RuleMetadata,
  values: Pick<Finding, "status" | "confidence" | "impact" | "evidence" | "earnedPoints"> & {
    recommendation?: string | undefined;
  },
): Finding {
  const { recommendation, ...requiredValues } = values;
  return {
    ruleId: rule.id,
    category: rule.category,
    title: rule.title,
    severity: rule.severity,
    maxPoints: rule.maxPoints,
    ...requiredValues,
    ...(recommendation === undefined ? {} : { recommendation }),
  };
}

function fileEvidence(path: string, message: string, line?: number): Evidence {
  return {
    kind: "file",
    path,
    ...(line === undefined ? {} : { line }),
    message,
  };
}

const contextOverview: RuleMetadata = {
  id: "AC-CTX-001",
  category: "context",
  title: "Repository overview is actionable",
  severity: "high",
  maxPoints: 6,
  description: "Checks that a root README exists and exposes at least one executable package-manager command.",
  remediation: "Add a root README with installation, development, or verification commands.",
};

const contextInstructions: RuleMetadata = {
  id: "AC-CTX-002",
  category: "context",
  title: "Agent instructions are present",
  severity: "medium",
  maxPoints: 4,
  description: "Checks for root-level AGENTS.md or CLAUDE.md instructions.",
  remediation: "Add AGENTS.md with project boundaries, commands, safety rules, and completion criteria.",
};

const testDiscovery: RuleMetadata = {
  id: "AC-VER-002",
  category: "verification",
  title: "Test files are discoverable",
  severity: "medium",
  maxPoints: 5,
  description: "Correlates a declared test script with conventional test file and directory names.",
  remediation: "Add discoverable test files or document where external tests live.",
};

const typecheckAvailable: RuleMetadata = {
  id: "AC-VER-005",
  category: "verification",
  title: "Type checking is independently available",
  severity: "medium",
  maxPoints: 5,
  description: "Checks TypeScript repositories for an explicit typecheck script.",
  remediation: "Add a typecheck script that runs tsc with no emit.",
};

const failuresVisible: RuleMetadata = {
  id: "AC-VER-006",
  category: "verification",
  title: "Validation failures are not suppressed",
  severity: "critical",
  maxPoints: 7,
  description: "Finds validation scripts that force a successful exit after a failed command.",
  remediation: "Remove unconditional success fallbacks such as || true or ; exit 0.",
};

const nodeVersion: RuleMetadata = {
  id: "AC-ENV-002",
  category: "environment",
  title: "Node.js version is constrained",
  severity: "medium",
  maxPoints: 4,
  description: "Checks package.json engines or Volta, .nvmrc, and .node-version.",
  remediation: "Declare the supported Node.js version in package.json or a version file.",
};

const environmentDocs: RuleMetadata = {
  id: "AC-ENV-004",
  category: "environment",
  title: "Required environment variables are documented",
  severity: "high",
  maxPoints: 6,
  description: "Correlates process.env and import.meta.env usage with environment example files.",
  remediation: "Add missing variable names to .env.example without committing secret values.",
};

const setupConsistency: RuleMetadata = {
  id: "AC-ENV-005",
  category: "environment",
  title: "Setup instructions match the package manager",
  severity: "medium",
  maxPoints: 5,
  description: "Checks that documented installation commands use the repository's canonical package manager.",
  remediation: "Document an installation command using the package manager declared by the manifest and lockfile.",
};

const productionSeparation: RuleMetadata = {
  id: "AC-SAFE-001",
  category: "safety",
  title: "Production operations are separated from verification",
  severity: "critical",
  maxPoints: 6,
  description: "Ensures verify, validate, or check scripts do not invoke deploy, publish, or release scripts.",
  remediation: "Keep deployment and publication outside routine validation commands.",
};

const destructiveCommands: RuleMetadata = {
  id: "AC-SAFE-002",
  category: "safety",
  title: "Destructive commands are explicitly scoped",
  severity: "critical",
  maxPoints: 6,
  description: "Finds destructive database and filesystem commands exposed through unscoped scripts.",
  remediation: "Scope destructive scripts to local, dev, or test environments and document their data-loss behavior.",
};

const permissionBypass: RuleMetadata = {
  id: "AC-SAFE-004",
  category: "safety",
  title: "Instructions preserve permission boundaries",
  severity: "critical",
  maxPoints: 6,
  description: "Finds instructions that tell coding agents to bypass confirmations, approvals, or permission checks.",
  remediation: "Remove blanket bypass instructions and document narrowly scoped safe commands instead.",
};

const referencedPaths: RuleMetadata = {
  id: "AC-INT-002",
  category: "integrity",
  title: "Referenced local paths exist",
  severity: "medium",
  maxPoints: 5,
  description: "Checks src, docs, and .github paths referenced in repository documentation.",
  remediation: "Correct stale paths or restore the referenced file or directory.",
};

export const PHASE3_RULES: readonly RuleDefinition[] = [
  {
    ...contextOverview,
    evaluate(facts) {
      const readme = facts.documentationFiles.find((file) => file === "README.md");
      if (readme === undefined) {
        return result(contextOverview, {
          status: "fail", confidence: "high", impact: "Agents lack a canonical repository entry point.",
          recommendation: contextOverview.remediation, evidence: [fileEvidence("README.md", "Root README was not found.")], earnedPoints: 0,
        });
      }
      const commands = facts.documentationCommands.filter((command) => command.path === readme);
      return commands.length > 0
        ? result(contextOverview, {
            status: "pass", confidence: "high", impact: "The root README exposes executable development guidance.",
            evidence: commands.slice(0, 3).map((command) => fileEvidence(command.path, command.raw, command.line)), earnedPoints: 6,
          })
        : result(contextOverview, {
            status: "fail", confidence: "high", impact: "The README does not give agents an executable starting point.",
            recommendation: contextOverview.remediation, evidence: [fileEvidence(readme, "No package-manager command was found.")], earnedPoints: 0,
          });
    },
  },
  {
    ...contextInstructions,
    evaluate(facts) {
      const instruction = facts.documentationFiles.find((file) => file === "AGENTS.md" || file === "CLAUDE.md");
      return instruction === undefined
        ? result(contextInstructions, {
            status: "fail", confidence: "high", impact: "Agents must infer repository-specific boundaries and completion rules.",
            recommendation: contextInstructions.remediation, evidence: [fileEvidence("AGENTS.md", "No root agent instruction file was found.")], earnedPoints: 0,
          })
        : result(contextInstructions, {
            status: "pass", confidence: "high", impact: "Repository-specific agent guidance is discoverable.",
            evidence: [fileEvidence(instruction, "Agent instruction file detected.")], earnedPoints: 4,
          });
    },
  },
  {
    ...testDiscovery,
    evaluate(facts) {
      if (facts.rootManifest?.scripts.test === undefined) {
        return skippedFinding(testDiscovery, "No root test script was detected.");
      }
      const tests = facts.files.filter((file) => /(?:^|\/)(?:tests?|__tests__)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file));
      return tests.length > 0
        ? result(testDiscovery, {
            status: "pass", confidence: "high", impact: "Agents can locate tests associated with the declared test command.",
            evidence: tests.slice(0, 5).map((file) => fileEvidence(file, "Test file detected.")), earnedPoints: 5,
          })
        : result(testDiscovery, {
            status: "fail", confidence: "medium", impact: "A test command exists, but no conventional test files were found.",
            recommendation: testDiscovery.remediation, evidence: [fileEvidence(facts.rootManifest.path, "Test script exists without discoverable tests.")], earnedPoints: 0,
          });
    },
  },
  {
    ...typecheckAvailable,
    evaluate(facts) {
      if (!facts.ecosystems.includes("typescript") || facts.rootManifest === undefined) {
        return skippedFinding(typecheckAvailable, "Repository is not a detected TypeScript project.");
      }
      const entry = Object.entries(facts.rootManifest.scripts).find(
        ([name, command]) => /^(?:typecheck|type-check|check:types)$/.test(name) || /tsc\b.*--noEmit|tsc\b.*--no-emit/i.test(command),
      );
      return entry === undefined
        ? result(typecheckAvailable, {
            status: "fail", confidence: "high", impact: "Agents cannot validate TypeScript independently of build output.",
            recommendation: typecheckAvailable.remediation, evidence: [fileEvidence(facts.rootManifest.path, "No explicit typecheck script was found.")], earnedPoints: 0,
          })
        : result(typecheckAvailable, {
            status: "pass", confidence: "high", impact: "Type errors can be checked through a dedicated script.",
            evidence: [fileEvidence(facts.rootManifest.path, `${entry[0]} script: ${entry[1]}`)], earnedPoints: 5,
          });
    },
  },
  {
    ...failuresVisible,
    evaluate(facts) {
      if (facts.rootManifest === undefined) {
        return skippedFinding(failuresVisible, "No root package.json was detected.");
      }
      const suppressed = Object.entries(facts.rootManifest.scripts).filter(
        ([name, command]) => /test|lint|type|build|verify|validate|check/i.test(name) && /\|\|\s*true\b|;\s*exit\s+0\b|\|\|\s*exit\s+0\b/.test(command),
      );
      return suppressed.length === 0
        ? result(failuresVisible, {
            status: "pass", confidence: "high", impact: "Validation scripts propagate command failures.",
            evidence: [fileEvidence(facts.rootManifest.path, "No unconditional success fallback was found.")], earnedPoints: 7,
          })
        : result(failuresVisible, {
            status: "fail", confidence: "high", impact: "A failed validation command can still report success to an agent or CI.",
            recommendation: failuresVisible.remediation,
            evidence: suppressed.map(([name, command]) => fileEvidence(facts.rootManifest?.path ?? "package.json", `${name} script: ${command}`)), earnedPoints: 0,
          });
    },
  },
  {
    ...nodeVersion,
    evaluate(facts) {
      if (facts.rootManifest === undefined) {
        return skippedFinding(nodeVersion, "No root package.json was detected.");
      }
      const versionFile = facts.files.find((file) => file === ".nvmrc" || file === ".node-version");
      if (facts.rootManifest.nodeVersionConstraint !== undefined || versionFile !== undefined) {
        return result(nodeVersion, {
          status: "pass", confidence: "high", impact: "Agents can select a compatible Node.js runtime.",
          evidence: [fileEvidence(versionFile ?? facts.rootManifest.path, facts.rootManifest.nodeVersionConstraint ?? "Node version file detected.")], earnedPoints: 4,
        });
      }
      return result(nodeVersion, {
        status: "fail", confidence: "high", impact: "Runtime-dependent behavior may differ between agent environments.",
        recommendation: nodeVersion.remediation, evidence: [fileEvidence(facts.rootManifest.path, "No Node.js version constraint was found.")], earnedPoints: 0,
      });
    },
  },
  {
    ...environmentDocs,
    evaluate(facts) {
      const required = [...new Set(facts.requiredEnvironmentVariables.map((item) => item.value))];
      if (required.length === 0) {
        return skippedFinding(environmentDocs, "No static environment-variable access was detected.");
      }
      const documented = new Set(facts.documentedEnvironmentVariables);
      const missing = required.filter((variable) => !documented.has(variable));
      return missing.length === 0
        ? result(environmentDocs, {
            status: "pass", confidence: "high", impact: "Required environment variable names are discoverable without exposing values.",
            evidence: required.map((variable) => fileEvidence(".env.example", `${variable} is documented.`)), earnedPoints: 6,
          })
        : result(environmentDocs, {
            status: "fail", confidence: "high", impact: "Agents may discover required configuration only after runtime failures.",
            recommendation: environmentDocs.remediation,
            evidence: facts.requiredEnvironmentVariables.filter((item) => missing.includes(item.value)).map((item) => fileEvidence(item.path, `${item.value} is not documented.`, item.line)), earnedPoints: 0,
          });
    },
  },
  {
    ...setupConsistency,
    evaluate(facts) {
      if (facts.rootManifest === undefined) {
        return skippedFinding(setupConsistency, "No root package.json was detected.");
      }
      const installs = facts.documentationCommands.filter((command) => /\b(?:npm\s+(?:install|ci)|pnpm\s+install|yarn(?:\s+install)?|bun\s+install)\b/i.test(command.raw));
      const canonical = facts.rootManifest.declaredPackageManager ?? facts.lockfiles.find((lockfile) => !lockfile.path.includes("/"))?.packageManager;
      if (installs.length === 0) {
        return result(setupConsistency, {
          status: "fail", confidence: "medium", impact: "Agents lack a documented dependency installation command.",
          recommendation: setupConsistency.remediation, evidence: [fileEvidence("README.md", "No installation command was detected.")], earnedPoints: 0,
        });
      }
      const mismatched = canonical === undefined ? [] : installs.filter((command) => command.packageManager !== canonical);
      return mismatched.length === 0
        ? result(setupConsistency, {
            status: "pass", confidence: canonical === undefined ? "medium" : "high", impact: "Setup guidance agrees with repository package-manager evidence.",
            evidence: installs.map((command) => fileEvidence(command.path, command.raw, command.line)), earnedPoints: 5,
          })
        : result(setupConsistency, {
            status: "fail", confidence: "high", impact: "Following setup documentation can create or modify the wrong lockfile.",
            recommendation: setupConsistency.remediation, evidence: mismatched.map((command) => fileEvidence(command.path, command.raw, command.line)), earnedPoints: 0,
          });
    },
  },
  {
    ...productionSeparation,
    evaluate(facts) {
      if (facts.rootManifest === undefined) {
        return skippedFinding(productionSeparation, "No root package.json was detected.");
      }
      const operations = Object.keys(facts.rootManifest.scripts).filter((name) => /(?:^|:)(?:deploy|publish|release|production|prod)(?:$|:)/i.test(name));
      if (operations.length === 0) {
        return skippedFinding(productionSeparation, "No production operation script was detected.");
      }
      const validation = ["verify", "validate", "check"].map((name) => facts.rootManifest?.scripts[name]).filter((command): command is string => command !== undefined);
      const unsafe = validation.filter((command) => operations.some((operation) => command.includes(operation)));
      return unsafe.length === 0
        ? result(productionSeparation, {
            status: "pass", confidence: "high", impact: "Routine validation does not invoke production operations.",
            evidence: operations.map((name) => fileEvidence(facts.rootManifest?.path ?? "package.json", `Operational script ${name} is separate.`)), earnedPoints: 6,
          })
        : result(productionSeparation, {
            status: "fail", confidence: "high", impact: "An agent validating a change could trigger a production operation.",
            recommendation: productionSeparation.remediation, evidence: unsafe.map((command) => fileEvidence(facts.rootManifest?.path ?? "package.json", command)), earnedPoints: 0,
          });
    },
  },
  {
    ...destructiveCommands,
    evaluate(facts) {
      if (facts.rootManifest === undefined) {
        return skippedFinding(destructiveCommands, "No root package.json was detected.");
      }
      const destructive = Object.entries(facts.rootManifest.scripts).filter(([, command]) => /\brm\s+-rf\b|\b(?:drop|truncate)\b|prisma\s+migrate\s+reset|db(?::|\s+)reset/i.test(command));
      if (destructive.length === 0) {
        return skippedFinding(destructiveCommands, "No destructive script was detected.");
      }
      const unscoped = destructive.filter(([name]) => !/(?:^|:)(?:local|dev|test)(?:$|:)/i.test(name));
      return unscoped.length === 0
        ? result(destructiveCommands, {
            status: "pass", confidence: "medium", impact: "Detected destructive commands are explicitly scoped away from production.",
            evidence: destructive.map(([name, command]) => fileEvidence(facts.rootManifest?.path ?? "package.json", `${name}: ${command}`)), earnedPoints: 6,
          })
        : result(destructiveCommands, {
            status: "fail", confidence: "high", impact: "An agent can invoke a destructive command without an explicit environment boundary.",
            recommendation: destructiveCommands.remediation, evidence: unscoped.map(([name, command]) => fileEvidence(facts.rootManifest?.path ?? "package.json", `${name}: ${command}`)), earnedPoints: 0,
          });
    },
  },
  {
    ...permissionBypass,
    evaluate(facts) {
      return facts.unsafeInstructions.length === 0
        ? result(permissionBypass, {
            status: "pass", confidence: "high", impact: "Repository instructions preserve normal agent permission boundaries.",
            evidence: [fileEvidence("AGENTS.md", "No blanket permission-bypass instruction was detected.")], earnedPoints: 6,
          })
        : result(permissionBypass, {
            status: "fail", confidence: "high", impact: "Agents are instructed to disable safety or approval boundaries.",
            recommendation: permissionBypass.remediation,
            evidence: facts.unsafeInstructions.map((item) => fileEvidence(item.path, item.value, item.line)), earnedPoints: 0,
          });
    },
  },
  {
    ...referencedPaths,
    evaluate(facts) {
      if (facts.pathReferences.length === 0) {
        return skippedFinding(referencedPaths, "No supported local path reference was detected.");
      }
      const missing = facts.pathReferences.filter((reference) => !reference.exists);
      return missing.length === 0
        ? result(referencedPaths, {
            status: "pass", confidence: "high", impact: "Documented source and configuration paths resolve in the repository.",
            evidence: facts.pathReferences.slice(0, 10).map((item) => fileEvidence(item.path, item.value, item.line)), earnedPoints: 5,
          })
        : result(referencedPaths, {
            status: "fail", confidence: "high", impact: "Agents following documentation will navigate to paths that do not exist.",
            recommendation: referencedPaths.remediation, evidence: missing.map((item) => fileEvidence(item.path, item.value, item.line)), earnedPoints: 0,
          });
    },
  },
];
