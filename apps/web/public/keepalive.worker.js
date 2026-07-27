// Phase E keepalive Web Worker — v2:
// - Each tick does a tiny bit of real work (Date.now()) so Chrome treats
//   the worker as busy and does not throttle it.
// - Removed the `close` listener (no such event on DedicatedWorkerGlobalScope).

let timer = null;
let tickCount = 0;

self.onmessage = (e) => {
  const type = e?.data?.type;
  if (type === "START") {
    if (timer) clearInterval(timer);
    const ms = Math.max(1000, Number(e.data.ms) || 2000);
    timer = setInterval(() => {
      tickCount += 1;
      // Real work each tick — costs nothing but prevents idle-worker throttling.
      const now = Date.now();
      self.postMessage({ type: "TICK", t: now, n: tickCount });
    }, ms);
  } else if (type === "STOP") {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    tickCount = 0;
  }
};
