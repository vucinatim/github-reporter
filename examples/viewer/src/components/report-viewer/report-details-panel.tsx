"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useReportViewer } from "./context";

function formatWindowLabel(window: { days: number; hours?: number }) {
  if (window.hours && window.hours > 0) {
    return `${window.hours} hour window`;
  }
  return `${window.days} day window`;
}

export function ReportDetailsPanel() {
  const { selectedManifest, activeTemplateId, selectTemplate } =
    useReportViewer();

  return (
    <Card className="order-1 border-border/60 bg-background/70 shadow-sm backdrop-blur lg:order-2">
      {selectedManifest ? (
        <CardContent className="space-y-2">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary" className="text-[10px]">
                {selectedManifest.job?.name ?? "Report"}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {selectedManifest.window.start.slice(0, 10)}
              </Badge>
              {selectedManifest.status === "failed" ? (
                <Badge variant="destructive" className="text-[10px]">
                  Failed
                </Badge>
              ) : selectedManifest.empty ? (
                <Badge variant="outline" className="text-[10px]">
                  Empty
                </Badge>
              ) : null}
            </div>
            <CardTitle className="text-lg">
              {selectedManifest.owner} · {formatWindowLabel(selectedManifest.window)}
            </CardTitle>
            <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
              <span>{selectedManifest.stats.commits} commits</span>
              <span>{selectedManifest.stats.prs} PRs</span>
              <span>{selectedManifest.stats.issues} issues</span>
              <span>{selectedManifest.stats.repos} repos</span>
            </div>
          </div>

          {selectedManifest.templates.length > 0 ? (
            <Tabs
              value={activeTemplateId}
              onValueChange={(value) => void selectTemplate(value)}
            >
              <TabsList className="flex h-auto flex-wrap justify-start gap-2 bg-transparent p-0">
                {selectedManifest.templates.map((template) => (
                  <TabsTrigger
                    key={template.id}
                    value={template.id}
                    className="rounded-full border border-border bg-background px-3 py-1 text-[10px] shadow-sm data-[state=active]:bg-foreground data-[state=active]:text-background"
                  >
                    {template.id}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          ) : (
            <p className="text-xs text-muted-foreground">
              No templates available for this report.
            </p>
          )}
        </CardContent>
      ) : (
        <CardContent className="text-xs text-muted-foreground">
          Select a report to view.
        </CardContent>
      )}
    </Card>
  );
}
