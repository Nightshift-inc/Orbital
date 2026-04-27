import type { ToolFactory } from "./types.js";

export const makeGetRecentPrs: ToolFactory = ({ octokit, owner, repo }) => ({
  name: "get_recent_prs",
  description:
    "List recent pull requests for the bound repo. Useful first step in attribution: which PRs landed near an incident time. Returns number, title, state, merged_at, author, head SHA, base, URL.",
  parameters: {
    type: "object",
    properties: {
      state: {
        type: "string",
        enum: ["open", "closed", "all"],
        description: "Default 'closed' (most useful for incident attribution).",
      },
      limit: { type: "number", description: "Max PRs to return (default 20, max 100)." },
      since: {
        type: "string",
        description: "ISO8601 timestamp; only return PRs updated after this.",
      },
      author: { type: "string", description: "Filter by GitHub username." },
    },
  },
  handler: async (args: {
    state?: "open" | "closed" | "all";
    limit?: number;
    since?: string;
    author?: string;
  }) => {
    const limit = Math.min(args.limit ?? 20, 100);
    const res = await octokit.rest.pulls.list({
      owner,
      repo,
      state: args.state ?? "closed",
      per_page: limit,
      sort: "updated",
      direction: "desc",
    });
    let items = res.data;
    if (args.since) {
      const t = Date.parse(args.since);
      items = items.filter((p) => Date.parse(p.updated_at) >= t);
    }
    if (args.author) items = items.filter((p) => p.user?.login === args.author);
    if (items.length === 0) return "No PRs match.";
    return JSON.stringify(
      items.map((p) => ({
        number: p.number,
        title: p.title,
        state: p.merged_at ? "merged" : p.state,
        author: p.user?.login,
        head_sha: p.head.sha,
        base: p.base.ref,
        merged_at: p.merged_at,
        updated_at: p.updated_at,
        url: p.html_url,
      })),
      null,
      2,
    );
  },
});
