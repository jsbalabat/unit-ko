"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";
import type { ActivityLog } from "@unitko/shared";
import { ActionIcon, ActivityMetadata } from "@/components/activity-log";
import { formatDateTime } from "./types";

export interface PropertyHistoryTabProps {
  activityLogs: ActivityLog[];
}

export function PropertyHistoryTab({ activityLogs }: PropertyHistoryTabProps) {
  return (
    <div className="space-y-4">
      <Card className="shadow-sm">
        <CardContent className="p-4 md:p-6">
          <h3 className="text-base md:text-lg font-semibold mb-4 flex items-center">
            <Clock className="h-4 w-4 md:h-5 md:w-5 mr-2 text-primary" />
            Activity Timeline
          </h3>

          {activityLogs.length > 0 ? (
            <div className="space-y-3">
              {activityLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 pb-3 border-b last:border-b-0 last:pb-0"
                >
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <ActionIcon actionType={log.actionType} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDateTime(log.createdAt)}
                    </p>
                    <ActivityMetadata metadata={log.metadata} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <Clock className="h-12 w-12 mb-3 opacity-40" />
              <p className="text-sm font-medium">No activity yet</p>
              <p className="text-xs mt-1">
                Activity history will appear here as changes are made
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
