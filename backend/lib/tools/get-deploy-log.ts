import type { ToolFactory } from "./types.js";

export const makeGetDeployLog: ToolFactory = ({ octokit, owner, repo }) => ({
  name: "get_deploy_log",
  description:
    "Recent deploy events for the bound repo. Combines GitHub Deployments API with Actions workflow runs whose names look like deploys (deploy/release/publish/cd). Returns chronological events with status and SHA so you can correlate failures with PRs.",
  parameters: {
    type: "object",
    properties: {
      environment: {
        type: "string",
        description: "Filter by deployment environment (e.g. 'production').",
      },
      branch: {
        type: "string",
        description: "Filter workflow runs to this branch.",
      },
      limit: { type: "number", description: "Max events (default 20, max 100)." },
    },
  },
  handler: async (args: { environment?: string; branch?: string; limit?: number }) => {
    const limit = Math.min(args.limit ?? 20, 100);
    type Event = {
      source: "deployment" | "workflow_run";
      created_at: string;
      status: string;
      ref: string;
      sha: string;
      name: string;
      environment?: string;
      url: string;
    };
    const events: Event[] = [];

    try {
      const dep = await octokit.rest.repos.listDeployments({
        owner,
        repo,
        environment: args.environment,
        per_page: limit,
      });
      for (const d of dep.data) {
        const statuses = await octokit.rest.repos
          .listDeploymentStatuses({ owner, repo, deployment_id: d.id, per_page: 1 })
          .catch(() => null);
        const latest = statuses?.data[0];
        events.push({
          source: "deployment",
          created_at: d.created_at,
          status: latest?.state ?? "pending",
          ref: d.ref,
          sha: d.sha,
          name: d.task ?? "deploy",
          environment: d.environment,
          url: latest?.target_url ?? d.url,
        });
      }
    } catch {
      // Deployments API may be empty or unavailable on some repos; continue.
    }

    try {
      const runs = await octokit.rest.actions.listWorkflowRunsForRepo({
        owner,
        repo,
        per_page: limit,
        branch: args.branch,
      });
      const deployish = /deploy|release|publish|\bcd\b/i;
      for (const r of runs.data.workflow_runs) {
        if (!deployish.test(r.name ?? "")) continue;
        events.push({
          source: "workflow_run",
          created_at: r.created_at,
          status: r.conclusion ?? r.status ?? "unknown",
          ref: r.head_branch ?? "",
          sha: r.head_sha,
          name: r.name ?? "workflow",
          url: r.html_url,
        });
      }
    } catch {}

    if (events.length === 0) return "No deploy events found.";
    events.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
    return JSON.stringify(events.slice(0, limit), null, 2);
  },
});
