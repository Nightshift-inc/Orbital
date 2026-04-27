import { EventEmitter } from "events";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createInvestigationSession } from "./copilot.js";
import { buildInvestigationTools } from "./tools/index.js";
import type { CopilotSession } from "@github/copilot-sdk";
import type { Octokit } from "octokit";

export const investigationBus = new EventEmitter();

const WORKSPACE = resolve(process.env.INVESTIGATION_WORKSPACE ?? ".investigations");
mkdirSync(WORKSPACE, { recursive: true });

interface RunArgs {
  investigationId: string;
  octokit: Octokit;
  repoOwner: string;
  repoName: string;
  triggerPrNumber: number;
  triggerSha: string;
  /**
   * Token usable for `git clone` of private repos. For App-installed flows,
   * pass the installation access token; for CLI flows, a PAT.
   */
  cloneToken?: string;
  /** When true, skip writing to GitHub (no Issue creation). */
  dryRun?: boolean;
}

// Wraps sendAndWait to tee streaming tokens into the investigation bus.
// Stream A (SDK token events) → Stream B (application event bus).
async function teeAgentCall(args: {
  bus: EventEmitter;
  investigationId: string;
  role: "root" | "child";
  service?: string;
  session: CopilotSession;
  prompt: string;
}): Promise<string> {
  const buf: string[] = [];

  const unsubscribe = args.session.on("assistant.message_delta", (event) => {
    const chunk = event.data.deltaContent;
    buf.push(chunk);
    args.bus.emit(args.investigationId, {
      type: "agent.token",
      role: args.role,
      service: args.service,
      text: chunk,
      ts: Date.now(),
    });
  });

  try {
    await args.session.sendAndWait({ prompt: args.prompt });
  } finally {
    unsubscribe();
  }

  return buf.join("");
}

export async function runInvestigation(args: RunArgs): Promise<void> {
  const emit = (type: string, data: unknown) =>
    investigationBus.emit(args.investigationId, { type, data, ts: Date.now() });

  emit("started", { trigger: args.triggerPrNumber });

  const tools = buildInvestigationTools({
    octokit: args.octokit,
    owner: args.repoOwner,
    repo: args.repoName,
    workspace: WORKSPACE,
    cloneToken: args.cloneToken,
  });

  const root = await createInvestigationSession({
    model: "claude-sonnet-4.5",
    systemPrompt: ROOT_AGENT_PROMPT,
    tools,
  });
  emit("agent.spawned", { role: "root", model: "claude-sonnet-4.5" });

  try {
    // Step 1: root identifies affected services
    const planText = await teeAgentCall({
      bus: investigationBus,
      investigationId: args.investigationId,
      role: "root",
      session: root,
      prompt:
        `An incident triggered at PR #${args.triggerPrNumber}. ` +
        `Identify affected services and decide which child investigators to spawn.`,
    });
    emit("agent.thinking", { role: "root", text: planText });

    // Step 2: spawn child sessions in parallel for each affected service
    // TODO: parse planText to extract service names; hardcoded for now
    const childServices = ["auth-service"];
    const childSessions = await Promise.all(
      childServices.map(async (svc) => {
        const child = await createInvestigationSession({
          model: "claude-sonnet-4.5",
          systemPrompt: childPromptFor(svc),
          tools,
        });
        emit("agent.spawned", { role: "child", service: svc, model: "claude-sonnet-4.5" });
        return { svc, session: child };
      }),
    );

    // Step 3: run children in parallel, collect findings
    const findings = await Promise.all(
      childSessions.map(async ({ svc, session }) => {
        const text = await teeAgentCall({
          bus: investigationBus,
          investigationId: args.investigationId,
          role: "child",
          service: svc,
          session,
          prompt: `Investigate ${svc}. Use your tools to find the most likely cause.`,
        });
        emit("agent.findings", { service: svc, findings: text });
        return { svc, findings: text };
      }),
    );

    // Step 4: root synthesizes the report
    const finalReport = await teeAgentCall({
      bus: investigationBus,
      investigationId: args.investigationId,
      role: "root",
      session: root,
      prompt: `Synthesize child findings into a final report:\n${JSON.stringify(findings)}`,
    });
    emit("report.complete", { report: finalReport, confidence: 90 });

    // Step 5: post to GitHub
    if (args.dryRun) {
      emit("github.issue.skipped", {
        reason: "dry-run",
        title: `Blackbox: incident at PR #${args.triggerPrNumber}`,
      });
    } else {
      const issue = await args.octokit.rest.issues.create({
        owner: args.repoOwner,
        repo: args.repoName,
        title: `Blackbox: incident at PR #${args.triggerPrNumber}`,
        body: finalReport,
      });
      emit("github.issue.created", { url: issue.data.html_url, number: issue.data.number });
    }

    // Cleanup — disconnect (not destroy, which is deprecated)
    await root.disconnect();
    await Promise.all(childSessions.map(({ session }) => session.disconnect()));
  } catch (err) {
    emit("error", { message: String(err) });
    await root.disconnect().catch(() => {});
    throw err;
  }
}

const ROOT_AGENT_PROMPT = `You are the root investigator for Blackbox, an incident-forensics service.
Your job is to determine which recent PR caused a production incident.

Standard triage flow:
1. get_app_errors  — what's actually broken (bug-labeled issues + failed workflow runs)
2. get_deploy_log  — what shipped recently and to which environments
3. get_recent_prs  — PRs that landed near the incident time
4. find_pr_for_commit — attribute a SHA to a PR
5. get_service_map (after checkout_repo) — scope blast radius and identify owning services

Identify which services were likely affected and name them so child investigators can dig deeper.
Be concise. When listing services for child spawn, put one service name per line.`;

function childPromptFor(svc: string) {
  return `You are a child investigator for Blackbox focused on the ${svc} service.
Use checkout_repo + ripgrep + git_log to examine recent changes scoped to ${svc}.
Cross-reference with get_recent_prs and find_pr_for_commit to attribute changes.
Report the most likely cause of the incident with specific evidence (repo, path, line, PR URL).`;
}
