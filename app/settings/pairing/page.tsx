"use client";

import React from "react";
import { loadSettings, saveSettings, uid, type MenuId, type PairingRule } from "../settings-store";
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

export default function PairingSettingsPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState(loadSettings());
  const [menuId, setMenuId] = React.useState<MenuId>(data.menus[0]?.id || "");
  const [wineId, setWineId] = React.useState<string>(data.wines[0]?.id || "");
  const [fromIdx, setFromIdx] = React.useState<number>(1);
  const [toIdx, setToIdx] = React.useState<number>(2);

  const commit = (next: typeof data) => {
    setData(next);
    saveSettings(next);
  };

  React.useEffect(() => {
    if (!data.menus.find((m) => m.id === menuId)) {
      setMenuId(data.menus[0]?.id || "");
    }
  }, [data.menus, menuId]);

  const add = () => {
    if (!wineId) return;
    const r: PairingRule = {
      id: uid("pair"),
      menuId,
      wineId,
      fromIdx: Math.max(1, Math.min(fromIdx, toIdx)),
      toIdx: Math.max(1, Math.max(fromIdx, toIdx)),
    };
    commit({ ...data, pairing: [r, ...data.pairing] });
  };

  const remove = (id: string) => commit({ ...data, pairing: data.pairing.filter((p) => p.id !== id) });

  const activeMenu = data.menus.find((m) => m.id === menuId) || data.menus[0];
  const menuLen = activeMenu?.courses.length || 0;
  const rules = data.pairing
    .filter((p) => p.menuId === menuId)
    .sort((a, b) => a.fromIdx - b.fromIdx);

  const wineName = (id: string) => data.wines.find((w) => w.id === id)?.name || t("Unknown", "Unknown");

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6 overflow-y-auto">
      <div className="text-2xl font-black text-white">{t("Pairing (Maridaje)", "Pairing (Maridaje)")}</div>
      <div className="text-zinc-400 mt-1 text-sm">
        {t(
          "Map a wine to a range of courses. FOH can preview wines; kitchen only sees “SLOW PACE”.",
          "Map a wine to a range of courses. FOH can preview wines; kitchen only sees “SLOW PACE”."
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {data.menus.map((m) => (
          <button
            key={m.id}
            onClick={() => setMenuId(m.id)}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              menuId === m.id
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {m.label || t("Menu", "Menu")}
          </button>
        ))}
        <div className="ml-auto text-xs text-zinc-500">
          {menuLen} {t("courses", "courses")}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">{t("Add pairing rule", "Add pairing rule")}</div>
          <div className="text-xs text-zinc-500">
            {t("Range supports “1 wine for 2 dishes”", "Range supports “1 wine for 2 dishes”")}
          </div>
        </div>

        <div className="p-4 flex flex-wrap gap-2 items-end">
          <div className="w-72">
            <div className="text-xs font-black text-zinc-300 mb-2">{t("WINE", "WINE")}</div>
            <select
              value={wineId}
              onChange={(e) => setWineId(e.target.value)}
              className="w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none"
            >
              {data.wines.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <div className="text-xs font-black text-zinc-300 mb-2">{t("FROM", "FROM")}</div>
            <input
              type="number"
              value={fromIdx}
              min={1}
              max={Math.max(1, menuLen)}
              onChange={(e) => setFromIdx(parseInt(e.target.value || "1", 10))}
              className="w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="w-32">
            <div className="text-xs font-black text-zinc-300 mb-2">{t("TO", "TO")}</div>
            <input
              type="number"
              value={toIdx}
              min={1}
              max={Math.max(1, menuLen)}
              onChange={(e) => setToIdx(parseInt(e.target.value || "1", 10))}
              className="w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none"
            />
          </div>

          <Btn onClick={add}>{t("ADD RULE", "ADD RULE")}</Btn>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">
            {t("Rules", "Rules")} — {activeMenu?.label || t("Menu", "Menu")}
          </div>
          <div className="text-xs text-zinc-500">
            {rules.length} {t("rules", "rules")}
          </div>
        </div>

        <div className="p-4 space-y-2">
          {rules.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-zinc-800 bg-black/40 px-3 py-3 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="text-white font-black truncate">{wineName(r.wineId)}</div>
                <div className="text-xs text-zinc-500">
                  {t("Courses", "Courses")} {r.fromIdx} → {r.toIdx}
                </div>
              </div>
              <Btn onClick={() => remove(r.id)}>{t("DELETE", "DELETE")}</Btn>
            </div>
          ))}
          {!rules.length ? (
            <div className="text-zinc-500 text-sm">{t("No rules yet.", "No rules yet.")}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
