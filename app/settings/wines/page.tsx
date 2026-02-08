"use client";

import React from "react";
import { loadSettings, saveSettings, uid, type Wine } from "../settings-store";
import { useI18n } from "../../i18n";

function Btn({ children, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
    >
      {children}
    </button>
  );
}

export default function WinesSettingsPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState(loadSettings());
  const [name, setName] = React.useState("");
  const [type, setType] = React.useState("");

  const commit = (next: typeof data) => {
    setData(next);
    saveSettings(next);
  };

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const w: Wine = { id: uid("wine"), name: n, type: type.trim() || undefined };
    commit({ ...data, wines: [w, ...data.wines] });
    setName("");
    setType("");
  };

  const remove = (id: string) => {
    // also remove pairing rules using this wine
    commit({
      ...data,
      wines: data.wines.filter((w) => w.id !== id),
      pairing: data.pairing.filter((p) => p.wineId !== id),
    });
  };

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6 overflow-y-auto">
      <div className="text-2xl font-black text-white">{t("Edit Wine", "Edit Wine")}</div>
      <div className="text-zinc-400 mt-1 text-sm">
        {t("Wine list used by Pairing (maridaje).", "Wine list used by Pairing (maridaje).")}
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">{t("Wine list", "Wine list")}</div>
          <div className="text-xs text-zinc-500">
            {data.wines.length} {t("wines", "wines")}
          </div>
        </div>

        <div className="p-4">
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("Wine name…", "Wine name…")}
              className="flex-1 rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
            />
            <input
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder={t("Type (optional)…", "Type (optional)…")}
              className="w-44 rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
            />
            <Btn onClick={add}>{t("ADD", "ADD")}</Btn>
          </div>

          <div className="mt-4 space-y-2">
            {data.wines.map((w) => (
              <div
                key={w.id}
                className="rounded-2xl border border-zinc-800 bg-black/40 px-3 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-white font-black truncate">{w.name}</div>
                  {w.type ? <div className="text-xs text-zinc-500">{w.type}</div> : null}
                </div>
                <div className="shrink-0">
                  <Btn onClick={() => remove(w.id)}>{t("DELETE", "DELETE")}</Btn>
                </div>
              </div>
            ))}
            {!data.wines.length ? (
              <div className="text-zinc-500 text-sm mt-4">{t("No wines yet.", "No wines yet.")}</div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
