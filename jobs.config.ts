import type { JobsConfig } from "./src/jobs.js";

/**
 * GitHub Reporter Jobs Configuration
 * 
 * This file defines all jobs that the reporter will run.
 * Each job produces a single output (markdown or JSON).
 * 
 * Edit this file to configure your reports, schedules, and teams.
 */
export const config: JobsConfig = {
  jobs: [
    // -------------------------------------------------------------------------
    // Daily Changelog - LLM-generated changelog from commits
    // -------------------------------------------------------------------------
    {
      id: "daily-changelog",
      name: "Daily Changelog",
      description: "Developer-friendly changelog of daily activity",
      mode: "pipeline",
      dataProfile: "full",
      schedule: {
        type: "daily",
        hour: 0,
        minute: 0
      },
      scope: {
        owner: "vucinatim",
        ownerType: "user"
      },
      promptFile: "./prompts/changelog.txt",
      outputFormat: "markdown",
      onEmpty: "manifest-only",
      backfillSlots: 7,
      maxCommitsPerRepo: 50,
      maxRepos: 100,
      maxTotalCommits: 1000,
      maxTokensHint: 1200
    },

    // -------------------------------------------------------------------------
    // Hourly Stats - Deterministic stats JSON
    // -------------------------------------------------------------------------
    {
      id: "hourly-stats",
      name: "Hourly Stats",
      description: "Hourly activity stats for dashboards",
      mode: "stats",
      dataProfile: "minimal",
      schedule: {
        type: "hourly",
        minute: 0
      },
      scope: {
        owner: "vucinatim",
        ownerType: "user"
      },
      outputFormat: "json",
      onEmpty: "manifest-only",
      backfillSlots: 24,
      includeInactiveRepos: true,
      maxCommitsPerRepo: 20,
      maxTotalCommits: 200
    },

    // -------------------------------------------------------------------------
    // Weekly Summary - Aggregates daily changelogs
    // -------------------------------------------------------------------------
    {
      id: "weekly-summary",
      name: "Weekly Summary",
      description: "Weekly aggregate summary from daily changelogs",
      mode: "aggregate",
      dataProfile: "minimal",
      schedule: {
        type: "weekly",
        weekday: 1,  // Monday
        hour: 9,
        minute: 0
      },
      scope: {
        owner: "vucinatim",
        ownerType: "user"
      },
      aggregation: {
        sourceJobId: "daily-changelog",
        maxDays: 7
      },
      promptFile: "./prompts/weekly-summary.txt",
      outputFormat: "markdown",
      onEmpty: "manifest-only",
      backfillSlots: 1
    }
  ]
};
