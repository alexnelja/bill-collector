import { ProcessingResult, InputChannel } from "../types";

export class HistoryStore {
  private results = new Map<string, ProcessingResult>();

  save(result: ProcessingResult): void {
    this.results.set(result.id, result);
  }

  getById(id: string): ProcessingResult | undefined {
    return this.results.get(id);
  }

  listRecent(limit: number): ProcessingResult[] {
    const all = Array.from(this.results.values());
    all.sort((a, b) => {
      const aTime = a.processedAt?.getTime() || a.document.receivedAt.getTime();
      const bTime = b.processedAt?.getTime() || b.document.receivedAt.getTime();
      return bTime - aTime;
    });
    return all.slice(0, limit);
  }

  listByChannel(channel: InputChannel, limit: number): ProcessingResult[] {
    return this.listRecent(limit).filter((r) => r.document.channel === channel);
  }
}

export const historyStore = new HistoryStore();
