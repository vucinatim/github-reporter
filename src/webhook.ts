import { createHmac } from "node:crypto";
import type { WebhookPayload } from "./types.js";
import { logger } from "./logger.js";

export type WebhookConfig = {
  url?: string;
  secret?: string;
  token?: string;
  channel?: string;
  mode?: "file" | "message" | "both";
  enabled?: boolean;
};

export async function sendWebhook(
  config: WebhookConfig,
  payload: WebhookPayload,
  content?: string
): Promise<void> {
  if (config.enabled === false) return;
  const { url, secret, token, channel, mode } = config;

  // 1. Slack Delivery (Preferred if token/channel present)
  if (token && channel && content) {
    const slackMode = mode ?? "message";
    const filename = `${payload.jobId || "report"}-${payload.window.end}.${
      payload.format === "json" ? "json" : "md"
    }`;
    const initialComment = `*${payload.jobName || payload.jobId}* for ${
      payload.window.start
    } to ${payload.window.end}\nView online: ${payload.artifact.uri}`;

    if (slackMode === "message" || slackMode === "both") {
      await sendSlackMessage(token, channel, content);
    }
    if (slackMode === "file" || slackMode === "both") {
      await sendSlackFile(token, channel, content, filename, initialComment);
    }
    return;
  }

  // 2. Standard Webhook
  if (!url) return;

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (secret) {
    headers["x-signature"] = signPayload(secret, body);
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.warn("webhook.send.failed", {
      status: response.status,
      body: text,
    });
    throw new Error(`Webhook failed: ${response.status} ${text}`);
  }
}

async function sendSlackMessage(token: string, channel: string, content: string) {
  const chunks = splitSlackMessage(content, 38000);
  for (const chunk of chunks) {
    const response = await slackApi("chat.postMessage", token, {
      channel,
      text: chunk,
      mrkdwn: "true"
    });
    if (!response.ok) {
      throw new Error(`Slack message failed: ${response.error ?? "unknown_error"}`);
    }
  }
}

function splitSlackMessage(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return [text];
  }
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > maxLength) {
    let cut = remaining.lastIndexOf("\n", maxLength);
    if (cut <= 0) {
      cut = maxLength;
    }
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut).replace(/^\n+/, "");
  }
  if (remaining.length > 0) {
    chunks.push(remaining);
  }
  return chunks;
}

/**
 * Sends a file to Slack using the external upload flow.
 */
async function sendSlackFile(
  token: string,
  channel: string,
  content: string,
  filename: string,
  initialComment: string
) {
  const length = Buffer.byteLength(content, "utf8");
  const uploadInit = await slackApi("files.getUploadURLExternal", token, {
    filename,
    length: String(length),
  });
  if (!uploadInit.ok || !uploadInit.upload_url || !uploadInit.file_id) {
    throw new Error(
      `Slack upload init failed: ${uploadInit.error ?? "unknown_error"}`
    );
  }

  const uploadUrl = String(uploadInit.upload_url);
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: Buffer.from(content, "utf8"),
  });
  if (!uploadResponse.ok) {
    const uploadText = await uploadResponse.text();
    logger.warn("slack.file.upload.content.failed", {
      status: uploadResponse.status,
      body: uploadText,
    });
    throw new Error(`Slack upload content failed: ${uploadResponse.status}`);
  }

  const complete = await slackApi("files.completeUploadExternal", token, {
    channel_id: channel,
    initial_comment: initialComment,
    files: JSON.stringify([{ id: uploadInit.file_id, title: filename }]),
  });
  if (!complete.ok) {
    throw new Error(
      `Slack upload finalize failed: ${complete.error ?? "unknown_error"}`
    );
  }
}

function signPayload(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

async function slackApi(
  method: string,
  token: string,
  params: Record<string, string>
): Promise<{ ok?: boolean; error?: string; [key: string]: unknown }> {
  const body = new URLSearchParams(params);
  const response = await fetch(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await response.text();
  let result: { ok?: boolean; error?: string; [key: string]: unknown } = {};
  try {
    result = JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    result = { ok: false, error: "non_json_response", raw: text };
  }
  if (!result.ok) {
    const requestId = response.headers.get("x-slack-req-id") ?? undefined;
    logger.warn("slack.api.failed", {
      method,
      error: result.error ?? "unknown_error",
      status: response.status,
      requestId,
      response: result,
    });
  }
  return result;
}
