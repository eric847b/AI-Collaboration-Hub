import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Sidebar } from "@/components/nexus/Sidebar";
import { useNexus } from "@/store/nexus";

// vitest globals disabled -> explicit cleanup (renders accumulate in DOM).
afterEach(() => {
  cleanup();
  useNexus.getState().resetWorkspace();
  useNexus.setState({ activeModule: "dashboard" });
});

describe("Sidebar", () => {
  const moduleLabels = [
    "Dashboard",
    "Prompt Lab",
    "Userscripts",
    "Event Bus",
    "AI Graph",
    "Binary Inv.",
    "AI Remote",
    "Memory Vault",
    "File Vault",
  ];

  it("renders the NEXUS branding and all module buttons", () => {
    render(<Sidebar />);
    expect(screen.getByText("NEXUS")).toBeTruthy();
    expect(screen.getByText("INFINITY HUB")).toBeTruthy();
    for (const label of moduleLabels) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it("defaults to the dashboard module with active styling", () => {
    render(<Sidebar />);
    const activeBtn = screen.getByText("Dashboard").closest("button");
    // Active state carries a neon border; inactive buttons use border-transparent.
    expect(activeBtn!.className).toContain("border-neon-cyan/30");
  });

  it("switches the active module on click", () => {
    render(<Sidebar />);
    fireEvent.click(screen.getByText("Event Bus"));
    expect(useNexus.getState().activeModule).toBe("events");
    const activeBtn = screen.getByText("Event Bus").closest("button")!;
    expect(activeBtn.className).toContain("border-neon-cyan/30");
    const dashboardBtn = screen.getByText("Dashboard").closest("button")!;
    expect(dashboardBtn.className).toContain("border-transparent");
  });

  it("renders the workspace summary with counts", () => {
    render(<Sidebar />);
    expect(screen.getByText(/Genesis Workspace/)).toBeTruthy();
    // Seed: 3 prompts, 2 scripts, 2 files -> "3P · 2S · 2F"
    expect(screen.getByText("3P · 2S · 2F")).toBeTruthy();
  });
});