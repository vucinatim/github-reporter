import type { ContextProvider } from "../types.js";
import { ensureContext } from "../utils.js";
import { updateRateLimit } from "../../github-rate-limit.js";
import type { IssueSummary } from "../../types.js";

export const issuesProvider: ContextProvider = {
  name: "issues",
  async run({ octokit, repos, config, rateLimit, window }) {
    if (!config.context.includeIssues) return;

    for (const repo of repos) {
      const items: IssueSummary[] = [];
      const iterator = octokit.paginate.iterator(
        octokit.issues.listForRepo,
        {
          owner: config.github.owner,
          repo: repo.repo.name,
          state: "all",
          since: window.start,
          per_page: config.github.perPage
        }
      );

      for await (const response of iterator) {
        updateRateLimit(rateLimit, response.headers as Record<string, string>);
        const data = response.data ?? [];
        for (const issue of data) {
          if (issue.pull_request) continue;
          const inWindow = isWithinWindow(issue, window.start, window.end);
          if (!inWindow) continue;
          items.push({
            number: issue.number,
            title: issue.title,
            url: issue.html_url,
            state: issue.state,
            author: issue.user?.login ?? null,
            createdAt: issue.created_at,
            closedAt: issue.closed_at ?? null
          });
          if (items.length >= config.context.maxIssuesPerRepo) break;
        }
        if (items.length >= config.context.maxIssuesPerRepo) break;
      }

      if (items.length > 0) {
        const context = ensureContext(repo);
        context.issues = items;
      }
    }
  }
};

function isWithinWindow(
  issue: { created_at: string; closed_at: string | null },
  start: string,
  end: string
) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const createdAt = new Date(issue.created_at);
  if (createdAt >= startDate && createdAt <= endDate) return true;
  if (issue.closed_at) {
    const closedAt = new Date(issue.closed_at);
    if (closedAt >= startDate && closedAt <= endDate) return true;
  }
  return false;
}
