import assert from "node:assert";
import { describe, it } from "node:test";

import { Semaphore, SemaphoreAbortError, SemaphoreTimeoutError } from "../dist/index.js";

describe("Semaphore", () => {
  describe("constructor", () => {
    it("should create semaphore with initial permit count", () => {
      const semaphore = new Semaphore(5);
      assert.strictEqual(semaphore.getValue(), 5);
    });

    it("should create binary semaphore with count 1", () => {
      const semaphore = new Semaphore(1);
      assert.strictEqual(semaphore.getValue(), 1);
    });

    it("should create semaphore with zero permits", () => {
      const semaphore = new Semaphore(0);
      assert.strictEqual(semaphore.getValue(), 0);
    });
  });

  describe("wait and post", () => {
    it("should acquire permit immediately when available", async () => {
      const semaphore = new Semaphore(2);

      await semaphore.wait();
      assert.strictEqual(semaphore.getValue(), 1);

      await semaphore.wait();
      assert.strictEqual(semaphore.getValue(), 0);
    });

    it("should queue waiters when no permits available", async () => {
      const semaphore = new Semaphore(1);

      // Acquire the only permit
      await semaphore.wait();
      assert.strictEqual(semaphore.getValue(), 0);

      // Start waiting for permit
      const waitPromise = semaphore.wait();

      // Release permit, waiter should get it
      semaphore.post();

      await waitPromise;
      assert.strictEqual(semaphore.getValue(), 0);
    });

    it("should process waiters in FIFO order", async () => {
      const semaphore = new Semaphore(1);
      const executionOrder = [];

      // Acquire the only permit
      await semaphore.wait();

      // Start multiple waiters
      const waiter1 = semaphore.wait().then(() => executionOrder.push(1));
      const waiter2 = semaphore.wait().then(() => executionOrder.push(2));
      const waiter3 = semaphore.wait().then(() => executionOrder.push(3));

      // Release permit multiple times
      semaphore.post();
      await waiter1;

      semaphore.post();
      await waiter2;

      semaphore.post();
      await waiter3;

      assert.deepStrictEqual(executionOrder, [1, 2, 3]);
    });

    it("should release permit when no waiters", () => {
      const semaphore = new Semaphore(0);

      semaphore.post();
      assert.strictEqual(semaphore.getValue(), 1);
    });

    it("should handle rapid acquire/release cycles", async () => {
      const semaphore = new Semaphore(1);

      for (let i = 0; i < 100; i++) {
        // eslint-disable-next-line no-await-in-loop
        await semaphore.wait();
        semaphore.post();
      }

      assert.strictEqual(semaphore.getValue(), 1);
    });
  });

  describe("timeout", () => {
    it("should throw SemaphoreTimeoutError on timeout", async () => {
      const semaphore = new Semaphore(1);

      // Acquire the only permit
      await semaphore.wait();

      // Try to wait with timeout
      await assert.rejects(() => semaphore.wait({ timeout: 50 }), SemaphoreTimeoutError);
    });

    it("should not throw if permit becomes available before timeout", async () => {
      const semaphore = new Semaphore(1);

      // Acquire the only permit
      await semaphore.wait();

      // Start waiting with timeout
      const waitPromise = semaphore.wait({ timeout: 100 });

      // Release permit before timeout
      setTimeout(() => semaphore.post(), 50);

      await assert.doesNotReject(() => waitPromise);
    });

    it("should remove waiter from queue on timeout", async () => {
      const semaphore = new Semaphore(1);
      const results = [];

      // Acquire the only permit
      await semaphore.wait();

      // First waiter will timeout
      const waiter1 = semaphore
        .wait({ timeout: 50 })
        .then(() => results.push("success1"))
        .catch(() => results.push("timeout1"));

      // Second waiter should still work
      const waiter2 = semaphore.wait().then(() => results.push("success2"));

      // Wait for timeout
      await new Promise(resolve => {
        setTimeout(resolve, 100);
      });

      // Release permit - only second waiter should get it
      semaphore.post();
      await waiter2;

      assert.deepStrictEqual(results, ["timeout1", "success2"]);
    });
  });

  describe("abort signal", () => {
    it("should throw SemaphoreAbortError when aborted", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();

      // Acquire the only permit
      await semaphore.wait();

      // Start waiting with abort signal
      const waitPromise = semaphore.wait({ signal: controller.signal });

      // Abort the wait
      controller.abort();

      await assert.rejects(() => waitPromise, SemaphoreAbortError);
    });

    it("should not throw if permit becomes available before abort", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();

      // Acquire the only permit
      await semaphore.wait();

      // Start waiting with abort signal
      const waitPromise = semaphore.wait({ signal: controller.signal });

      // Release permit before abort
      setTimeout(() => semaphore.post(), 50);
      setTimeout(() => controller.abort(), 100);

      await assert.doesNotReject(() => waitPromise);
    });

    it("should remove waiter from queue on abort", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();
      const results = [];

      // Acquire the only permit
      await semaphore.wait();

      // First waiter will be aborted
      const waiter1 = semaphore
        .wait({ signal: controller.signal })
        .then(() => results.push("success1"))
        .catch(() => results.push("aborted1"));

      // Second waiter should still work
      const waiter2 = semaphore.wait().then(() => results.push("success2"));

      // Abort first waiter
      controller.abort();
      await waiter1;

      // Release permit - only second waiter should get it
      semaphore.post();
      await waiter2;

      assert.deepStrictEqual(results, ["aborted1", "success2"]);
    });

    it("should handle already aborted signal", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();

      controller.abort();

      await assert.rejects(() => semaphore.wait({ signal: controller.signal }), SemaphoreAbortError);
    });
  });

  describe("combined timeout and abort", () => {
    it("should prioritize abort over timeout", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();

      await semaphore.wait();

      const waitPromise = semaphore.wait({
        timeout: 100,
        signal: controller.signal
      });

      // Abort before timeout
      setTimeout(() => controller.abort(), 50);

      await assert.rejects(() => waitPromise, SemaphoreAbortError);
    });

    it("should timeout if abort happens after", async () => {
      const semaphore = new Semaphore(1);
      const controller = new AbortController();

      await semaphore.wait();

      const waitPromise = semaphore.wait({
        timeout: 50,
        signal: controller.signal
      });

      // Abort after timeout
      setTimeout(() => controller.abort(), 100);

      await assert.rejects(() => waitPromise, SemaphoreTimeoutError);
    });
  });

  describe("binary semaphore behavior", () => {
    it("should synchronize async operations with single permit", async () => {
      const semaphore = new Semaphore(1);
      let concurrentCount = 0;
      let maxConcurrent = 0;

      const operation = async id => {
        await semaphore.wait();
        try {
          concurrentCount++;
          maxConcurrent = Math.max(maxConcurrent, concurrentCount);
          await new Promise(resolve => {
            setTimeout(resolve, 10);
          });
          concurrentCount--;
        } finally {
          semaphore.post();
        }
        return id;
      };

      // Start multiple operations
      const promises = Array.from({ length: 5 }, (_, i) => operation(i));
      const results = await Promise.all(promises);

      assert.strictEqual(maxConcurrent, 1); // Only one at a time
      assert.deepStrictEqual(results.sort(), [0, 1, 2, 3, 4]); // All completed
    });

    it("should prevent race conditions", async () => {
      const semaphore = new Semaphore(1);
      let counter = 0;

      const increment = async () => {
        await semaphore.wait();
        try {
          const current = counter;
          await new Promise(resolve => {
            setTimeout(resolve, Math.random() * 10);
          });
          counter = current + 1;
        } finally {
          semaphore.post();
        }
      };

      // Start 100 concurrent increments
      const promises = Array.from({ length: 100 }, () => increment());
      await Promise.all(promises);

      assert.strictEqual(counter, 100); // No race conditions
    });
  });

  describe("error handling", () => {
    it("should not throw on post without prior wait", () => {
      const semaphore = new Semaphore(1);

      // This should not throw, just increment counter
      assert.doesNotThrow(() => semaphore.post());
      assert.strictEqual(semaphore.getValue(), 2);
    });

    it("should handle multiple posts correctly with waiters", async () => {
      const semaphore = new Semaphore(1);

      // Take the only permit
      await semaphore.wait();
      assert.strictEqual(semaphore.getValue(), 0);

      // Start two waiters
      const waiter1 = semaphore.wait();
      const waiter2 = semaphore.wait();

      // First post - waiter1 should get it
      semaphore.post();
      await waiter1;
      assert.strictEqual(semaphore.getValue(), 0); // Waiter1 got it

      // Second post - waiter2 should get it
      semaphore.post();
      await waiter2;
      assert.strictEqual(semaphore.getValue(), 0); // Waiter2 got it

      // Third post - no waiters, value should increment
      semaphore.post();
      assert.strictEqual(semaphore.getValue(), 1); // No waiters, counter increments
    });
  });

  describe("edge cases", () => {
    it("should handle zero permits correctly", async () => {
      const semaphore = new Semaphore(0);

      const waitPromise = semaphore.wait();
      semaphore.post();

      await assert.doesNotReject(() => waitPromise);
      assert.strictEqual(semaphore.getValue(), 0);
    });

    it("should work with large number of concurrent waiters", async () => {
      const semaphore = new Semaphore(1);
      const count = 1000;
      const results = [];

      // Acquire initial permit
      await semaphore.wait();

      // Start many waiters
      const promises = Array.from({ length: count }, (_, i) => semaphore.wait().then(() => results.push(i)));

      // Release permits one by one
      for (let i = 0; i < count; i++) {
        semaphore.post();
      }

      await Promise.all(promises);
      assert.strictEqual(results.length, count);
      assert.deepStrictEqual(results, [...Array(count).keys()]); // FIFO order
    });
  });
});
