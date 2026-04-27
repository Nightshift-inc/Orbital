import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolFactory } from "./types.js";

const exec = promisify(execFile);

export const makeRipgrep: ToolFactory = () => ({
  name: "ripgrep",
  description:
    "Search inside a checked-out repo with ripgrep. Use after checkout_repo. Returns up to 5 matches per file as file:line:content.",
  parameters: {
    type: "object",
    properties: {
      repoPath: { type: "string", description: "Local path returned by checkout_repo." },
      pattern: { type: "string", description: "Regex pattern (case-smart by default)." },
      glob: {
        type: "string",
        description: "Optional glob filter, e.g. '*.ts' or '!**/test/**'.",
      },
    },
    required: ["repoPath", "pattern"],
  },
  handler: async (args: { repoPath: string; pattern: string; glob?: string }) => {
    const rgArgs = ["--no-heading", "--line-number", "-S", "--max-count", "5"];
    if (args.glob) rgArgs.push("--glob", args.glob);
    rgArgs.push(args.pattern, args.repoPath);
    try {
      const { stdout } = await exec("rg", rgArgs, { maxBuffer: 10 * 1024 * 1024 });
      return stdout || "No matches.";
    } catch (e: any) {
      if (e.code === 1) return "No matches.";
      return `Search failed: ${e.stderr || e.message}`;
    }
  },
});
