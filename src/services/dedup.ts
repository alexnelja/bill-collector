import crypto from "crypto";

export class DuplicateDetector {
  private seen = new Map<string, { resultId?: string; timestamp: Date }>();

  computeHash(base64Content: string, mimeType: string): string {
    return crypto
      .createHash("sha256")
      .update(base64Content)
      .update(mimeType)
      .digest("hex");
  }

  isDuplicate(base64Content: string, mimeType: string): boolean {
    const hash = this.computeHash(base64Content, mimeType);
    return this.seen.has(hash);
  }

  recordProcessed(hash: string, resultId: string): void {
    this.seen.set(hash, { resultId, timestamp: new Date() });
  }

  getPreviousResultId(hash: string): string | undefined {
    return this.seen.get(hash)?.resultId;
  }
}
