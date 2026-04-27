import type { ToolFactory } from "./types.js";

export const makeGetAppErrors: ToolFactory = ({ octokit, owner, repo }) => ({
  name: "get_app_errors",
  description:
    "Recent application errors for the bound repo, drawn from two GitHub-native sources: (1) Issues labeled bug/incident/error/outage opened recently, (2) failed workflow runs (CI/deploy failures). Use to surface what's actually broken before tracing back to PRs.",
  parameters: {
    type: "object",
    properties: {
      since: {
        type: "string",
        description: "ISO8601; only events after this timestamp (default: 7 days ago).",
      },
      limit: { type: "number", description: "Max items per source (default 20, max 100)." },
    },
  },
  handler: async (args: { since?: string; limit?: number }) => {
    const limit = Math.min(args.limit ?? 20, 100);
    const since = args.since ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const sinceDate = since.split("T")[0];

    const errorLabels = ["bug", "incident", "error", "outage", "p0", "p1"];
    const labelQ = errorLabels.map((l) => `label:"${l}"`).join(" ");
    const issuesRes = await octokit.rest.search
      .issuesAndPullRequests({
        q: `repo:${owner}/${repo} is:issue ${labelQ} created:>=${sinceDate}`,
        per_page: limit,
        sort: "created",
        order: "desc",
      })
      .catch(() => null);

    const issues = (issuesRes?.data.items ?? []).map((i) => ({
      kind: "issue" as const,
      number: i.number,
      title: i.title,
      state: i.state,
      labels: i.labels.map((l: any) => (typeof l === "string" ? l : l.name)),
      created_at: i.created_at,
      url: i.html_url,
    }));

    const runsRes = await octokit.rest.actions
      .listWorkflowRunsForRepo({
        owner,
        repo,
        status: "failure",
        per_page: limit,
        created: `>=${sinceDate}`,
      })
      .catch(() => null);
    const failures = (runsRes?.data.workflow_runs ?? []).map((r) => ({
      kind: "workflow_failure" as const,
      name: r.name,
      conclusion: r.conclusion,
      head_branch: r.head_branch,
      head_sha: r.head_sha,
      created_at: r.created_at,
      url: r.html_url,
    }));

    if (issues.length === 0 && failures.length === 0) {
      return "No recent error signals (no bug-labeled issues, no workflow failures).";
    }
    return JSON.stringify({ issues, workflow_failures: failures }, null, 2);
  },
});
