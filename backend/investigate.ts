#!/usr/bin/env tsx

import { CopilotClient, approveAll } from "@github/copilot-sdk";
import { Octokit } from "octokit";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import * as readline from "node:readline";
import { buildInvestigationTools } from "./lib/tools/index.js";

function getGhToken(): string {
    if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
    try {
        return execFileSync("gh", ["auth", "token"], { encoding: "utf-8" }).trim();
    } catch {
        throw new Error("No GitHub token. Set GITHUB_TOKEN or run `gh auth login`.");
    }
}

function parseArgs(): { repo?: string } {
    const args = process.argv.slice(2);
    const i = args.indexOf("--repo");
    if (i !== -1 && args[i + 1]) return { repo: args[i + 1] };
    return {};
}

function detectRemoteRepo(): string | null {
    try {
        const url = execFileSync("git", ["remote", "get-url", "origin"], {
            encoding: "utf-8",
        }).trim();
        const ssh = url.match(/git@github\.com:(.+\/.+?)(?:\.git)?$/);
        if (ssh) return ssh[1];
        const https = url.match(/https:\/\/github\.com\/(.+\/.+?)(?:\.git)?$/);
        if (https) return https[1];
    } catch {}
    return null;
}

async function promptForRepo(): Promise<string> {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise((res) => {
        rl.question("Target repo (owner/name): ", (a) => {
            rl.close();
            res(a.trim());
        });
    });
}

async function resolveTargetRepo(): Promise<{ owner: string; repo: string }> {
    const cli = parseArgs().repo;
    const detected = cli ?? detectRemoteRepo();
    const raw = detected ?? (await promptForRepo());
    if (!raw || !raw.includes("/")) {
        throw new Error(`Invalid repo "${raw}". Expected owner/name.`);
    }
    const [owner, repo] = raw.split("/");
    return { owner, repo };
}

const token = getGhToken();
const octokit = new Octokit({ auth: token });

const WORKSPACE = resolve(".investigations");
mkdirSync(WORKSPACE, { recursive: true });

const { owner, repo } = await resolveTargetRepo();

const tools = buildInvestigationTools({
    octokit,
    owner,
    repo,
    workspace: WORKSPACE,
    cloneToken: token,
});

const client = new CopilotClient({ logLevel: "error" });

const session = await client.createSession({
    onPermissionRequest: approveAll,
    model: "gpt-5.4",
    tools,
    systemMessage: {
        content: `
<context>
You are an investigation agent for exploring code and incidents across GitHub repositories.
Bound target repo: ${owner}/${repo} (used as default for all GitHub tools).
Workspace for clones: ${WORKSPACE}
</context>

<instructions>
- Default to the bound target repo. The user may override per-call by passing owner/repo explicitly.
- Triage flow for incidents: get_app_errors → get_deploy_log → get_recent_prs → find_pr_for_commit.
- Use get_service_map (on a checked-out repo) to scope blast radius and identify owning services.
- Prefer github_search to locate code across repos before cloning.
- Use checkout_repo only when you need to read files or run deep regex searches; then ripgrep + git_log.
- Always cite repo + path + line (or PR/run URL) when reporting findings.
- Be concise.
</instructions>
`,
    },
});

session.on((event) => {
    if (event.type === "assistant.message") {
        console.log(`\n${event.data.content}\n`);
    } else if (event.type === "tool.execution_start") {
        console.log(`  -> ${event.data.toolName}`);
    }
});

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = () => {
    rl.question("investigate> ", async (input) => {
        const t = input.trim();
        if (t === "exit" || t === "quit") {
            rl.close();
            await session.destroy();
            await client.stop();
            process.exit(0);
        }
        if (t) await session.sendAndWait({ prompt: t });
        ask();
    });
};

console.log(`Investigation agent ready. Bound to ${owner}/${repo}.`);
console.log(
    "Tools: " + tools.map((t) => t.name).join(", "),
);
console.log("Type a question, or 'exit' to quit.\n");
ask();
