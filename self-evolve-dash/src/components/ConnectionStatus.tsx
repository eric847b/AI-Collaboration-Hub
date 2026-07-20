import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Wifi, Cloud, HardDrive, RefreshCw, 
  CheckCircle2, Zap 
} from "lucide-react";
import { checkBackendHealth } from "@/lib/connectionUtils";
import { hybridDataManager } from "@/lib/hybridDataManager";

type ConnectionMode = 'online' | 'offline' | 'checking';

export const ConnectionStatus = () => {
  const [mode, setMode] = useState<ConnectionMode>('checking');
  const [latency, setLatency] = useState<number | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const checkConnection = async (showRetry = false) => {
    if (showRetry) setIsRetrying(true);
    setMode('checking');
    
    try {
      await hybridDataManager.initialize();
      const health = await checkBackendHealth();
      
      setLatency(health.latency || null);
      setMode(health.healthy ? 'online' : 'offline');
    } catch {
      setMode('offline');
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    checkConnection();
    const interval = setInterval(() => checkConnection(), 60000);
    return () => clearInterval(interval);
  }, []);

  if (mode === 'checking') {
    return (
      <Card className="p-4 border-accent/30 bg-accent/5 animate-pulse">
        <div className="flex items-center gap-3">
          <RefreshCw className="h-5 w-5 text-accent animate-spin" />
          <span className="text-sm text-muted-foreground">Checking connection...</span>
        </div>
      </Card>
    );
  }

  if (mode === 'online') {
    return (
      <Card className="p-4 border-success/30 bg-success/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-success/10 rounded-full">
              <Cloud className="h-5 w-5 text-success" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-success">Cloud Connected</span>
                <Badge variant="outline" className="text-xs border-success/30 text-success">
                  <Wifi className="h-3 w-3 mr-1" />
                  {latency ? `${latency}ms` : 'Online'}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Full sync enabled • Data saved to cloud
              </p>
            </div>
          </div>
          <CheckCircle2 className="h-5 w-5 text-success" />
        </div>
      </Card>
    );
  }

  // Offline mode - present as a feature, not an error
  return (
    <Card className="p-4 border-accent/30 bg-accent/5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accent/10 rounded-full">
            <HardDrive className="h-5 w-5 text-accent" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-accent">Offline Mode Active</span>
              <Badge variant="outline" className="text-xs border-accent/30 text-accent">
                <Zap className="h-3 w-3 mr-1" />
                Zero Latency
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              All features work locally • Data persists in browser
            </p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => checkConnection(true)}
          disabled={isRetrying}
          className="text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
          Retry
        </Button>
      </div>
    </Card>
  );
};
