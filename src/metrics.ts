import type {
  ActivityWindow,
  ContributorMetrics,
  RepoActivity,
  RepoMetrics,
  ReportMetrics
} from "./types.js";
import { normalizeAuthor } from "./utils.js";

type MetricsOptions = {
  topContributors: number;
  topRepos: number;
  authorAliases?: Record<string, string>;
};

export function computeReportMetrics(
  repos: RepoActivity[],
  window: ActivityWindow,
  options: MetricsOptions
): ReportMetrics {
  const start = new Date(window.start).getTime();
  const end = new Date(window.end).getTime();

  const coverage = {
    diffSummary: repos.some((repo) => Array.isArray(repo.context?.diffSummary)),
    pullRequests: repos.some((repo) => Array.isArray(repo.context?.pullRequests)),
    issues: repos.some((repo) => Array.isArray(repo.context?.issues))
  };

  const contributors = new Map<string, ContributorMetrics>();
  const repoMetrics: RepoMetrics[] = [];

  let totals = {
    repos: 0,
    commits: 0,
    additions: 0,
    deletions: 0,
    prsOpened: 0,
    prsMerged: 0,
    prsClosed: 0,
    issuesOpened: 0,
    issuesClosed: 0,
    contributors: 0
  };

  for (const repo of repos) {
    const repoName = repo.repo.name;
    const diffSummary = repo.context?.diffSummary ?? [];
    const prList = repo.context?.pullRequests ?? [];
    const issueList = repo.context?.issues ?? [];

    const additions = diffSummary.reduce(
      (acc, item) => acc + (item.totalAdditions ?? 0),
      0
    );
    const deletions = diffSummary.reduce(
      (acc, item) => acc + (item.totalDeletions ?? 0),
      0
    );

    const prsOpened = prList.filter((pr) => inWindow(pr.createdAt, start, end))
      .length;
    const prsMerged = prList.filter((pr) => inWindow(pr.mergedAt, start, end))
      .length;
    const prsClosed = prList.filter((pr) => inWindow(pr.closedAt, start, end))
      .length;

    const issuesOpened = issueList.filter((issue) =>
      inWindow(issue.createdAt, start, end)
    ).length;
    const issuesClosed = issueList.filter((issue) =>
      inWindow(issue.closedAt, start, end)
    ).length;

    const commitCount = repo.commits.length;
    const activityScore =
      commitCount + prsOpened + prsMerged + issuesOpened + issuesClosed;

    repoMetrics.push({
      name: repoName,
      commits: commitCount,
      additions,
      deletions,
      prsOpened,
      prsMerged,
      prsClosed,
      issuesOpened,
      issuesClosed,
      activityScore
    });

    totals = {
      ...totals,
      repos: totals.repos + 1,
      commits: totals.commits + commitCount,
      additions: totals.additions + additions,
      deletions: totals.deletions + deletions,
      prsOpened: totals.prsOpened + prsOpened,
      prsMerged: totals.prsMerged + prsMerged,
      prsClosed: totals.prsClosed + prsClosed,
      issuesOpened: totals.issuesOpened + issuesOpened,
      issuesClosed: totals.issuesClosed + issuesClosed
    };

    for (const commit of repo.commits) {
      const handle = toHandle(commit.author, options.authorAliases);
      if (!handle) continue;
      const entry = getContributor(contributors, handle);
      entry.commits += 1;
    }

    for (const pr of prList) {
      const handle = toHandle(pr.author, options.authorAliases);
      if (!handle) continue;
      const entry = getContributor(contributors, handle);
      if (inWindow(pr.createdAt, start, end)) entry.prsOpened += 1;
      if (inWindow(pr.mergedAt, start, end)) entry.prsMerged += 1;
      if (inWindow(pr.closedAt, start, end)) entry.prsClosed += 1;
    }

    for (const issue of issueList) {
      const handle = toHandle(issue.author, options.authorAliases);
      if (!handle) continue;
      const entry = getContributor(contributors, handle);
      if (inWindow(issue.createdAt, start, end)) entry.issuesOpened += 1;
      if (inWindow(issue.closedAt, start, end)) entry.issuesClosed += 1;
    }
  }

  const contributorList = finalizeContributors(contributors);
  totals.contributors = contributorList.length;

  return {
    totals,
    topContributors: contributorList
      .sort((a, b) => b.score - a.score || b.commits - a.commits)
      .slice(0, options.topContributors),
    topRepos: repoMetrics
      .sort((a, b) => b.activityScore - a.activityScore || b.commits - a.commits)
      .slice(0, options.topRepos),
    coverage
  };
}

