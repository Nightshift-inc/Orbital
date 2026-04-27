import type { ToolFactory } from "./types.js";

export const makeFindPrForCommit: ToolFactory = ({ octokit, owner, repo }) => ({
  name: "find_pr_for_commit",
  description:
    "Find the PR(s) that introduced a given commit SHA. Owner/repo default to the bound target.",
  parameters: {
    type: "object",
    properties: {
      owner: { type: "string", description: `Default: ${owner}` },
      repo: { type: "string", description: `Default: ${repo}` },
      sha: { type: "string" },
    },
    required: ["sha"],
  },
  handler: async (args: { owner?: string; repo?: string; sha: string }) => {
    const res = await octokit.request("GET /repos/{owner}/{repo}/commits/{sha}/pulls", {
      owner: args.owner ?? owner,
      repo: args.repo ?? repo,
      sha: args.sha,
    });
    if (res.data.length === 0) return "No PR found for that commit.";
    return JSON.stringify(
      res.data.map((pr: any) => ({
        number: pr.number,
        title: pr.title,
        state: pr.state,
        merged_at: pr.merged_at,
        url: pr.html_url,
      })),
      null,
      2,
    );
  },
});
