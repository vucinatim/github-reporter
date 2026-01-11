import { Octokit } from "@octokit/rest";
import type { AppConfig } from "./config.js";
import { formatTimestamp, logger } from "./logger.js";
import { describeStorage, validateStorage } from "./storage.js";

export async function runHealthCheck(config: AppConfig) {
  const healthLogger = logger.withContext({
    owner: config.github.owner,
    ownerType: config.github.ownerType
  });

  healthLogger.info("health.start", {
    storage: describeStorage(config.storage)
  });

  await validateStorage(config.storage);
  healthLogger.info("health.storage.ok");

  const octokit = new Octokit({ auth: config.github.token });
  try {
    const response = await octokit.request("GET /rate_limit");
    const core = response.data.resources.core;
    healthLogger.info("health.github.ok", {
      remaining: core.remaining,
      limit: core.limit,
      resetAt: formatTimestamp(
        new Date(core.reset * 1000),
        config.logging.timeZone
      )
    });
  } catch (error) {
    const status = (error as { status?: number }).status;
    const message = error instanceof Error ? error.message : String(error);
    healthLogger.error("health.github.error", { status, message });
    throw new Error(
      `GitHub validation failed${status ? ` (${status})` : ""}: ${message}`
    );
  }

  healthLogger.info("health.ok");
}
