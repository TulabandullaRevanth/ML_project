import express from 'express';

const router = express.Router();

// In-memory set of connected clients (responses)
const clients = new Set();

// Keep-alive interval (send a comment every 30s)
const KEEP_ALIVE_MS = 30000;
let keepAliveTimer = null;

function startKeepAlive() {
  if (keepAliveTimer) return;
  keepAliveTimer = setInterval(() => {
    for (const res of clients) {
      try {
        // Comments are ignored by EventSource but keep connection alive
        res.write(':keep-alive\n\n');
      } catch (e) {
        // ignore
      }
    }
  }, KEEP_ALIVE_MS);
}

function stopKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

router.get('/stream', (req, res) => {
  // Required headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial comment
  res.write(': connected\n\n');

  clients.add(res);
  startKeepAlive();

  req.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) stopKeepAlive();
  });
});

function broadcastEvent(eventName, payload) {
  const data = JSON.stringify(payload || {});
  for (const res of clients) {
    try {
      res.write(`event: ${eventName}\n`);
      res.write(`data: ${data}\n\n`);
    } catch (e) {
      // ignore write errors; client may have disconnected
      clients.delete(res);
    }
  }
}

export default router;
export { broadcastEvent };
