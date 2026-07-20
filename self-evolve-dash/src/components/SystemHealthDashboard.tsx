import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Activity, CheckCircle2, HardDrive, TrendingUp, Zap } from 'lucide-react';
import { cacheManager } from '@/lib/cacheManager';
import { checkBackendHealth } from '@/lib/connectionUtils';

interface SystemHealth {
  backend: 'online' | 'offline';
  latency: number;
  cache: {
    entries: number;
    sizeMB: number;
    usage: number;
  };
  uptime: number;
}

export const SystemHealthDashboard = () => {
  const [health, setHealth] = useState<SystemHealth>({
    backend: 'offline',
    latency: 0,
    cache: { entries: 0, sizeMB: 0, usage: 0 },
    uptime: 0,
  });
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const checkHealth = async () => {
      const backendHealth = await checkBackendHealth();
      const cacheStats = cacheManager.getStats();
      
      setHealth({
        backend: backendHealth.healthy ? 'online' : 'offline',
        latency: backendHealth.latency || 0,
        cache: {
          entries: cacheStats.entries,
          sizeMB: cacheStats.sizeMB,
          usage: cacheStats.usage,
        },
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
    };

    checkHealth();
    const interval = setInterval(checkHealth, 15000);

    return () => clearInterval(interval);
  }, [startTime]);

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const isOffline = health.backend === 'offline';

  return (
    <Card className={`p-4 glass-effect ${isOffline ? 'border-accent/30' : 'border-success/30'}`}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`h-5 w-5 ${isOffline ? 'text-accent' : 'text-success'} animate-pulse`} />
            <h3 className="font-semibold">System Health</h3>
          </div>
          <Badge variant="outline" className={isOffline ? 'border-accent/30 text-accent' : 'border-success/30 text-success'}>
            {isOffline ? (
              <>
                <HardDrive className="h-3 w-3 mr-1" />
                LOCAL
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                CLOUD
              </>
            )}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-muted-foreground">
              {isOffline ? (
                <Zap className="h-4 w-4 text-accent" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              <span>Mode</span>
            </div>
            <p className={`font-semibold ${isOffline ? 'text-accent' : 'text-success'}`}>
              {isOffline ? 'Offline (Fast)' : 'Cloud Sync'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Response</p>
            <p className="font-semibold">
              {isOffline ? '<1ms' : health.latency > 0 ? `${health.latency}ms` : 'Checking...'}
            </p>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Cache Usage</p>
            <div className="space-y-1">
              <p className="font-semibold text-xs">
                {health.cache.sizeMB.toFixed(2)} MB
              </p>
              <Progress value={health.cache.usage} className="h-1" />
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground">Uptime</p>
            <p className="font-semibold text-xs">{formatUptime(health.uptime)}</p>
          </div>
        </div>

        <div className="pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{health.cache.entries} cached items</span>
            {isOffline && (
              <span className="ml-auto text-accent">• All features available</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};
