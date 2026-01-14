import { Octokit } from "@octokit/rest";
import type {
  ActivityWindow,
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

const activityCache = new Map<string, { repos: RepoActivity[]; rateLimit: RateLimitInfo }>();

export async function fetchActivity(
  config: GitHubConfig,
  window: ActivityWindow,
  dataProfile: "minimal" | "standard" | "full" = "standard"
): Promise<{ repos: RepoActivity[]; rateLimit: RateLimitInfo }> {
  const cacheKey = `${config.owner}:${config.ownerType}:${window.start}:${window.end}:${dataProfile}`;
  if (activityCache.has(cacheKey)) {
    return activityCache.get(cacheKey)!;
  }

  const octokit = new Octokit({
    auth: config.token
  });
  const rateLimit: RateLimitInfo = {};

  const repos = await listRepos(octokit, config, rateLimit);
  const filtered = repos.filter((repo) => {
    if (config.allowlist && config.allowlist.length > 0 && !config.allowlist.includes(repo.name)) {
      return false;
    }
    if (config.blocklist && config.blocklist.includes(repo.name)) {
      return false;
    }
    if (!config.includePrivate && repo.private) {
      return false;
    }
    return true;
  });

  const results: RepoActivity[] = [];
  for (const repo of filtered) {
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
  }

  const output = { repos: results, rateLimit };
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
  rateLimit: RateLimitInfo
): Promise<RepoRef[]> {
  if (config.ownerType === "org") {
    const data = await paginateWithLimit<RepoApi>(
      octokit,
      "GET /orgs/{org}/repos",
      {
        org: config.owner,
        type: "all",
        per_page: config.perPage
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
      per_page: config.perPage
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
