import type { ContextProvider } from "../types.js";
import { ensureContext } from "../utils.js";
import { updateRateLimit } from "../../github-rate-limit.js";
import type { PullRequestSummary } from "../../types.js";

export const pullRequestsProvider: ContextProvider = {
  name: "pull-requests",
  async run({ octokit, repos, config, rateLimit, window }) {
    if (!config.context.includePullRequests) return;

    for (const repo of repos) {
      const items: PullRequestSummary[] = [];
      const iterator = octokit.paginate.iterator(
        octokit.pulls.list,
        {
          owner: config.github.owner,
          repo: repo.repo.name,
          state: "all",
          sort: "updated",
          direction: "desc",
          per_page: config.github.perPage
        }
      );

      for await (const response of iterator) {
        updateRateLimit(rateLimit, response.headers as Record<string, string>);
        const data = response.data ?? [];
        for (const pr of data) {
          const updatedAt = pr.updated_at ? new Date(pr.updated_at) : null;
          if (updatedAt && updatedAt < new Date(window.start)) {
            break;
          }
          const inWindow = isWithinWindow(pr, window.start, window.end);
          if (!inWindow) continue;

          const details = config.context.includePullRequestDetails
            ? await octokit.pulls.get({
                owner: config.github.owner,
                repo: repo.repo.name,
                pull_number: pr.number
              })
            : null;
          if (details) {
            updateRateLimit(rateLimit, details.headers as Record<string, string>);
          }

          items.push({
            number: pr.number,
            title: pr.title,
            url: pr.html_url,
            state: pr.state,
            author: pr.user?.login ?? null,
            reviewers: pr.requested_reviewers?.map((reviewer) => reviewer.login) ?? [],
            labels: pr.labels?.map((label) => label.name) ?? [],
            mergedBy: details?.data.merged_by?.login ?? null,
            reviewsCount: details?.data.review_comments ?? 0,
            filesChanged: details?.data.changed_files ?? 0,
            additions: details?.data.additions ?? 0,
            deletions: details?.data.deletions ?? 0,
            createdAt: pr.created_at,
            mergedAt: pr.merged_at ?? null,
            closedAt: pr.closed_at ?? null
          });
          if (items.length >= config.context.maxPullRequestsPerRepo) break;
        }
        if (items.length >= config.context.maxPullRequestsPerRepo) break;
        const last = data[data.length - 1];
        const lastUpdated = last?.updated_at ? new Date(last.updated_at) : null;
        if (lastUpdated && lastUpdated < new Date(window.start)) break;
      }

      if (items.length > 0) {
        const context = ensureContext(repo);
        context.pullRequests = items;
      }
    }
  }
};

function isWithinWindow(
  pr: {
    created_at: string;
    closed_at: string | null;
    merged_at: string | null;
  },
  start: string,
  end: string
) {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const createdAt = new Date(pr.created_at);
  if (createdAt >= startDate && createdAt <= endDate) return true;
  if (pr.merged_at) {
    const mergedAt = new Date(pr.merged_at);
    if (mergedAt >= startDate && mergedAt <= endDate) return true;
  }
  if (pr.closed_at) {
    const closedAt = new Date(pr.closed_at);
    if (closedAt >= startDate && closedAt <= endDate) return true;
  }
  return false;
}
