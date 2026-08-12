import { describe, it, expect } from "vitest";
import { cn } from "@/lib/utils";

describe("cn (className utility)", () => {
  it("joins truthy class values", () => {
    expect(cn("a", "b")).toBe("a b");
    expect(cn("a", false && "b", "c", null, undefined, 0 as unknown as string)).toBe("a c");
  });

  it("merges tailwind conflicts keeping the later class", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
    expect(cn("text-sm", "text-lg")).toBe("text-lg");
  });

  it("merges conditionally via clsx objects", () => {
    expect(cn("base", { active: true, hidden: false })).toBe("base active");
    expect(cn({ active: false })).toBe("");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});