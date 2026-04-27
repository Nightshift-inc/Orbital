import type { ToolFactory } from "./types.js";

export const makeGithubSearch: ToolFactory = ({ octokit }) => ({
  name: "github_search",
  description:
    "Search code on GitHub using GitHub's code search API. Returns up to 30 matches with repo + path. Use for locating code without cloning. Supports qualifiers like 'org:foo path:*.ts' or 'repo:owner/name'.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description:
          "Code search query, e.g. 'org:github useEffect path:*.ts' or 'repo:owner/name TODO'",
      },
    },
    required: ["query"],
  },
  handler: async (args: { query: string }) => {
    const res = await octokit.rest.search.code({ q: args.query, per_page: 30 });
    if (res.data.items.length === 0) return "No results.";
    return JSON.stringify(
      res.data.items.map((i) => ({
        repo: i.repository.full_name,
        path: i.path,
        url: i.html_url,
      })),
      null,
      2,
    );
  },
});
