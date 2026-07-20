import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
  Download,
  Upload,
  CheckCircle,
  AlertCircle,
  Info
} from "lucide-react";
import { hybridDataManager, DataMode } from "@/lib/hybridDataManager";
import { localStorageManager } from "@/lib/localStorageManager";
import { useToast } from "@/hooks/use-toast";

export const OfflineModePanel = () => {
  const [mode, setMode] = useState<DataMode>("hybrid");
  const [isOnline, setIsOnline] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncQueueSize, setSyncQueueSize] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const { toast } = useToast();

  // Stable status checker
  const checkStatus = useCallback(async () => {
    try {
      const online = await hybridDataManager.initialize();
      setIsOnline(online);
      setMode(hybridDataManager.getMode());
    } catch {
      setIsOnline(false);
    }

    try {
      setSyncQueueSize(localStorageManager.getSyncQueue().length);
      setLastSync(localStorageManager.getLastSync());
    } catch {
      setSyncQueueSize(0);
      setLastSync(null);
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const handleModeChange = (newMode: DataMode) => {
    try {
      hybridDataManager.setMode(newMode);
      setMode(newMode);

      toast({
        title: "Mode Changed",
        description: `Switched to ${newMode} mode`
      });
    } catch {
      toast({
        title: "Error",
        description: "Could not change mode",
        variant: "destructive"
      });
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);

    try {
      const result = await hybridDataManager.syncToRemote();

      toast({
        title: "✅ Sync Complete",
        description: `Synced ${result.synced} items${
          result.errors.length ? ` (${result.errors.length} errors)` : ""
        }`
      });

      await checkStatus();
    } catch (error) {
      toast({
        title: "Sync Failed",
        description:
          error instanceof Error ? error.message : "Could not sync to backend",
        variant: "destructive"
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleExport = () => {
    try {
      const data = localStorageManager.exportData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `autonomous-system-backup-${Date.now()}.json`;
      a.click();

      URL.revokeObjectURL(url);

      toast({
        title: "💾 Exported Successfully",
        description: "Your data has been downloaded"
      });
    } catch {
      toast({
        title: "Export Failed",
        description: "Could not export data",
        variant: "destructive"
      });
    }
  };

  const handleImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";

    input.onchange = (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          localStorageManager.importData(data);

          toast({
            title: "📥 Imported Successfully",
            description: "Your data has been restored"
          });

          checkStatus();
        } catch {
          toast({
            title: "Import Failed",
            description: "Invalid backup file",
            variant: "destructive"
          });
        }
      };

      reader.readAsText(file);
    };

    input.click();
  };

  return (
    <Card className="p-6 glass-effect border-accent/20">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <HardDrive className="h-6 w-6 text-accent" />
              Offline Mode & Data Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Zero-cost local storage with optional cloud sync
            </p>
          </div>

          <Badge
            variant={isOnline ? "default" : "secondary"}
            className="flex items-center gap-1"
          >
            {isOnline ? (
              <Cloud className="h-3 w-3" />
            ) : (
              <CloudOff className="h-3 w-3" />
            )}
            {isOnline ? "Backend Online" : "Backend Offline"}
          </Badge>
        </div>

        {/* Connection Status */}
        <Card
          className={`p-4 border-l-4 ${
            isOnline
              ? "border-l-success bg-success/5"
              : "border-l-warning bg-warning/5"
          }`}
        >
          <div className="flex items-start gap-3">
            {isOnline ? (
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 text-warning mt-0.5" />
            )}

            <div className="flex-1">
              <h3 className="font-semibold">
                {isOnline ? "Cloud Connected" : "Running Locally"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isOnline
                  ? "Backend is available. Data will sync automatically."
                  : "Backend unavailable. All data stored locally — zero cloud costs."}
              </p>
            </div>
          </div>
        </Card>

        {/* Mode Selection */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Data Storage Mode</Label>

          <div className="grid grid-cols-3 gap-3">
            {/* Remote */}
            <Card
              className={`p-4 cursor-pointer transition-all hover:scale-105 ${
                mode === "remote" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleModeChange("remote")}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <Cloud className="h-6 w-6" />
                <span className="font-semibold">Remote</span>
                <span className="text-xs text-muted-foreground">Cloud only</span>
              </div>
            </Card>

            {/* Hybrid */}
            <Card
              className={`p-4 cursor-pointer transition-all hover:scale-105 ${
                mode === "hybrid" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleModeChange("hybrid")}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex gap-1">
                  <Cloud className="h-6 w-6" />
                  <HardDrive className="h-6 w-6" />
                </div>
                <span className="font-semibold">Hybrid</span>
                <span className="text-xs text-muted-foreground">Auto-fallback</span>
              </div>
            </Card>

            {/* Local */}
            <Card
              className={`p-4 cursor-pointer transition-all hover:scale-105 ${
                mode === "local" ? "border-primary bg-primary/5" : ""
              }`}
              onClick={() => handleModeChange("local")}
            >
              <div className="flex flex-col items-center text-center gap-2">
                <HardDrive className="h-6 w-6" />
                <span className="font-semibold">Local</span>
                <span className="text-xs text-muted-foreground">Zero cost</span>
              </div>
            </Card>
          </div>
        </div>

        {/* Sync Queue */}
        {syncQueueSize > 0 && (
          <Card className="p-4 border-l-4 border-l-accent bg-accent/5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info className="h-5 w-5 text-accent" />
                <div>
                  <p className="font-semibold">Pending Sync</p>
                  <p className="text-sm text-muted-foreground">
                    {syncQueueSize} change{syncQueueSize !== 1 ? "s" : ""} waiting
                    to sync
                  </p>
                </div>
              </div>

              <Button
                onClick={handleSync}
                disabled={!isOnline || isSyncing}
                size="sm"
                variant="outline"
              >
                {isSyncing ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Sync Now
              </Button>
            </div>
          </Card>
        )}

        {lastSync && (
          <p className="text-xs text-muted-foreground">
            Last synced: {new Date(lastSync).toLocaleString()}
          </p>
        )}

        {/* Backup */}
        <div className="space-y-3">
          <Label className="text-base font-semibold">Data Backup</Label>

          <div className="grid grid-cols-2 gap-3">
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="h-4 w-4 mr-2" />
              Export Data
            </Button>

            <Button onClick={handleImport} variant="outline" className="w-full">
              <Upload className="h-4 w-4 mr-2" />
              Import Data
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            💡 Tip: Export your data regularly as a backup. Works completely offline.
          </p>
        </div>

        {/* Benefits */}
        <Card className="p-4 bg-accent/5 border-accent/20">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Info className="h-4 w-4 text-accent" />
            Zero-Cost Benefits
          </h3>

          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>✅ Works completely offline — no internet required</li>
            <li>✅ Zero backend costs — all data stored locally</li>
            <li>✅ Instant performance — no network latency</li>
            <li>✅ Full privacy — your data never leaves your device</li>
            <li>✅ Auto-sync when backend available (optional)</li>
          </ul>
        </Card>
      </div>
    </Card>
  );
};
