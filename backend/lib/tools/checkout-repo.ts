import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ToolFactory } from "./types.js";

const exec = promisify(execFile);

function repoDir(workspace: string, owner: string, repo: string, ref: string) {
  return join(workspace, `${owner}__${repo}__${ref.replace(/[^\w.-]/g, "_")}`);
}

export const makeCheckoutRepo: ToolFactory = ({ owner, repo, workspace, cloneToken }) => ({
  name: "checkout_repo",
  description:
    "Shallow blobless clone of a GitHub repo (metadata + tree only, blobs fetched on demand). Returns the local path. Reuses existing checkout if already cloned. Owner/repo default to the bound target.",
  parameters: {
    type: "object",
    properties: {
      owner: { type: "string", description: `Default: ${owner}` },
      repo: { type: "string", description: `Default: ${repo}` },
      ref: { type: "string", description: "Branch, tag, or SHA. Omit for default branch." },
    },
  },
  handler: async (args: { owner?: string; repo?: string; ref?: string }) => {
    const o = args.owner ?? owner;
    const r = args.repo ?? repo;
    const ref = args.ref || "default";
    const dir = repoDir(workspace, o, r, ref);
    if (existsSync(dir)) return `Already checked out: ${dir}`;
    const url = `https://github.com/${o}/${r}.git`;
    const cloneArgs: string[] = [];
    if (cloneToken) {
      cloneArgs.push("-c", `http.extraheader=Authorization: Bearer ${cloneToken}`);
    }
    cloneArgs.push("clone", "--filter=blob:none", "--depth=1");
    if (args.ref) cloneArgs.push("--branch", args.ref);
    cloneArgs.push(url, dir);
    try {
      await exec("git", cloneArgs, { maxBuffer: 50 * 1024 * 1024 });
    } catch (e: any) {
      return `Clone failed: ${e.stderr || e.message}`;
    }
    return `Checked out to: ${dir}`;
  },
});
