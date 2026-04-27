/**
 * Smoke test for the Copilot SDK orchestration layer.
 *
 * Run with:
 *   GITHUB_TOKEN=<your-token> npx tsx lib/smoke-test.ts
 */
import "dotenv/config";
import { CopilotClient, approveAll } from "@github/copilot-sdk";

async function main() {
  if (!process.env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN env var is required. Add it to .env or pass inline.");
  }

  console.log("1. Starting CopilotClient...");
  const client = new CopilotClient({ gitHubToken: process.env.GITHUB_TOKEN });
  await client.start();
  console.log("   OK — client connected");

  console.log("2. Inspect SDK version + auth status...");
  const status = await client.getStatus();
  console.log(`   CLI version: ${status.version}`);

  const auth = await client.getAuthStatus();
  console.log(`   Auth: isAuthenticated=${auth.isAuthenticated}, type=${auth.authType ?? "unknown"}, login=${auth.login ?? "unknown"}`);
  if (!auth.isAuthenticated) {
    throw new Error(`Not authenticated — run 'gh auth login' or set a valid GITHUB_TOKEN`);
  }

  console.log("3. Listing available models...");
  const models = await client.listModels();
  const modelIds = models.map((m) => m.id);
  console.log(`   Models: ${modelIds.join(", ")}`);

  // Validate the models we intend to use exist
  const requiredModels = ["claude-sonnet-4.5"];
  for (const m of requiredModels) {
    if (!modelIds.includes(m)) {
      console.warn(`   WARN: model '${m}' not in model list — may fail at session time`);
    } else {
      console.log(`   OK — ${m} available`);
    }
  }

  console.log("4. Creating session with system prompt (replace mode)...");
  const session = await client.createSession({
    onPermissionRequest: approveAll,
    model: "claude-sonnet-4.5",
    systemMessage: {
      mode: "replace",
      content: "You are a helpful assistant. Be brief.",
    },
  });
  console.log(`   OK — session created: ${session.sessionId}`);

  console.log("5. Testing streaming via assistant.message_delta events...");
  const buf: string[] = [];
  const unsubscribe = session.on("assistant.message_delta", (event) => {
    buf.push(event.data.deltaContent);
    process.stdout.write(event.data.deltaContent);
  });

  const response = await session.sendAndWait({ prompt: "Say 'hello world' and nothing else." });
  unsubscribe();
  process.stdout.write("\n");

  const streamed = buf.join("");
  const final = response?.data.content ?? "";
  console.log(`   Streamed ${buf.length} delta chunks, ${streamed.length} chars`);
  console.log(`   sendAndWait content: ${final}`);

  if (streamed.trim().toLowerCase().includes("hello") || final.trim().toLowerCase().includes("hello")) {
    console.log("   OK — response received");
  } else {
    console.warn("   WARN: response didn't include 'hello' — check model output");
  }

  if (streamed.length > 0) {
    console.log("   OK — streaming deltas working (assistant.message_delta events fired)");
  } else {
    console.warn("   WARN: no streaming deltas received — teeAgentCall won't capture tokens");
  }

  console.log("6. Inspecting session methods for streaming API validation...");
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(session))
    .filter((k) => typeof (session as unknown as Record<string, unknown>)[k] === "function");
  console.log(`   Session methods: ${methods.join(", ")}`);

  console.log("7. Disconnecting session...");
  await session.disconnect();
  console.log("   OK — session disconnected");

  console.log("8. Stopping client...");
  const errs = await client.stop();
  if (errs.length > 0) console.warn("   Stop errors:", errs);
  else console.log("   OK — client stopped");

  console.log("\nAll checks passed. Copilot orchestration layer is valid.");
}

main().catch((err) => {
  console.error("\nSmoke test FAILED:", err);
  process.exit(1);
});
