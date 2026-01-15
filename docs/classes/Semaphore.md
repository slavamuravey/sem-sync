[**sem-sync**](../README.md)

***

[sem-sync](../README.md) / Semaphore

# Class: Semaphore

Defined in: src/index.ts:9

A promise-based semaphore implementation for controlling concurrent asynchronous operations.
The semaphore maintains a count of available permits and queues operations when none are available.

## Remarks

This implementation follows the traditional semaphore pattern with `wait` (acquire) and `post` (release)
operations, extended with timeout and abort capabilities for modern async JavaScript workflows.

## Constructors

### Constructor

> **new Semaphore**(`value`): `Semaphore`

Defined in: src/index.ts:19

Creates a new Semaphore instance.

#### Parameters

##### value

`number`

Initial number of available permits. Must be non-negative.
              Represents the maximum number of concurrent operations allowed.

#### Returns

`Semaphore`

## Methods

### getValue()

> **getValue**(): `number`

Defined in: src/index.ts:105

Gets the current number of available permits.

#### Returns

`number`

The number of permits currently available for immediate acquisition.

#### Remarks

This value represents permits that have not been acquired and are not promised to waiting operations.

***

### post()

> **post**(): `void`

Defined in: src/index.ts:28

Releases a permit back to the semaphore.

#### Returns

`void`

#### Remarks

If there are operations waiting in the queue, the oldest one will be resumed immediately.
Otherwise, the available permit count is incremented.

***

### wait()

> **wait**(`options`): `Promise`\<`void`\>

Defined in: src/index.ts:54

Acquires a permit from the semaphore.

#### Parameters

##### options

Configuration options for the wait operation.

###### signal?

`AbortSignal`

AbortSignal that can be used to cancel the wait operation.

###### timeout?

`number`

Maximum time in milliseconds to wait for a permit before rejecting.

#### Returns

`Promise`\<`void`\>

A promise that resolves when a permit is successfully acquired.

#### Throws

If the specified timeout elapses before a permit becomes available.

#### Throws

If the provided AbortSignal is triggered before a permit becomes available.

#### Remarks

The method follows FIFO (First-In-First-Out) ordering when multiple operations are waiting.
If a wait operation times out or is aborted, it is automatically removed from the waiting queue.
