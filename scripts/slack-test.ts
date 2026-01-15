import { loadConfig } from "../src/config.js";
import { sendWebhook } from "../src/webhook.js";
import type { WebhookPayload } from "../src/types.js";

async function main() {
  const config = loadConfig();
  const { token, channel } = config.webhook;
  if (!token || !channel) {
    throw new Error("Missing SLACK_TOKEN or SLACK_CHANNEL in .env.");
  }

  const auth = await slackApi("auth.test", token);
  console.log("auth.test", auth);

  const channelInfo = await slackApi("conversations.info", token, {
    channel
  });
  console.log("conversations.info", channelInfo);
  const postMessage = await slackApi("chat.postMessage", token, {
    channel,
    text: "Slack test: basic message post."
  });
  console.log("chat.postMessage", postMessage);

  const now = new Date();
  const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  const payload: WebhookPayload = {
    owner: config.github.owner,
    ownerType: config.github.ownerType,
    jobId: "slack-test",
    jobName: "Slack Test",
    window: { start, end },
    artifact: {
      key: "slack-test",
      uri: "local://slack-test",
      size: 0
    },
    format: "markdown",
    createdAt: now.toISOString()
  };

  const content = [
    "# Slack Test",
    "",
    "If you can read this, Slack upload works.",
    "",
    `Time: ${now.toISOString()}`
  ].join("\n");

  await sendWebhook(config.webhook, payload, content);
  console.log("Slack test file sent.");
}

async function slackApi(
  method: string,
  token: string,
  params: Record<string, string> = {}
) {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });
  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { ok: false, error: "non_json_response", raw: text };
  }
  return {
    status: response.status,
    requestId: response.headers.get("x-slack-req-id") ?? undefined,
    data
  };
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
