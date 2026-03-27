import PQueue from "p-queue";
import { logger } from "../utils/logger";

export class ProcessingQueue {
  private queue: PQueue;

  constructor(concurrency = 3) {
    this.queue = new PQueue({ concurrency });
    this.queue.on("error", (error) => {
      logger.error("Queue processing error", { error });
    });
  }

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return this.queue.add(fn) as Promise<T>;
  }

  get pending(): number {
    return this.queue.pending;
  }

  get size(): number {
    return this.queue.size;
  }
}

export const processingQueue = new ProcessingQueue(3);
