import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { Landing } from "@/components/nexus/Landing";
import { useNexus } from "@/store/nexus";

// vitest globals disabled -> explicit cleanup (renders accumulate in DOM).
afterEach(() => {
  cleanup();
  useNexus.getState().resetWorkspace();
});

describe("Landing", () => {
  it("renders the Nexus Infinity Hub branding and feature grid", () => {
    render(<Landing onEnter={() => {}} />);
    expect(screen.getByText("Nexus Infinity Hub")).toBeTruthy();
    expect(screen.getByText(/kernel online/i)).toBeTruthy();
    // Feature chips from the FEATURES constant
    expect(screen.getByText("Workspace Kernel")).toBeTruthy();
    expect(screen.getByText("Prompt Lab")).toBeTruthy();
    expect(screen.getByText("Memory Vault")).toBeTruthy();
  });

  it("shows the current workspace name on the Load button", () => {
    render(<Landing onEnter={() => {}} />);
    expect(screen.getByRole("button", { name: /Load "Genesis Workspace"/ })).toBeTruthy();
  });

  it("calls onEnter when Load is clicked", () => {
    const onEnter = vi.fn();
    render(<Landing onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: /Load "Genesis Workspace"/ }));
    expect(onEnter).toHaveBeenCalledTimes(1);
  });

  it("Forge New Workspace resets then enters", () => {
    // pollute the store so we can prove reset happened
    useNexus.getState().addNote({ id: "x", title: "t", body: "b", ts: 1, tag: "t" });
    expect(useNexus.getState().workspace.notes).toHaveLength(3);

    const onEnter = vi.fn();
    render(<Landing onEnter={onEnter} />);
    fireEvent.click(screen.getByRole("button", { name: /Forge New Workspace/ }));

    expect(useNexus.getState().workspace.notes).toHaveLength(2); // back to seed
    expect(onEnter).toHaveBeenCalledTimes(1);
  });
});
