import { getAdjacentTabRoute } from "@/ui/navigation/tabSwipe";

describe("horizontal tab navigation", () => {
  it("moves from dashboard to settings with a right swipe", () => {
    expect(getAdjacentTabRoute("Dashboard", "right")).toBe("Impostazioni");
  });

  it("moves through the main sections with left swipes", () => {
    expect(getAdjacentTabRoute("Dashboard", "left")).toBe("Snapshot");
    expect(getAdjacentTabRoute("Snapshot", "left")).toBe("Balance");
    expect(getAdjacentTabRoute("Balance", "left")).toBe("Wallet");
  });

  it("opens news on a left swipe from wallet and returns to cashflow on a right swipe", () => {
    expect(getAdjacentTabRoute("Wallet", "left")).toBe("News");
    expect(getAdjacentTabRoute("Wallet", "right")).toBe("Balance");
  });

  it("stops at the outer edges", () => {
    expect(getAdjacentTabRoute("Impostazioni", "right")).toBeNull();
    expect(getAdjacentTabRoute("News", "left")).toBeNull();
    expect(getAdjacentTabRoute("News", "right")).toBeNull();
  });
});
