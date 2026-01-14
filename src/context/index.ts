import { Octokit } from "@octokit/rest";
import type { AppConfig } from "../config.js";
import type { ActivityWindow, RateLimitInfo, RepoActivity } from "../types.js";
import type { ContextLogger } from "../logger.js";
import { withRetry } from "../retry.js";
import { diffSummaryProvider } from "./providers/diff-summary.js";
import { diffSnippetsProvider } from "./providers/diff-snippets.js";
import { issuesProvider } from "./providers/issues.js";
import { llmTxtProvider } from "./providers/llm-txt.js";
import { pullRequestsProvider } from "./providers/pull-requests.js";
import { readmeProvider } from "./providers/readme.js";
import { repoOverviewProvider } from "./providers/repo-overview.js";
import type { ContextProvider } from "./types.js";

const providers: ContextProvider[] = [
  repoOverviewProvider,
  readmeProvider,
  llmTxtProvider,
  diffSummaryProvider,
  diffSnippetsProvider,
  pullRequestsProvider,
  issuesProvider
];

export async function enrichReposWithContext(args: {
  repos: RepoActivity[];
  window: ActivityWindow;
  config: AppConfig;
  rateLimit: RateLimitInfo;
  logger: ContextLogger;
  providerAllowlist?: string[];
  dataProfile?: "minimal" | "standard" | "full";
}) {
  const dataProfile = args.dataProfile ?? "standard";
  
  if (dataProfile === "minimal") {
    return [];
  }

  const octokit = new Octokit({
    auth: args.config.github.token
  });

  const results: {
    name: string;
    ok: boolean;
    durationMs?: number;
    error?: string;
  }[] = [];

  // Filter providers based on dataProfile
  let filteredProviders = providers;
  if (dataProfile === "standard") {
    // High-level context: Diff Summary, Issues, PRs
    filteredProviders = providers.filter(p => 
      ["repo-overview", "readme", "diff-summary", "pull-requests", "issues"].includes(p.name)
    );
  } else if (dataProfile === "full") {
    // Standard + Code-heavy context: LLM.txt, Snippets
    filteredProviders = providers; 
  }

  const allowed =
    args.providerAllowlist && args.providerAllowlist.length > 0
      ? filteredProviders.filter((provider) =>
          args.providerAllowlist?.includes(provider.name)
        )
      : filteredProviders;


  for (const provider of allowed) {
    const start = Date.now();
    try {
      await withRetry(
        () =>
          provider.run({
            octokit,
            repos: args.repos,
            window: args.window,
            config: args.config,
            rateLimit: args.rateLimit
          }),
        {
          retries: args.config.network.retryCount,
          backoffMs: args.config.network.retryBackoffMs
        }
      );
      results.push({
        name: provider.name,
        ok: true,
        durationMs: args.config.logging.includeTimings
          ? Date.now() - start
          : undefined
      });
    } catch (error) {
      results.push({
        name: provider.name,
        ok: false,
        durationMs: args.config.logging.includeTimings
          ? Date.now() - start
          : undefined,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return results;
}
