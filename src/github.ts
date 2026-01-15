import { Octokit } from "@octokit/rest";
import type {
  ActivityWindow,
  FetchMeta,
  RateLimitInfo,
  RepoActivity,
  RepoRef
} from "./types.js";
import { updateRateLimit } from "./github-rate-limit.js";

export type GitHubConfig = {
  token?: string;
  owner: string;
  ownerType: "user" | "org";
  allowlist: string[];
  blocklist: string[];
  includePrivate: boolean;
  perPage: number;
  maxPages: number;
};

type FetchOptions = {
  maxActiveRepos?: number;
  maxRepos?: number;
  preferActive?: boolean;
};

const activityCache = new Map<
  string,
  { repos: RepoActivity[]; rateLimit: RateLimitInfo; meta: FetchMeta }
>();

export async function fetchActivity(
  config: GitHubConfig,
  window: ActivityWindow,
  dataProfile: "minimal" | "standard" | "full" = "standard",
  options: FetchOptions = {}
): Promise<{ repos: RepoActivity[]; rateLimit: RateLimitInfo; meta: FetchMeta }> {
  const activeLimit = options.maxActiveRepos ?? "all";
  const repoLimit = options.maxRepos ?? "all";
  const preferActiveFlag = options.preferActive ?? Boolean(options.maxActiveRepos);
  const preferActive = preferActiveFlag ? "active" : "default";
  const cacheKey = [
    config.owner,
    config.ownerType,
    window.start,
    window.end,
    dataProfile,
    `active:${activeLimit}`,
    `repos:${repoLimit}`,
    `sort:${preferActive}`
  ].join(":");
  if (activityCache.has(cacheKey)) {
    return activityCache.get(cacheKey)!;
  }

  const octokit = new Octokit({
    auth: config.token
  });
  const rateLimit: RateLimitInfo = {};

  const repos = await listRepos(octokit, config, rateLimit, {
    preferActive: preferActiveFlag
  });
  let excludedAllowlist = 0;
  let excludedBlocklist = 0;
  let excludedPrivate = 0;
  const filtered = repos.filter((repo) => {
    if (config.allowlist && config.allowlist.length > 0 && !config.allowlist.includes(repo.name)) {
      excludedAllowlist += 1;
      return false;
    }
    if (config.blocklist && config.blocklist.includes(repo.name)) {
      excludedBlocklist += 1;
      return false;
    }
    if (!config.includePrivate && repo.private) {
      excludedPrivate += 1;
      return false;
    }
    return true;
  });

  const results: RepoActivity[] = [];
  let scannedRepos = 0;
  let activeRepos = 0;
  let stoppedEarly = false;
  const maxActiveRepos = options.maxActiveRepos;
  const maxRepos = options.maxRepos;
  for (const repo of filtered) {
    if (maxRepos && results.length >= maxRepos) {
      stoppedEarly = true;
      break;
    }
    let commits: RepoActivity["commits"] = [];
    if (dataProfile !== "minimal") {
      commits = await listCommits(
        octokit,
        config.owner,
        repo.name,
        window,
        config,
        rateLimit
      );
    }
    results.push({ repo, commits });
    scannedRepos += 1;
    if (commits.length > 0) {
      activeRepos += 1;
    }
    if (dataProfile !== "minimal" && maxActiveRepos && activeRepos >= maxActiveRepos) {
      stoppedEarly = true;
      break;
    }
  }

  const meta: FetchMeta = {
    totalRepos: repos.length,
    filteredRepos: filtered.length,
    excludedAllowlist,
    excludedBlocklist,
    excludedPrivate,
    scannedRepos,
    stoppedEarly
  };
  const output = { repos: results, rateLimit, meta };
  activityCache.set(cacheKey, output);
  return output;
}

type RepoApi = { name: string; private: boolean; html_url: string };
type CommitApi = {
  sha: string;
  commit: { message: string; author?: { name?: string; date?: string } };
  html_url: string;
  author?: { login?: string | null };
};

async function listRepos(
  octokit: Octokit,
  config: GitHubConfig,
  rateLimit: RateLimitInfo,
  options?: { preferActive?: boolean }
): Promise<RepoRef[]> {
  const sortParams = options?.preferActive
    ? { sort: "pushed", direction: "desc" }
    : {};
  if (config.ownerType === "org") {
    const data = await paginateWithLimit<RepoApi>(
      octokit,
      "GET /orgs/{org}/repos",
      {
        org: config.owner,
        type: "all",
        per_page: config.perPage,
        ...sortParams
      },
      config.maxPages,
      rateLimit
    );
    return data.map(mapRepo);
  }

  const data = await paginateWithLimit<RepoApi>(
    octokit,
    "GET /users/{username}/repos",
    {
      username: config.owner,
      per_page: config.perPage,
      ...sortParams
    },
    config.maxPages,
    rateLimit
  );
  return data.map(mapRepo);
}

async function listCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  window: ActivityWindow,
  config: GitHubConfig,
  rateLimit: RateLimitInfo
) {
  const data = await paginateWithLimit<CommitApi>(
    octokit,
    "GET /repos/{owner}/{repo}/commits",
    {
      owner,
      repo,
      since: window.start,
      until: window.end,
      per_page: config.perPage
    },
    config.maxPages,
    rateLimit
  );

  return data.map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: commit.author?.login ?? commit.commit.author?.name ?? "unknown",
    date: commit.commit.author?.date ?? window.end,
    url: commit.html_url
  }));
}

function mapRepo(repo: { name: string; private: boolean; html_url: string }): RepoRef {
  return {
    name: repo.name,
    private: repo.private,
    htmlUrl: repo.html_url
  };
}

async function paginateWithLimit<T>(
  octokit: Octokit,
  route: string,
  params: Record<string, unknown>,
  maxPages: number | undefined,
  rateLimit: RateLimitInfo
): Promise<T[]> {
  const iterator = octokit.paginate.iterator(route, params);
  const items: T[] = [];
  let page = 0;

  for await (const response of iterator) {
    page += 1;
    items.push(...(response.data as T[]));
    updateRateLimit(rateLimit, response.headers);
    if (maxPages && page >= maxPages) {
      break;
    }
  }

  return items;
}
