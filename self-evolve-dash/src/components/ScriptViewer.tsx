import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Download, Copy, Edit2, Save, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";

interface ScriptViewerProps {
  script: {
    id: string;
    name: string;
    code: string;
    version: string;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate?: () => void;
}

export const ScriptViewer = ({ script, open, onOpenChange, onUpdate }: ScriptViewerProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  if (!script) return null;

  const handleDownload = () => {
    const blob = new Blob([script.code], { type: "text/javascript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.name.replace(/[^a-z0-9]/gi, "_")}.user.js`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Downloaded!",
      description: "Script downloaded successfully",
    });
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(script.code);
    toast({
      title: "Copied!",
      description: "Script copied to clipboard",
    });
  };

  const handleEdit = () => {
    setEditedCode(script.code);
    setIsEditing(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Increment version
      const versionParts = script.version.split(".");
      versionParts[2] = (parseInt(versionParts[2]) + 1).toString();
      const newVersion = versionParts.join(".");

      const { error } = await supabase
        .from("scripts")
        .update({
          code: editedCode,
          version: newVersion,
          updated_at: new Date().toISOString(),
        })
        .eq("id", script.id);

      if (error) throw error;

      await supabase.from("activity_logs").insert({
        type: "success",
        message: `Manually edited ${script.name}`,
        details: `Version updated to ${newVersion}`,
        script_id: script.id,
      });

      toast({
        title: "Saved!",
        description: `Script updated to v${newVersion}`,
      });

      setIsEditing(false);
      onUpdate?.();
    } catch (error) {
      console.error("Save error:", error);
      toast({
        title: "Error",
        description: "Failed to save script",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col glass-effect border-primary/20 shadow-2xl animate-scale-in">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>{script.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">Version {script.version}</p>
            </div>
            <div className="flex gap-2">
              {!isEditing ? (
                <>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleEdit} className="interactive-scale hover:border-primary/50">
                          <Edit2 className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit script code</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" variant="outline" onClick={handleCopy} className="interactive-scale hover:border-accent/50">
                          <Copy className="h-4 w-4 mr-2" />
                          Copy
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Copy to clipboard</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="sm" onClick={handleDownload} className="gradient-primary hover:opacity-90 interactive-scale shadow-lg glow-primary">
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download as .user.js file</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                    className="interactive-scale hover:border-destructive/50"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={isSaving} className="gradient-primary hover:opacity-90 interactive-scale shadow-lg glow-primary">
                    <Save className="h-4 w-4 mr-2" />
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden rounded-lg border border-primary/20 shadow-lg">
          {isEditing ? (
            <CodeMirror
              value={editedCode}
              height="600px"
              theme={oneDark}
              extensions={[javascript()]}
              onChange={(value) => setEditedCode(value)}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                dropCursor: true,
                indentOnInput: true,
                bracketMatching: true,
                closeBrackets: true,
                autocompletion: true,
                rectangularSelection: true,
                highlightActiveLine: true,
                highlightSelectionMatches: true,
                searchKeymap: true,
              }}
              className="h-full"
            />
          ) : (
            <CodeMirror
              value={script.code}
              height="600px"
              theme={oneDark}
              extensions={[javascript()]}
              editable={false}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: true,
                highlightActiveLine: false,
                syntaxHighlighting: true,
              }}
              className="h-full"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
