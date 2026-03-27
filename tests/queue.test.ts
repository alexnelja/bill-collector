import { ProcessingQueue } from "../src/services/queue";

describe("ProcessingQueue", () => {
  it("processes jobs sequentially with concurrency 1", async () => {
    const queue = new ProcessingQueue(1);
    const order: number[] = [];

    await Promise.all([
      queue.enqueue(async () => {
        order.push(1);
      }),
      queue.enqueue(async () => {
        order.push(2);
      }),
      queue.enqueue(async () => {
        order.push(3);
      }),
    ]);

    expect(order).toEqual([1, 2, 3]);
  });

  it("reports pending count", () => {
    const queue = new ProcessingQueue(1);
    expect(queue.pending).toBe(0);
  });

  it("reports queue size", () => {
    const queue = new ProcessingQueue(1);
    expect(queue.size).toBe(0);
  });
});
