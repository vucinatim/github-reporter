# Viewer Plan

## Scope
- Single owner at a time, owner type is `user` or `org`.
- Storage is S3/R2 only (no local filesystem).
- Viewer is fully data-driven via storage artifacts (no hardcoded job list).

## Goals
- Browse all reports for the selected owner and job.
- Calendar-style day navigation with horizontal scrolling.
- Clear drilldown from day -> manifest -> templates.
- Stats charts for stats-only jobs and for daily/weekly rollups.
- Work even when some reports are missing or failed.

## Data Contracts (from storage)
- Job registry: `{prefix}/_index/{ownerType}/{owner}/jobs.json`
- Per-job index: `{prefix}/_index/{ownerType}/{owner}/{jobId}/YYYY-MM.json`
- Latest pointer: `{prefix}/_index/{ownerType}/{owner}/{jobId}/latest.json`
- Report base: `{prefix}/{ownerType}/{owner}/jobs/{jobId}/{windowKey}/`
  - `manifest.json`
  - `summary.json`
  - template artifacts (markdown or json)

## Key Viewer Concepts
- Owner scope: determined by UI input (owner + ownerType).
- Job selector: driven by `jobs.json`.
- Window selector: based on index items (calendar/day view + range view).
- Detail view: manifest metadata + templates + raw JSON.
- Stats view: charts for stats-only jobs or aggregated counts.

## UX Structure

### Layout
- Left rail: Owner type + owner input + job selector + filters.
- Main panel: calendar row + day detail + templates.
- Right drawer (optional): raw data view (manifest/summary/template JSON).

### Calendar Row (Day View)
- Horizontal scroll row, each tile = day in selected month.
- Tiles indicate:
  - status (success/failed/empty)
  - commits count (small badge)
  - template count
- Clicking a day loads manifest + first template.
- If multiple items per day (hourly jobs), show a stacked indicator and a dropdown.

### Range View (Weekly/Aggregate)
- For aggregate jobs, show 7-day or N-day range tiles.
- Clicking a range opens the aggregate manifest and lists linked daily items.

### Stats View
- If job mode is `stats`, show charts for:
  - commits, prs, issues, repos
  - per-day counts in a line chart
  - top repos by commits (bar chart)
- For non-stats jobs, show a small “activity trend” chart using summary.json data.

## Data Loading Flow
1. Load `jobs.json` for owner scope.
2. Select job -> load `latest.json` and current month index file.
3. Build calendar from month index items.
4. On day click: load `manifest.json` then template text.
5. If stats job: render charts using manifest/stats + cached month index.

## Handling Missing Data
- No jobs.json: show “No jobs found” and allow manual refresh.
- Missing month index: allow next/prev month navigation.
- Missing manifest/template: show fallback error state and keep UI usable.

## API Design (Viewer App)
- Continue using `/api/reports/[...path]` for direct key reads.
- Add optional server-side list endpoint if needed later:
  - `/api/reports/list?prefix=...` (S3 ListObjectsV2)
  - not required for current plan if jobs.json exists.

## Component Map
- `ReportViewerPage`
  - `OwnerSelector`
  - `JobSelector`
  - `JobMeta`
  - `CalendarRow`
  - `DayDetail`
  - `TemplateTabs`
  - `StatsPanel`
  - `RawDrawer`

## Charting Approach
- Use a small charting library (e.g. Recharts or Chart.js).
- Charts driven by:
  - `manifest.stats` for totals
  - `summary.json` items for per-day trend
- Keep charts optional behind a small “Stats” toggle for performance.

## Phased Implementation
1. Refactor viewer data model types (manifest, summary, index, job registry).
2. Build calendar row and day selection (using index items).
3. Add stats chart panel for stats jobs.
4. Add raw drawer and error states.
5. Polish UX and responsiveness.

## Open Questions
- Confirm preferred chart library.
- Confirm if template JSON outputs should render as raw JSON or structured tables.
