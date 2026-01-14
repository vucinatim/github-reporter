# Prompts Gallery

This directory contains example prompt templates for `github-reporter`. 

You can use these in your `jobs.config.ts` by setting the `promptFile` property.

## Available Prompts

- `changelog.txt`: Focuses on user-facing changes, suitable for release notes.
- `dev-diary.txt`: A technical summary intended for developers working on the project.
- `weekly-summary.txt`: A high-level overview of progress across multiple repositories.
- `twitter.txt`: A short, punchy summary optimized for social media.

## How to use

```typescript
// jobs.config.ts
{
  id: "daily-report",
  mode: "pipeline",
  promptFile: "prompts/dev-diary.txt",
  // ...
}
```
