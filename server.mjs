import { createServer } from "http";
import next from "next";
import { WebSocketServer } from "ws";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

let latestSnapshot = null;

function safeJsonParse(str) {
  try {
    return JSON.parse(str);
  } catch {
    return null;
  }
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    if (latestSnapshot) {
      ws.send(JSON.stringify({ type: "SNAPSHOT", payload: latestSnapshot }));
    }

    ws.on("message", (data) => {
      const msg = safeJsonParse(String(data));
      if (!msg) return;

      if (msg.type === "SNAPSHOT") {
        latestSnapshot = msg.payload;
        const out = JSON.stringify({ type: "SNAPSHOT", payload: latestSnapshot });
        wss.clients.forEach((c) => {
          if (c.readyState === 1) c.send(out);
        });
      }

      if (msg.type === "EVENT") {
        const out = JSON.stringify(msg);
        wss.clients.forEach((c) => {
          if (c.readyState === 1) c.send(out);
        });
      }
    });
  });

  const port = parseInt(process.env.PORT || "3000", 10);
  server.listen(port, () => {
    console.log(`> Host server ready on http://localhost:${port}`);
    console.log(`> WebSocket ready on ws://localhost:${port}/ws`);
  });
});
