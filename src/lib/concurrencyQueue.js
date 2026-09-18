// Generic bounded-concurrency task queue.
//
// A non-virtualized grid mounting 100+ cards at once, each independently
// firing its own per-item network call (see useStyleExternalProductId,
// useProductReviewSummary), floods the browser's connection pool — most
// requests just sit queued by the browser/OS, not failing, which is why
// that symptom looks like "minutes of nothing" rather than an error.
// enqueue() caps how many `worker` calls are ever in flight at once,
// regardless of how many calls arrive in the same tick; the rest wait in a
// FIFO queue and get their turn as slots free up. Same shape as
// useLiveCatalogPrices' bucket/worker pool, generalized for a single-item
// (non-batchable) endpoint.
export function createConcurrencyQueue(worker, { concurrency = 4 } = {}) {
  const queue = [];
  let active = 0;

  function pump() {
    while (active < concurrency && queue.length) {
      const { arg, resolve, reject } = queue.shift();
      active++;
      worker(arg)
        .then(resolve, reject)
        .finally(() => {
          active--;
          pump();
        });
    }
  }

  return function enqueue(arg) {
    return new Promise((resolve, reject) => {
      queue.push({ arg, resolve, reject });
      pump();
    });
  };
}
