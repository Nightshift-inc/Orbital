/**
 * Smoke test for the investigation tool registry.
 *
 * Verifies that every factory in lib/tools/ builds, returns a valid ToolDef
 * shape, and is wired into buildInvestigationTools(). Does NOT invoke
 * handlers — those hit GitHub. Run with:
 *
 *   npx tsx lib/tools-smoke-test.ts
 */
import type { Octokit } from "octokit";
import { buildInvestigationTools } from "./tools/index.js";
import type { ToolDef } from "./tools/index.js";

const EXPECTED_TOOLS = [
  "github_search",
  "checkout_repo",
  "ripgrep",
  "git_log",
  "find_pr_for_commit",
  "get_recent_prs",
  "get_deploy_log",
  "get_app_errors",
  "get_service_map",
];

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assertion failed: ${msg}`);
}

function validateShape(tool: ToolDef) {
  assert(typeof tool.name === "string" && tool.name.length > 0, `tool.name must be non-empty string`);
  assert(/^[a-z][a-z0-9_]*$/.test(tool.name), `tool.name "${tool.name}" must be snake_case`);
  assert(typeof tool.description === "string" && tool.description.length > 10, `${tool.name}.description must be a meaningful string`);
  assert(tool.parameters && tool.parameters.type === "object", `${tool.name}.parameters.type must be "object"`);
  assert(tool.parameters.properties && typeof tool.parameters.properties === "object", `${tool.name}.parameters.properties must be an object`);
  assert(typeof tool.handler === "function", `${tool.name}.handler must be a function`);
}

async function main() {
  console.log("1. Building tool registry with stub deps...");
  const stubOctokit = {} as Octokit;
  const tools = buildInvestigationTools({
    octokit: stubOctokit,
    owner: "stub-owner",
    repo: "stub-repo",
    workspace: "/tmp/blackbox-smoke",
    cloneToken: "stub-token",
  });
  console.log(`   OK — ${tools.length} tools built`);

  console.log("2. Validating ToolDef shape on every tool...");
  for (const t of tools) validateShape(t);
  console.log(`   OK — all ${tools.length} tools pass shape validation`);

  console.log("3. Checking name uniqueness...");
  const names = tools.map((t) => t.name);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert(dupes.length === 0, `duplicate tool names: ${dupes.join(", ")}`);
  console.log(`   OK — names unique`);

  console.log("4. Checking registry matches expected set...");
  const got = new Set(names);
  const expected = new Set(EXPECTED_TOOLS);
  const missing = [...expected].filter((n) => !got.has(n));
  const extra = [...got].filter((n) => !expected.has(n));
  assert(missing.length === 0, `missing from registry: ${missing.join(", ")}`);
  assert(extra.length === 0, `unexpected in registry (update EXPECTED_TOOLS): ${extra.join(", ")}`);
  console.log(`   OK — registry matches expected set: ${[...got].sort().join(", ")}`);

  console.log("5. Spot-check: required params declared correctly...");
  const requiredByName: Record<string, string[]> = {
    github_search: ["query"],
    ripgrep: ["repoPath", "pattern"],
    git_log: ["repoPath"],
    find_pr_for_commit: ["sha"],
    get_service_map: ["repoPath"],
  };
  for (const [name, req] of Object.entries(requiredByName)) {
    const tool = tools.find((t) => t.name === name);
    assert(tool, `tool ${name} not found`);
    const actual = tool.parameters.required ?? [];
    for (const p of req) {
      assert(actual.includes(p), `${name} should require "${p}", got [${actual.join(", ")}]`);
    }
  }
  console.log("   OK — required params look correct");

  console.log("\nAll registry checks passed.");
}

main().catch((err) => {
  console.error("\nTool smoke test FAILED:", err);
  process.exit(1);
});
