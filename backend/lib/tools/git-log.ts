import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ToolFactory } from "./types.js";

const exec = promisify(execFile);

export const makeGitLog: ToolFactory = () => ({
  name: "git_log",
  description:
    "Show recent commits in a checked-out repo, optionally scoped to a path. Auto-unshallows if needed.",
  parameters: {
    type: "object",
    properties: {
      repoPath: { type: "string" },
      path: { type: "string", description: "Optional file or directory inside the repo." },
      limit: { type: "number", description: "Max commits (default 20)." },
    },
    required: ["repoPath"],
  },
  handler: async (args: { repoPath: string; path?: string; limit?: number }) => {
    const limit = args.limit ?? 20;
    const logArgs = [
      "-C",
      args.repoPath,
      "log",
      `--max-count=${limit}`,
      "--pretty=format:%h %ad %an %s",
      "--date=short",
    ];
    if (args.path) logArgs.push("--", args.path);
    const run = async () => exec("git", logArgs, { maxBuffer: 10 * 1024 * 1024 });
    try {
      const { stdout } = await run();
      return stdout || "No commits.";
    } catch (e: any) {
      if (/shallow|unknown revision/i.test(e.stderr || "")) {
        await exec("git", ["-C", args.repoPath, "fetch", "--unshallow"]).catch(() => {});
        const retry = await run();
        return retry.stdout || "No commits.";
      }
      return `git log failed: ${e.stderr || e.message}`;
    }
  },
});
