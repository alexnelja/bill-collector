import { DuplicateDetector } from "../src/services/dedup";

describe("DuplicateDetector", () => {
  let detector: DuplicateDetector;

  beforeEach(() => {
    detector = new DuplicateDetector();
  });

  it("returns false for first occurrence", () => {
    expect(detector.isDuplicate("abc123", "image/jpeg")).toBe(false);
  });

  it("returns true for same content submitted twice", () => {
    const hash = detector.computeHash("abc123", "image/jpeg");
    detector.recordProcessed(hash, "result-1");
    expect(detector.isDuplicate("abc123", "image/jpeg")).toBe(true);
  });

  it("returns false for different content", () => {
    const hash = detector.computeHash("abc123", "image/jpeg");
    detector.recordProcessed(hash, "result-1");
    expect(detector.isDuplicate("def456", "image/jpeg")).toBe(false);
  });

  it("stores the result ID for duplicates", () => {
    detector.recordProcessed("hash1", "result-001");
    expect(detector.getPreviousResultId("hash1")).toBe("result-001");
    expect(detector.getPreviousResultId("unknown")).toBeUndefined();
  });
});
