/**
 * A promise-based semaphore implementation for controlling concurrent asynchronous operations.
 * The semaphore maintains a count of available permits and queues operations when none are available.
 *
 * @remarks
 * This implementation follows the traditional semaphore pattern with `wait` (acquire) and `post` (release)
 * operations, extended with timeout and abort capabilities for modern async JavaScript workflows.
 */
export class Semaphore {
    /**
     * Creates a new Semaphore instance.
     *
     * @param value - Initial number of available permits. Must be non-negative.
     *               Represents the maximum number of concurrent operations allowed.
     */
    constructor(value) {
        this.value = value;
        /** Queue of resolve functions for pending wait operations */
        this.resolveQueue = [];
    }
    /**
     * Releases a permit back to the semaphore.
     *
     * @remarks
     * If there are operations waiting in the queue, the oldest one will be resumed immediately.
     * Otherwise, the available permit count is incremented.
     */
    post() {
        if (this.resolveQueue.length > 0) {
            const resolve = this.resolveQueue.shift();
            resolve();
            return;
        }
        this.value++;
    }
    /**
     * Acquires a permit from the semaphore.
     *
     * @param options - Configuration options for the wait operation.
     * @param options.timeout - Maximum time in milliseconds to wait for a permit before rejecting.
     * @param options.signal - AbortSignal that can be used to cancel the wait operation.
     *
     * @returns A promise that resolves when a permit is successfully acquired.
     *
     * @throws {SemaphoreTimeoutError} If the specified timeout elapses before a permit becomes available.
     * @throws {SemaphoreAbortError} If the provided AbortSignal is triggered before a permit becomes available.
     *
     * @remarks
     * The method follows FIFO (First-In-First-Out) ordering when multiple operations are waiting.
     * If a wait operation times out or is aborted, it is automatically removed from the waiting queue.
     */
    async wait({ timeout, signal } = {}) {
        if (signal?.aborted) {
            throw new SemaphoreAbortError("semaphore wait aborted");
        }
        if (this.value > 0) {
            this.value--;
            return;
        }
        const { resolve, promise } = Promise.withResolvers();
        this.resolveQueue.push(resolve);
        const promises = [promise];
        if (signal) {
            const { reject, promise } = Promise.withResolvers();
            signal.addEventListener("abort", () => reject(new SemaphoreAbortError("semaphore wait aborted")));
            promises.push(promise);
        }
        let timeoutId;
        if (timeout) {
            const { reject, promise } = Promise.withResolvers();
            timeoutId = setTimeout(() => reject(new SemaphoreTimeoutError("semaphore wait timed out")), timeout);
            promises.push(promise);
        }
        try {
            await Promise.race(promises);
        }
        catch (e) {
            const index = this.resolveQueue.indexOf(resolve);
            if (index !== -1) {
                this.resolveQueue.splice(index, 1);
            }
            throw e;
        }
        finally {
            clearTimeout(timeoutId);
        }
    }
    /**
     * Gets the current number of available permits.
     *
     * @returns The number of permits currently available for immediate acquisition.
     *
     * @remarks
     * This value represents permits that have not been acquired and are not promised to waiting operations.
     */
    getValue() {
        return this.value;
    }
}
/**
 * Error thrown when a semaphore wait operation exceeds its specified timeout.
 *
 * @remarks
 * This error indicates that a permit did not become available within the allotted time period.
 * The waiting operation is automatically removed from the semaphore's queue when this occurs.
 */
export class SemaphoreTimeoutError extends Error {
    /**
     * Creates a new SemaphoreTimeoutError instance.
     *
     * @param message - Descriptive error message explaining the timeout.
     */
    constructor(message) {
        super(message);
        this.name = "SemaphoreTimeoutError";
    }
}
/**
 * Error thrown when a semaphore wait operation is aborted via an AbortSignal.
 *
 * @remarks
 * This error indicates that the wait operation was cancelled programmatically before completion.
 * The waiting operation is automatically removed from the semaphore's queue when this occurs.
 */
export class SemaphoreAbortError extends Error {
    /**
     * Creates a new SemaphoreAbortError instance.
     *
     * @param message - Descriptive error message explaining the abort.
     */
    constructor(message) {
        super(message);
        this.name = "SemaphoreAbortError";
    }
}
//# sourceMappingURL=index.js.map