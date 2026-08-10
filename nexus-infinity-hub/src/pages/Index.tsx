import { lazy, useEffect, Suspense } from "react";
import { useNexus } from "@/store/nexus";
import { DataStreams } from "@/components/nexus/DataStreams";
import { Landing } from "@/components/nexus/Landing";
import { Sidebar } from "@/components/nexus/Sidebar";
import { TopBar } from "@/components/nexus/TopBar";

const Dashboard = lazy(() => import("@/components/nexus/Dashboard").then(m => ({ default: m.Dashboard })));
const PromptLab = lazy(() => import("@/components/nexus/PromptLab").then(m => ({ default: m.PromptLab })));
const ScriptLab = lazy(() => import("@/components/nexus/ScriptLab").then(m => ({ default: m.ScriptLab })));
const EventBus = lazy(() => import("@/components/nexus/EventBus").then(m => ({ default: m.EventBus })));
const GraphView = lazy(() => import("@/components/nexus/GraphView").then(m => ({ default: m.GraphView })));
const BinaryPlayground = lazy(() => import("@/components/nexus/BinaryPlayground").then(m => ({ default: m.BinaryPlayground })));
const RemoteInterface = lazy(() => import("@/components/nexus/RemoteInterface").then(m => ({ default: m.RemoteInterface })));
const MemoryVault = lazy(() => import("@/components/nexus/MemoryVault").then(m => ({ default: m.MemoryVault })));
const FileVault = lazy(() => import("@/components/nexus/FileVault").then(m => ({ default: m.FileVault })));

const modules = { dashboard: Dashboard, prompts: PromptLab, scripts: ScriptLab, events: EventBus, graph: GraphView, binary: BinaryPlayground, remote: RemoteInterface, memory: MemoryVault, files: FileVault } as const;

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

  const Module = modules[activeModule as keyof typeof modules] || Dashboard;

  return (
    <>
      <DataStreams count={12} />
      <div className="relative z-10 h-screen w-screen flex flex-col">
        <TopBar />
        <div className="flex flex-1 min-h-0">
          <Sidebar />
          <main className="flex-1 p-3 min-w-0 animate-fade-in">
            <Suspense fallback={<div className="flex items-center justify-center h-full text-mono text-xs text-muted-foreground">Loading module...</div>}>
              <Module />
            </Suspense>
          </main>
        </div>
      </div>
    </>
  );
};

export default Index;