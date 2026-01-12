# Viewer Refactor Plan

## Goals
- Clean modular architecture with four focused panels.
- Global state via React context provider (no prop drilling).
- Runtime validation with Zod for all remote data.
- Minimal code surface, clear separation of concerns.

## Target Component Structure
- `ReportViewerProvider` (context + data fetching + derived state)
- `CalendarRowPanel`
- `FilterPanel`
- `ContentPreviewPanel`
- `ReportDetailsPanel`
- `ReportViewerPage` (composition only)

## State Model (Context)
- Owner scope: `owner`, `ownerType`
- Jobs: `jobs`, `jobId`, `selectedJob`
- Time: `activeMonth`, `monthOptions`
- Reports: `items`, `itemsByDay`, `selectedManifest`, `selectedDayKey`
- Content: `activeTemplateId`, `content`
- UI status: `loading`, `hasMore`, `error`

## Zod Schemas
- `JobRegistrySchema`
- `IndexItemSchema`
- `ManifestSchema`
- `SummarySchema`
- Use `safeParse` on every response.
- Map invalid data to a non-blocking error state.

## Data Flow
1. Provider loads `jobs.json` for owner scope.
2. Provider loads latest manifest + initial month index.
3. Month selection triggers `ensureMonthLoaded`.
4. Day selection loads manifest and first template.
5. Template selection loads content.

## Panel Responsibilities

### 1) FilterPanel
- Owner type, owner input, job selector.
- No history or latest.
- Writes to context setters only.
- Keeps all controls full width.

### 2) CalendarRowPanel
- Horizontal scroll of days for `activeMonth`.
- Uses `itemsByDay` to show status badges.
- Handles day selection -> updates context.
- Shows selected day state.

### 3) ContentPreviewPanel
- Displays rendered markdown for selected template.
- Owns scrollable content area.
- Shows empty state when no content.

### 4) ReportDetailsPanel
- Right-side summary for selected report.
- Template tabs for switching active template.
- Shows status, stats, window range.

## File Layout
- `src/components/report-viewer/`
  - `context.tsx` (provider + hooks + schemas)
  - `calendar-row-panel.tsx`
  - `filter-panel.tsx`
  - `content-preview-panel.tsx`
  - `report-details-panel.tsx`
  - `report-viewer-page.tsx`

## Refactor Steps
1. Create Zod schemas in `context.tsx` (or `schemas.ts`).
2. Move fetch logic + parsing into provider.
3. Build context value with derived data (`itemsByDay`, `selectedDayKey`).
4. Split the current JSX into 4 panels, pulling data from context.
5. Replace `ReportViewer` usage with `ReportViewerPage`.
6. Delete unused helpers and legacy state in old component.

## Error & Loading UX
- Provider exposes `error` string for soft errors.
- Panels render lightweight empty/failed states without throwing.

## Testing Notes
- Use a mocked provider for basic rendering tests (optional).
- Verify: month switch, day select, template switch, missing data.
