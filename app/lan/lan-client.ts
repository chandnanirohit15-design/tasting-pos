"use client";

export type LanMsg =
  | { type: "EVENT"; payload: any }
  | { type: "SNAPSHOT"; payload: any };

type Handlers = {
  onEvent?: (e: any) => void;
  onSnapshot?: (s: any) => void;
  onStatus?: (s: "DISCONNECTED" | "CONNECTING" | "CONNECTED") => void;
};

export function createLanClient(url: string, handlers: Handlers) {
  let ws: WebSocket | null = null;
  let status: "DISCONNECTED" | "CONNECTING" | "CONNECTED" = "DISCONNECTED";
  let closedByUser = false;

  const setStatus = (s: typeof status) => {
    status = s;
    handlers.onStatus?.(s);
  };

  const connect = () => {
    if (!url) return;
    closedByUser = false;
    setStatus("CONNECTING");

    ws = new WebSocket(url);

    ws.onopen = () => setStatus("CONNECTED");
    ws.onclose = () => {
      setStatus("DISCONNECTED");
      ws = null;

      if (!closedByUser) {
        setTimeout(connect, 800);
      }
    };
    ws.onerror = () => {
      // close will fire
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as LanMsg;
        if (msg.type === "EVENT") handlers.onEvent?.(msg.payload);
        if (msg.type === "SNAPSHOT") handlers.onSnapshot?.(msg.payload);
      } catch {}
    };
  };

  const disconnect = () => {
    closedByUser = true;
    ws?.close();
    ws = null;
    setStatus("DISCONNECTED");
  };

  const send = (msg: LanMsg) => {
    if (!ws || ws.readyState !== 1) return false;
    ws.send(JSON.stringify(msg));
    return true;
  };

  return { connect, disconnect, send, getStatus: () => status };
}
