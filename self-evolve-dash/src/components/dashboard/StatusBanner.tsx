import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

interface StatusBannerProps {
  lastRunTime: Date | null;
  nextRunTime: Date | null;
}

export const StatusBanner = ({ lastRunTime, nextRunTime }: StatusBannerProps) => {
  return (
    <div className="mb-8 p-6 glass-effect bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-lg border border-primary/20 animate-slide-up shadow-2xl hover-lift">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-3 bg-primary/20 rounded-full animate-pulse">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-full animate-ping"></div>
            <div className="absolute -top-1 -right-1 h-3 w-3 bg-success rounded-full"></div>
          </div>
          <div>
            <div className="font-semibold text-lg flex items-center gap-2">
              Autonomous Mode Active
              <Badge variant="secondary" className="text-xs">Live</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              AI is improving scripts AND analyzing itself for optimization
            </p>
          </div>
        </div>
        <div className="text-right text-sm space-y-1 bg-background/50 p-3 rounded-lg">
          {lastRunTime && (
            <p className="text-muted-foreground flex items-center gap-2 justify-end">
              <span className="h-2 w-2 bg-muted-foreground rounded-full"></span>
              Last run: {lastRunTime.toLocaleTimeString()}
            </p>
          )}
          {nextRunTime && (
            <p className="text-primary font-medium flex items-center gap-2 justify-end">
              <span className="h-2 w-2 bg-primary rounded-full animate-pulse"></span>
              Next run: {nextRunTime.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
