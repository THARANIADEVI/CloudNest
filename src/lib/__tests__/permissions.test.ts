import { describe, it, expect } from "vitest";
import { canEdit } from "@/lib/permissions";

describe("canEdit", () => {
  it("allows owner", () => {
    expect(canEdit("owner")).toBe(true);
  });

  it("allows editor", () => {
    expect(canEdit("editor")).toBe(true);
  });

  it("denies viewer", () => {
    expect(canEdit("viewer")).toBe(false);
  });
});
