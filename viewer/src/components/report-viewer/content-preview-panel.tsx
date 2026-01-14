"use client";

import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useReportViewer } from "./context";

export function ContentPreviewPanel() {
  const { content, activeTemplateId, selectedManifest } = useReportViewer();
  
  const isJson = selectedManifest?.output?.format === "json";
  
  return (
    <Card className="order-2 flex min-h-0 flex-1 flex-col gap-0 border-border/60 bg-background/80 py-0 shadow-sm backdrop-blur lg:order-1">
      <CardContent className="flex min-h-0 flex-1 overflow-hidden p-0">
        {content ? (
          <ScrollArea className="h-full w-full" scrollBar="vertical">
            {isJson ? (
              <article className="markdown px-6 py-6">
                <ReactMarkdown>{`# Raw Output\n\n\`\`\`json\n${content}\n\`\`\``}</ReactMarkdown>
              </article>
            ) : (
              <article className="markdown px-6 py-6">
                <ReactMarkdown>{content}</ReactMarkdown>
              </article>
            )}
          </ScrollArea>
        ) : (
          <div className="px-6 py-6">
            <p className="text-xs text-muted-foreground">
              Select a report to view content.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
