import { describe, expect, it } from "vitest";
import { toastPresentation } from "../Toast";

describe("Toast", () => {
  it("presents errors as assertive alerts with the danger color and warning icon", () => {
    expect(toastPresentation("error")).toEqual({
      icon: "warning",
      color: "var(--danger)",
      role: "alert",
      ariaLive: "assertive",
    });
  });

  it("keeps successful notices polite and uses the success color and icon", () => {
    expect(toastPresentation("success")).toEqual({
      icon: "success",
      color: "var(--success)",
      role: "status",
      ariaLive: "polite",
    });
  });

  it("presents informational notices politely", () => {
    expect(toastPresentation("info")).toEqual({
      icon: "info",
      color: "var(--text-2)",
      role: "status",
      ariaLive: "polite",
    });
  });
});