export function aggregateReportMetrics(
  metricsList: ReportMetrics[],
  options: MetricsOptions
): ReportMetrics | undefined {
  if (metricsList.length === 0) return undefined;

  const contributors = new Map<string, ContributorMetrics>();
  const repos = new Map<string, RepoMetrics>();

  let totals = {
    repos: 0,
    commits: 0,
    additions: 0,
    deletions: 0,
    prsOpened: 0,
    prsMerged: 0,
    prsClosed: 0,
    issuesOpened: 0,
    issuesClosed: 0,
    contributors: 0
  };

  let coverage = {
    diffSummary: false,
    pullRequests: false,
    issues: false
  };

  for (const metrics of metricsList) {
    totals = {
      ...totals,
      repos: totals.repos + metrics.totals.repos,
      commits: totals.commits + metrics.totals.commits,
      additions: totals.additions + metrics.totals.additions,
      deletions: totals.deletions + metrics.totals.deletions,
      prsOpened: totals.prsOpened + metrics.totals.prsOpened,
      prsMerged: totals.prsMerged + metrics.totals.prsMerged,
      prsClosed: totals.prsClosed + metrics.totals.prsClosed,
      issuesOpened: totals.issuesOpened + metrics.totals.issuesOpened,
      issuesClosed: totals.issuesClosed + metrics.totals.issuesClosed
    };

    coverage = {
      diffSummary: coverage.diffSummary || metrics.coverage.diffSummary,
      pullRequests: coverage.pullRequests || metrics.coverage.pullRequests,
      issues: coverage.issues || metrics.coverage.issues
    };

    for (const contributor of metrics.topContributors) {
      const entry = getContributor(contributors, contributor.handle);
      entry.commits += contributor.commits;
      entry.prsOpened += contributor.prsOpened;
      entry.prsMerged += contributor.prsMerged;
      entry.prsClosed += contributor.prsClosed;
      entry.issuesOpened += contributor.issuesOpened;
      entry.issuesClosed += contributor.issuesClosed;
    }

    for (const repoMetric of metrics.topRepos) {
      const existing = repos.get(repoMetric.name);
      if (!existing) {
        repos.set(repoMetric.name, { ...repoMetric });
        continue;
      }
      existing.commits += repoMetric.commits;
      existing.additions += repoMetric.additions;
      existing.deletions += repoMetric.deletions;
      existing.prsOpened += repoMetric.prsOpened;
      existing.prsMerged += repoMetric.prsMerged;
      existing.prsClosed += repoMetric.prsClosed;
      existing.issuesOpened += repoMetric.issuesOpened;
      existing.issuesClosed += repoMetric.issuesClosed;
      existing.activityScore += repoMetric.activityScore;
    }
  }

  const contributorList = finalizeContributors(contributors);
  totals.contributors = contributorList.length;

  return {
    totals,
    topContributors: contributorList
      .sort((a, b) => b.score - a.score || b.commits - a.commits)
      .slice(0, options.topContributors),
    topRepos: Array.from(repos.values())
      .sort((a, b) => b.activityScore - a.activityScore || b.commits - a.commits)
      .slice(0, options.topRepos),
    coverage
  };
}

function inWindow(value: string | null | undefined, start: number, end: number) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= start && time <= end;
}

function toHandle(value: string | null | undefined, aliases?: Record<string, string>) {
  if (!value) return undefined;
  const normalized = normalizeAuthor(value, aliases);
  if (!normalized || normalized === "unknown") return undefined;
  if (!/^[a-z0-9-]+$/.test(normalized)) return undefined;
  return normalized;
}

function getContributor(map: Map<string, ContributorMetrics>, handle: string) {
  const existing = map.get(handle);
  if (existing) return existing;
  const entry: ContributorMetrics = {
    handle,
    commits: 0,
    prsOpened: 0,
    prsMerged: 0,
    prsClosed: 0,
    issuesOpened: 0,
    issuesClosed: 0,
    score: 0
  };
  map.set(handle, entry);
  return entry;
}

function finalizeContributors(map: Map<string, ContributorMetrics>) {
  return Array.from(map.values()).map((entry) => ({
    ...entry,
    score:
      entry.commits +
      entry.prsOpened +
      entry.prsMerged +
      entry.issuesOpened +
      entry.issuesClosed
  }));
}
