import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { TopBar } from "@/components/nexus/TopBar";
import { useNexus } from "@/store/nexus";

// vitest globals disabled -> explicit cleanup.
afterEach(() => {
  cleanup();
  useNexus.getState().resetWorkspace();
  vi.restoreAllMocks();
});

describe("TopBar", () => {
  it("renders the kernel status and workspace scope", () => {
    render(<TopBar />);
    expect(screen.getByText(/Kernel Online/)).toBeTruthy();
    expect(screen.getByText(/Genesis Workspace/)).toBeTruthy();
  });

  it("renders Import, Export, and Reset controls", () => {
    render(<TopBar />);
    expect(screen.getByRole("button", { name: /Import/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Export/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Reset/ })).toBeTruthy();
  });

  it("reset restores the seed workspace", () => {
    useNexus.getState().addNote({ id: "extra", title: "t", body: "b", ts: 1, tag: "t" });
    expect(useNexus.getState().workspace.notes).toHaveLength(3);

    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /Reset/ }));

    // resetWorkspace is invoked in the onClick; assert the store effect.
    expect(useNexus.getState().workspace.notes).toHaveLength(2);
  });

  it("export downloads the workspace as JSON", () => {
    // happy-dom may not provide URL.createObjectURL; supply it if missing.
    if (typeof URL.createObjectURL !== "function") {
      vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob-url" });
    }
    const createObjectURLSpy = typeof URL.createObjectURL === "function"
      ? vi.spyOn(URL, "createObjectURL").mockReturnValue("blob-url")
      : vi.fn();

    const anchor = document.createElement("a");
    const clickSpy = vi.spyOn(anchor, "click").mockImplementation(() => {});
    // Capture the original bound impl first so the spy's fallback does not recurse.
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, "createElement").mockImplementation((tag) => {
      if (tag.toLowerCase() === "a") return anchor as unknown as HTMLElement;
      return originalCreateElement(tag);
    });

    render(<TopBar />);
    fireEvent.click(screen.getByRole("button", { name: /Export/ }));

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    expect(anchor.download).toContain("nexus-Genesis-Workspace.json");

    createElementSpy.mockRestore();
    if (typeof createObjectURLSpy.mockRestore === "function") {
      createObjectURLSpy.mockRestore();
    }
  });
});