import { Button } from "@/components/ui/button";
import { Play, Square } from "lucide-react";

interface AutonomousModeToggleProps {
  isActive: boolean;
  onToggle: () => void;
}

export const AutonomousModeToggle = ({ isActive, onToggle }: AutonomousModeToggleProps) => {
  return (
    <Button
      size="lg"
      onClick={onToggle}
      className={`${
        isActive
          ? "bg-destructive hover:bg-destructive/90 glow-accent"
          : "gradient-primary hover:opacity-90 hover-lift"
      } transition-all interactive-scale ${isActive ? "animate-pulse" : ""} shadow-lg`}
    >
      {isActive ? (
        <>
          <Square className="mr-2 h-5 w-5" />
          Stop Autonomous Mode
        </>
      ) : (
        <>
          <Play className="mr-2 h-5 w-5" />
          Start Autonomous Mode
        </>
      )}
    </Button>
  );
};
