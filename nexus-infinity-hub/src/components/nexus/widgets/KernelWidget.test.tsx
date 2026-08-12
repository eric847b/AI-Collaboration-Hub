import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { KernelWidget } from "@/components/nexus/widgets/KernelWidget";
import { useNexus } from "@/store/nexus";

// vitest globals are disabled, so @testing-library/react's automatic cleanup
// (which hooks into global afterEach) does not run. Clean up explicitly.
afterEach(() => {
  cleanup();
  useNexus.getState().resetWorkspace();
});

describe("KernelWidget", () => {
  it("renders the kernel state badge", () => {
    render(<KernelWidget />);
    expect(screen.getByText(/KERNEL_STATE/)).toBeTruthy();
  });

  it("renders seeded workspace counts", () => {
    useNexus.getState().resetWorkspace();
    render(<KernelWidget />);
    // Seed: Prompts=3, Scripts=2, Notes=2, Files=2.
    // "003" (Prompts) is unique; "002" appears for Scripts+Notes+Files (3 rows).
    expect(screen.getByText("003")).toBeTruthy();
    expect(screen.getAllByText("002")).toHaveLength(3);
  });

  it("reflects updated store counts", () => {
    useNexus.getState().resetWorkspace();
    // Bump Scripts from 2 -> 3 so "003" now appears for Prompts AND Scripts.
    useNexus.getState().addScript({ id: "s3", name: "x", version: "1.0", code: "", deps: [], updated: 0 });
    render(<KernelWidget />);
    expect(screen.getAllByText("003")).toHaveLength(2);
    expect(screen.getAllByText("002")).toHaveLength(2); // Notes + Files
  });

  it("renders storage status rows", () => {
    render(<KernelWidget />);
    expect(screen.getByText("LOCAL.STORAGE")).toBeTruthy();
    expect(screen.getByText("SNAPSHOTS")).toBeTruthy();
  });
});