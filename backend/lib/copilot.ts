import { CopilotClient, approveAll } from "@github/copilot-sdk";
import type { ToolDef } from "./tools/index.js";

let client: CopilotClient | null = null;

export async function getCopilotClient(): Promise<CopilotClient> {
  if (!client) {
    client = new CopilotClient({ gitHubToken: process.env.GITHUB_TOKEN });
    await client.start();
  }
  return client;
}

export async function shutdownCopilot(): Promise<void> {
  if (client) {
    await client.stop();
    client = null;
  }
}

export async function createInvestigationSession(opts: {
  model: string;
  systemPrompt: string;
  tools?: ToolDef[];
}) {
  const c = await getCopilotClient();
  const session = await c.createSession({
    onPermissionRequest: approveAll,
    model: opts.model,
    tools: opts.tools,
    systemMessage: {
      mode: "replace",
      content: opts.systemPrompt,
    },
  });
  return session;
}
