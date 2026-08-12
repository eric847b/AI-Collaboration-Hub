import { describe, it, expect, beforeEach } from "vitest";
import { useNexus } from "@/store/nexus";
import type { Prompt, Script, Note, FileItem, Workspace } from "@/store/nexus";

describe("useNexus store", () => {
  beforeEach(() => {
    // Reset to pristine seed state before each test.
    useNexus.getState().resetWorkspace();
    useNexus.setState({ initialized: false, activeModule: "dashboard" });
  });

  it("starts seeded with the genesis workspace", () => {
    const { workspace } = useNexus.getState();
    expect(workspace.name).toBe("Genesis Workspace");
    expect(workspace.prompts).toHaveLength(3);
    expect(workspace.scripts).toHaveLength(2);
    expect(workspace.notes).toHaveLength(2);
    expect(workspace.files).toHaveLength(2);
    expect(workspace.layout).toHaveLength(5);
  });

  it("tracks initialization and module selection", () => {
    const { init, setModule } = useNexus.getState();
    expect(useNexus.getState().initialized).toBe(false);
    init();
    expect(useNexus.getState().initialized).toBe(true);

    setModule("event-bus");
    expect(useNexus.getState().activeModule).toBe("event-bus");
  });

  it("prepends prompts and version-caps them on update", () => {
    const p: Prompt = { id: "p-new", title: "New", tags: ["x"], body: "body v1", versions: [] };
    useNexus.getState().addPrompt(p);
    let prompts = useNexus.getState().workspace.prompts;
    expect(prompts[0]).toEqual(p);
    expect(prompts).toHaveLength(4);

    // Update drives the initial body into versions history.
    useNexus.getState().updatePrompt("p-new", "body v2");
    prompts = useNexus.getState().workspace.prompts;
    const updated = prompts.find((x) => x.id === "p-new");
    expect(updated!.body).toBe("body v2");
    expect(updated!.versions[0].body).toBe("body v1");
  });

  it("version history is capped at 20 entries", () => {
    for (let i = 1; i <= 25; i++) {
      useNexus.getState().updatePrompt("p1", `version ${i}`);
    }
    const updated = useNexus.getState().workspace.prompts.find((x) => x.id === "p1");
    expect(updated!.versions.length).toBeLessThanOrEqual(20);
  });

  it("manages scripts with update timestamps", () => {
    const s: Script = { id: "s-new", name: "x", version: "1.0", code: "// x", deps: [], updated: 0 };
    useNexus.getState().addScript(s);
    expect(useNexus.getState().workspace.scripts[0].id).toBe("s-new");

    useNexus.getState().updateScript("s-new", "// y");
    const updated = useNexus.getState().workspace.scripts.find((x) => x.id === "s-new");
    expect(updated!.code).toBe("// y");
    expect(updated!.updated).toBeGreaterThan(0);
  });

  it("adds and removes notes", () => {
    const n: Note = { id: "n-new", title: "t", body: "b", ts: Date.now(), tag: "tag" };
    useNexus.getState().addNote(n);
    expect(useNexus.getState().workspace.notes).toHaveLength(3);

    useNexus.getState().removeNote("n-new");
    expect(useNexus.getState().workspace.notes).toHaveLength(2);
  });

  it("adds and removes files", () => {
    const f: FileItem = { id: "f-new", name: "a.txt", folder: "x", size: 1, type: "txt", content: "", ts: 0 };
    useNexus.getState().addFile(f);
    expect(useNexus.getState().workspace.files).toHaveLength(3);

    useNexus.getState().removeFile("f-new");
    expect(useNexus.getState().workspace.files).toHaveLength(2);
  });

  it("replaces layout via setLayout", () => {
    useNexus.getState().setLayout([{ id: "w9", type: "kernel", x: 0, y: 0, w: 100, h: 100 }]);
    expect(useNexus.getState().workspace.layout).toHaveLength(1);
    expect(useNexus.getState().workspace.layout[0].id).toBe("w9");
  });

  it("imports an external workspace wholesale", () => {
    const imported: Workspace = {
      name: "Imported",
      createdAt: 1,
      prompts: [],
      scripts: [],
      notes: [],
      files: [],
      layout: [],
    };
    useNexus.getState().importWorkspace(imported);
    expect(useNexus.getState().workspace).toEqual(imported);
  });

  it("persists state to localStorage and rehydrates on reset", () => {
    useNexus.getState().addNote({ id: "persist", title: "t", body: "b", ts: 1, tag: "t" });
    const raw = localStorage.getItem("nexus-infinity-hub");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!) as { state: { workspace: { notes: Note[] } } };
    expect(parsed.state.workspace.notes.some((n) => n.id === "persist")).toBe(true);
  });
});