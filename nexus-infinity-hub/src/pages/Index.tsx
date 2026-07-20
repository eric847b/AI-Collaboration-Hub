import { useNexus } from "@/store/nexus";
import { DataStreams } from "@/components/nexus/DataStreams";
import { Landing } from "@/components/nexus/Landing";
import { Sidebar } from "@/components/nexus/Sidebar";
import { TopBar } from "@/components/nexus/TopBar";
import { Dashboard } from "@/components/nexus/Dashboard";
import { PromptLab } from "@/components/nexus/PromptLab";
import { ScriptLab } from "@/components/nexus/ScriptLab";
import { EventBus } from "@/components/nexus/EventBus";
import { GraphView } from "@/components/nexus/GraphView";
import { BinaryPlayground } from "@/components/nexus/BinaryPlayground";
import { RemoteInterface } from "@/components/nexus/RemoteInterface";
import { MemoryVault } from "@/components/nexus/MemoryVault";
import { FileVault } from "@/components/nexus/FileVault";
import { useEffect } from "react";

const Index = () => {
  const { initialized, init, activeModule } = useNexus();

  useEffect(() => {
    document.title = "Nexus Infinity Hub — AI Operating Environment";
    const meta = document.querySelector('meta[name="description"]') || document.head.appendChild(Object.assign(document.createElement("meta"), { name: "description" }));
    meta.setAttribute("content", "Nexus Infinity Hub: a unified AI operating environment for automation, prompts, userscripts, signals and persistent memory.");
  }, []);

  if (!initialized) {
    return (
      <>
        <DataStreams />
        <Landing onEnter={init} />
      </>
    );
  }

  const renderModule = () => {
    switch (activeModule) {
      case "dashboard": return <Dashboard />;
      case "prompts": return <PromptLab />;
      case "scripts": return <ScriptLab />;
      case "events": return <EventBus />;
      case "graph": return <GraphView />;
      case "binary": return <BinaryPlayground />;
      case "remote": return <RemoteInterface />;
      case "memory": return <MemoryVault />;
      case "files": return <FileVault />;
      default: return <Dashboard />;
    }
  };

  return (
    <>
      <DataStreams count={12} />
      <div className="relative z-10 h-screen w-screen flex flex-col">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 p-3 min-w-0 animate-fade-in">
            {renderModule()}
          </main>
        </div>
      </div>
    </>
  );
};

export default Index;
