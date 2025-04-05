// tasks-queue.js

/**
 * A simple in-memory queue. 
 * You could later replace this with a more sophisticated 
 * solution like a Redis-backed queue (BullMQ, etc.) if needed.
 */
const tasksQueue = [];

/**
 * Push a new task into the queue
 * @param {Object} task - the task object, e.g. { type: 'anime', anilistId: 123, ... }
 */
function enqueue(task) {
  tasksQueue.push(task);
}

/**
 * Pop the first task from the queue (FIFO).
 * Returns null if the queue is empty.
 */
function dequeue() {
  return tasksQueue.length > 0 ? tasksQueue.shift() : null;
}

/**
 * Check how many tasks are in the queue
 */
function size() {
  return tasksQueue.length;
}

export { enqueue, dequeue, size };
