"use client";

import * as React from "react";
import { useRole } from "../role-store";
import { useAppState } from "../app-state";
import { useI18n } from "../i18n";

const ROLE_KEY = "tastingpos_device_role";
const PAIR_KEY = "tastingpos_pair_code";
const NAME_KEY = "tastingpos_device_name";
const LAN_MODE_KEY = "tastingpos_lan_mode";
const LAN_HOST_KEY = "tastingpos_lan_host";

function randomCode() {
  return Math.random().toString(36).slice(2, 6).toUpperCase();
}

export default function DevicePage() {
  const { t } = useI18n();
  const { role, setRole } = useRole();
  const { lanStatus } = useAppState();
  const [deviceName, setDeviceName] = React.useState("");
  const [pairCode, setPairCode] = React.useState("");
  const [lanMode, setLanMode] = React.useState<"OFF" | "HOST" | "CLIENT">("OFF");
  const [lanHost, setLanHost] = React.useState("");

  React.useEffect(() => {
    try {
      const r = localStorage.getItem(ROLE_KEY);
      if (r) setRole(r as any);
      const p = localStorage.getItem(PAIR_KEY);
      if (p) setPairCode(p);
      const n = localStorage.getItem(NAME_KEY);
      if (n) setDeviceName(n);
      const m = (localStorage.getItem(LAN_MODE_KEY) as "OFF" | "HOST" | "CLIENT") || "OFF";
      setLanMode(m);
      const h = localStorage.getItem(LAN_HOST_KEY) || "";
      setLanHost(h);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = (nextRole: string, nextName: string, nextPair: string) => {
    try {
      localStorage.setItem(ROLE_KEY, nextRole);
      localStorage.setItem(NAME_KEY, nextName);
      localStorage.setItem(PAIR_KEY, nextPair);
    } catch {}
  };

  const saveLan = (nextMode: "OFF" | "HOST" | "CLIENT", nextHost: string) => {
    try {
      localStorage.setItem(LAN_MODE_KEY, nextMode);
      localStorage.setItem(LAN_HOST_KEY, nextHost);
    } catch {}
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="text-2xl font-black text-white">{t("Device Setup", "Device Setup")}</div>
      <div className="text-sm text-zinc-400 mt-1">
        {t(
          "Offline-first. Later this pairing code will connect devices over local network.",
          "Offline-first. Later this pairing code will connect devices over local network."
        )}
      </div>

      <div className="mt-6 grid gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="text-xs font-black text-zinc-300">{t("DEVICE ROLE", "DEVICE ROLE")}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: "FOH", value: "ROOM" },
              { label: "KITCHEN", value: "KITCHEN" },
              { label: "ADMIN", value: "ADMIN" },
            ].map((r) => (
              <button
                key={r.value}
                onClick={() => {
                  setRole(r.value as any);
                  save(r.value, deviceName, pairCode);
                }}
                className={[
                  "px-4 py-2 rounded-xl text-xs font-black border transition",
                  role === r.value
                    ? "bg-amber-500 text-black border-amber-400"
                    : "bg-black/40 text-zinc-200 border-zinc-800 hover:bg-zinc-900/40",
                ].join(" ")}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="text-xs font-black text-zinc-300">{t("DEVICE NAME", "DEVICE NAME")}</div>
          <input
            value={deviceName}
            onChange={(e) => {
              setDeviceName(e.target.value);
              save(role || "ROOM", e.target.value, pairCode);
            }}
            placeholder={t("e.g. FOH iPad 1 / Pass Screen / Expo", "e.g. FOH iPad 1 / Pass Screen / Expo")}
            className="mt-3 w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-black text-zinc-300">{t("PAIRING CODE", "PAIRING CODE")}</div>
              <div className="text-xs text-zinc-500 mt-1">
                {t("Same code on all devices in the restaurant.", "Same code on all devices in the restaurant.")}
              </div>
            </div>
            <button
              onClick={() => {
                const c = randomCode();
                setPairCode(c);
                save(role || "ROOM", deviceName, c);
              }}
              className="px-4 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
            >
              {t("GENERATE", "GENERATE")}
            </button>
          </div>

          <input
            value={pairCode}
            onChange={(e) => {
              const v = e.target.value.toUpperCase().slice(0, 8);
              setPairCode(v);
              save(role || "ROOM", deviceName, v);
            }}
            placeholder="ABCD"
            className="mt-3 w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80 font-mono tracking-widest"
          />
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5">
          <div className="text-xs font-black text-zinc-300">{t("LAN SYNC", "LAN SYNC")}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {t(
              "Offline sync over local network. One device is HOST, others are CLIENT.",
              "Offline sync over local network. One device is HOST, others are CLIENT."
            )}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {(["OFF", "HOST", "CLIENT"] as const).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setLanMode(m);
                  if (m === "HOST" && !lanHost) {
                    const v = "ws://localhost:3000/ws";
                    setLanHost(v);
                    saveLan("HOST", v);
                    return;
                  }
                  saveLan(m, lanHost);
                }}
                className={[
                  "px-4 py-2 rounded-xl text-xs font-black border transition",
                  lanMode === m
                    ? "bg-amber-500 text-black border-amber-400"
                    : "bg-black/40 text-zinc-200 border-zinc-800 hover:bg-zinc-900/40",
                ].join(" ")}
              >
                {t(m, m)}
              </button>
            ))}
          </div>

          {lanMode !== "OFF" ? (
            <div className="mt-4">
              <div className="text-xs font-black text-zinc-300">{t("HOST WS URL", "HOST WS URL")}</div>
              <input
                value={lanHost}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setLanHost(v);
                  saveLan(lanMode, v);
                }}
                placeholder="ws://192.168.1.36:3000/ws"
                className="mt-2 w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80 font-mono"
              />
              <div className="mt-2 text-xs text-zinc-500">
                {t("Host must connect to its own websocket too. Example:", "Host must connect to its own websocket too. Example:")}{" "}
                <span className="font-mono">ws://192.168.1.36:3000/ws</span>
              </div>
            </div>
          ) : null}

          {lanMode === "HOST" ? (
            <div className="mt-4 text-xs text-amber-300 font-black">
              {t("This device is HOST. Keep it running during service.", "This device is HOST. Keep it running during service.")}
            </div>
          ) : null}

          {lanStatus ? (
            <div className="mt-4 text-xs font-black text-zinc-300">
              {t("STATUS", "STATUS")}:{" "}
              <span
                className={[
                  "px-2 py-1 rounded border text-[10px] font-black",
                  lanStatus === "CONNECTED"
                    ? "border-green-600 bg-green-900/25 text-green-200"
                    : lanStatus === "CONNECTING"
                    ? "border-amber-600 bg-amber-900/25 text-amber-200"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-300",
                ].join(" ")}
              >
                {t(lanStatus, lanStatus)}
              </span>
            </div>
          ) : null}
        </div>

        <div className="text-xs text-zinc-500">
          {t(
            "Later: we’ll use this role + code to auto-discover a LAN host (wired/Wi-Fi) and sync state without internet.",
            "Later: we’ll use this role + code to auto-discover a LAN host (wired/Wi-Fi) and sync state without internet."
          )}
        </div>
      </div>
    </div>
  );
}
