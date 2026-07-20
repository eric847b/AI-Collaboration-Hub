import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Shield, 
  RotateCcw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Download,
  Upload
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { localStorageManager } from '@/lib/localStorageManager';
import { hybridDataManager } from '@/lib/hybridDataManager';

interface BackupPoint {
  id: string;
  timestamp: string;
  dataSize: number;
  scriptCount: number;
  logCount: number;
}

export const RecoverySystem = () => {
  const [backups, setBackups] = useState<BackupPoint[]>([]);
  const { toast } = useToast();

  const createBackup = () => {
    const data = localStorageManager.exportData();
    const backup: BackupPoint = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      dataSize: JSON.stringify(data).length,
      scriptCount: data.scripts?.length || 0,
      logCount: data.activityLogs?.length || 0,
    };

    const existingBackups = JSON.parse(localStorage.getItem('system_backups') || '[]');
    const updated = [backup, ...existingBackups].slice(0, 10); // Keep last 10
    localStorage.setItem('system_backups', JSON.stringify(updated));
    localStorage.setItem(`backup_${backup.id}`, JSON.stringify(data));

    setBackups(updated);

    toast({
      title: '✅ Backup Created',
      description: `System state saved with ${backup.scriptCount} scripts`,
    });
  };

  const restoreBackup = (backupId: string) => {
    const backupData = localStorage.getItem(`backup_${backupId}`);
    if (!backupData) {
      toast({
        title: 'Backup Not Found',
        description: 'The selected backup could not be found',
        variant: 'destructive',
      });
      return;
    }

    try {
      const data = JSON.parse(backupData);
      localStorageManager.importData(data);
      
      toast({
        title: '✅ Backup Restored',
        description: 'System state has been restored successfully',
      });

      // Reload page to reflect changes
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      toast({
        title: 'Restore Failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  const exportBackup = () => {
    const data = hybridDataManager.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: '📦 Backup Downloaded',
      description: 'Full system backup saved to file',
    });
  };

  const importBackup = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = JSON.parse(event.target?.result as string);
          hybridDataManager.importData(data);
          
          toast({
            title: '✅ Backup Imported',
            description: 'System restored from file',
          });

          setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
          toast({
            title: 'Import Failed',
            description: 'Invalid backup file format',
            variant: 'destructive',
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gradient flex items-center gap-2">
              <Shield className="h-6 w-6 text-accent" />
              Recovery System
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create backups and restore system state
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={createBackup}
              size="sm"
              className="gradient-primary hover:opacity-90"
            >
              <Shield className="h-4 w-4 mr-2" />
              Create Backup
            </Button>
          </div>
        </div>

        {/* Backup Actions */}
        <div className="grid md:grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={exportBackup}
            className="justify-start"
          >
            <Download className="h-4 w-4 mr-2" />
            Export to File
          </Button>
          <Button
            variant="outline"
            onClick={importBackup}
            className="justify-start"
          >
            <Upload className="h-4 w-4 mr-2" />
            Import from File
          </Button>
        </div>

        {/* Backup List */}
        {backups.length > 0 ? (
          <div className="space-y-4">
            <h3 className="font-semibold">Available Backups</h3>
            <ScrollArea className="h-[300px]">
              <div className="space-y-3 pr-4">
                {backups.map((backup) => (
                  <Card
                    key={backup.id}
                    className="p-4 glass-effect hover:scale-[1.01] transition-all"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-success" />
                          <span className="font-semibold text-sm">
                            {new Date(backup.timestamp).toLocaleString()}
                          </span>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap text-xs">
                          <Badge variant="outline">
                            {backup.scriptCount} scripts
                          </Badge>
                          <Badge variant="outline">
                            {backup.logCount} logs
                          </Badge>
                          <Badge variant="outline">
                            {(backup.dataSize / 1024).toFixed(1)} KB
                          </Badge>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => restoreBackup(backup.id)}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <Card className="p-8 text-center border-dashed">
            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground">No backups created yet</p>
            <p className="text-xs text-muted-foreground mt-2">
              Create a backup to save your current system state
            </p>
          </Card>
        )}

        {/* Warning */}
        <Card className="p-4 bg-warning/5 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-semibold text-warning">Important</p>
              <p className="text-muted-foreground">
                Restoring a backup will overwrite your current data. 
                Consider exporting your current state before restoring.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </Card>
  );
};
