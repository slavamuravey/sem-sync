## Sem Sync

A lightweight, promise-based semaphore implementation for controlling concurrent asynchronous operations in JavaScript. 
This library provides a modern implementation of the classic semaphore pattern with support for timeouts and abort signals.

### Installation
```shell
npm install sem-sync
```

### Features
- Promise-based API - Designed for modern async/await workflows
- Timeout support - Set maximum wait times for acquiring permits
- AbortSignal integration - Cancel wait operations programmatically
- FIFO queue - Fair first-in-first-out ordering for waiting operations
- Zero dependencies - Minimal, focused implementation
- TypeScript ready - Full type definitions included
- Universal JavaScript support

### Mutex vs Binary Semaphore
Mutex — A synchronization primitive for mutual exclusion (owned by a thread)

Binary Semaphore — A signaling mechanism (not owned, just a counter)

In single-threaded JavaScript with asynchronous operations:

- There is no true mutex — no thread ownership concept
- A binary semaphore (permit count = 1) provides synchronization for critical sections
- This is NOT a mutex, just a synchronization tool for async operations
- Multiple async "contexts" can be synchronized, but not "threads"

### Best Practices
- Always use try/finally - Ensure post() is called even if errors occur
- Set reasonable timeouts - Prevent indefinite waiting in production
- Use abort signals - Allow cancellation of long-running wait operations
- Monitor queue size - Use getValue() to understand resource utilization
- Size appropriately - Set initial permit count based on your resource constraints

### Common Use Cases

#### Rate Limiting API Calls

```javascript
import { Semaphore } from 'sem-sync';

// Limit to 5 concurrent API requests
const apiLimiter = new Semaphore(5);

async function makeApiRequest(url) {
  await apiLimiter.wait();
  try {
    return await fetch(url);
  } finally {
    apiLimiter.post();
  }
}
```

#### Database Connection Pooling
```javascript
import { Semaphore } from 'sem-sync';

// Pool of 10 database connections
const connectionPool = new Semaphore(10);

async function queryDatabase(query) {
  await connectionPool.wait({ timeout: 5000 });
  try {
    // Use database connection
    return await db.query(query);
  } finally {
    connectionPool.post();
  }
}
```

####  With Timeout and Abort
```javascript
import { Semaphore, SemaphoreTimeoutError, SemaphoreAbortError } from 'sem-sync';

const semaphore = new Semaphore(3);

async function limitedOperation() {
  const controller = new AbortController();
  
  try {
    await semaphore.wait({ 
      timeout: 10000, // 10 second timeout
      signal: controller.signal 
    });
    
    // Perform operation
    return await expensiveOperation();
  } catch (error) {
    if (error instanceof SemaphoreTimeoutError) {
      console.log('Operation timed out waiting for resources');
    } else if (error instanceof SemaphoreAbortError) {
      console.log('Operation was cancelled');
    }
    throw error;
  } finally {
    semaphore.post();
  }
}
```

### Documentation

For complete API reference, see
[API documentation](https://github.com/slavamuravey/sem-sync/blob/main/docs/README.md).