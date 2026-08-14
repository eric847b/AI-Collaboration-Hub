import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryVault } from "@/components/nexus/MemoryVault";
import { useNexus } from "@/store/nexus";

// vitest globals disabled -> explicit cleanup (renders accumulate in DOM).
afterEach(() => {
  cleanup();
  useNexus.getState().resetWorkspace();
  useNexus.setState({ activeModule: "dashboard" });
});

describe("MemoryVault", () => {
  it("renders the seed notes and the entry count", () => {
    render(<MemoryVault />);
    expect(screen.getByText("2 entries")).toBeTruthy();
    expect(screen.getByText("Workspace Initialized")).toBeTruthy();
    expect(screen.getByText("Concept: Inversion")).toBeTruthy();
  });

  it("persists a new note (adds to the store) and clears the input", async () => {
    render(<MemoryVault />);
    const titleInput = screen.getByPlaceholderText("title") as HTMLInputElement;
    const bodyInput = screen.getByPlaceholderText("memory content…") as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: "New Idea" } });
    fireEvent.change(bodyInput, { target: { value: "A thought worth keeping." } });
    fireEvent.click(screen.getByRole("button", { name: "Persist" }));

    await waitFor(() => {
      expect(screen.getByText("3 entries")).toBeTruthy();
      expect(screen.getByText("New Idea")).toBeTruthy();
    });
    expect(titleInput.value).toBe("");
    expect(useNexus.getState().workspace.notes.length).toBe(3);
  });

  it("filters notes by search term (title / body)", async () => {
    render(<MemoryVault />);
    const search = screen.getByPlaceholderText("search timeline / tags / content");
    fireEvent.change(search, { target: { value: "inversion" } });
    await waitFor(() => {
      expect(screen.getByText("1 entries")).toBeTruthy();
      expect(screen.getByText("Concept: Inversion")).toBeTruthy();
    });
    expect(screen.queryByText("Workspace Initialized")).toBeNull();
  });

  it("filters notes by tag", async () => {
    render(<MemoryVault />);
    const search = screen.getByPlaceholderText("search timeline / tags / content");
    fireEvent.change(search, { target: { value: "research" } });
    await waitFor(() => {
      expect(screen.getByText("1 entries")).toBeTruthy();
    });
    expect(screen.getByText("Concept: Inversion")).toBeTruthy();
    expect(screen.queryByText("Workspace Initialized")).toBeNull();
  });

  it("does not persist an empty-titled note", () => {
    render(<MemoryVault />);
    fireEvent.click(screen.getByRole("button", { name: "Persist" }));
    expect(screen.getByText("2 entries")).toBeTruthy();
    expect(useNexus.getState().workspace.notes.length).toBe(2);
  });

  it("removes a note via the trash button (icon-only)", async () => {
    render(<MemoryVault />);
    // The delete buttons are icon-only (accessible name ""), excluding the
    // text-labelled "Persist" button.
    const trashButtons = screen.getAllByRole("button", { name: "" });
    expect(trashButtons.length).toBe(2);
    fireEvent.click(trashButtons[0]);
    await waitFor(() => {
      expect(screen.getByText("1 entries")).toBeTruthy();
    });
    expect(useNexus.getState().workspace.notes.length).toBe(1);
  });
});

