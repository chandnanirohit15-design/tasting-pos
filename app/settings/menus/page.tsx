"use client";

import React from "react";
import { loadSettings, saveSettings, uid, type MenuId } from "../settings-store";
import { useI18n } from "../../i18n";

type MenuItem = { id: string; label: string; courses: string[] };

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

export default function MenusSettingsPage() {
  const { t } = useI18n();
  const [data, setData] = React.useState(loadSettings());
  const [activeId, setActiveId] = React.useState<MenuId>(data.menus[0]?.id || "");
  const [newLine, setNewLine] = React.useState("");

  const menu = data.menus.find((m) => m.id === activeId) || data.menus[0];
  const courses = menu?.courses || [];

  const commit = (next: typeof data) => {
    setData(next);
    saveSettings(next);
  };

  React.useEffect(() => {
    if (!data.menus.find((m) => m.id === activeId)) {
      setActiveId(data.menus[0]?.id || "");
    }
  }, [data.menus, activeId]);

  const updateMenu = (menuId: string, patch: Partial<MenuItem>) => {
    if (!menu) return;
    const nextMenus = data.menus.map((m) => (m.id === menuId ? { ...m, ...patch } : m));
    commit({ ...data, menus: nextMenus });
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...courses];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    updateMenu(menu.id, { courses: next });
  };

  const remove = (i: number) => {
    const next = courses.filter((_, idx) => idx !== i);
    updateMenu(menu.id, { courses: next });
  };

  const add = () => {
    const v = newLine.trim();
    if (!v) return;
    updateMenu(menu.id, { courses: [...courses, v] });
    setNewLine("");
  };

  // substitution presets
  const addPreset = () => {
    const v = prompt(t("New substitution preset?", "New substitution preset?"));
    if (!v) return;
    commit({ ...data, subsPresets: [...data.subsPresets, v.trim()] });
  };

  const removePreset = (i: number) => {
    commit({ ...data, subsPresets: data.subsPresets.filter((_, idx) => idx !== i) });
  };

  const addMenu = () => {
    const next = { id: uid("menu"), label: t("New Menu", "New Menu"), courses: [] };
    commit({ ...data, menus: [...data.menus, next] });
    setActiveId(next.id);
  };

  const deleteMenu = () => {
    if (data.menus.length <= 1) return;
    const nextMenus = data.menus.filter((m) => m.id !== menu.id);
    commit({ ...data, menus: nextMenus });
    setActiveId(nextMenus[0]?.id || "");
  };

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6 overflow-y-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-black text-white">{t("Edit Menu", "Edit Menu")}</div>
          <div className="text-zinc-400 mt-1 text-sm">
            {t("This affects Room + Kitchen immediately (offline local).", "This affects Room + Kitchen immediately (offline local).")}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={addMenu}
            className="px-4 py-2 rounded-xl text-xs font-black border transition bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
          >
            {t("+ MENU", "+ MENU")}
          </button>
          <button
            onClick={deleteMenu}
            disabled={data.menus.length <= 1}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              data.menus.length <= 1
                ? "bg-zinc-900 text-zinc-500 border-zinc-800 cursor-not-allowed"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {t("DELETE MENU", "DELETE MENU")}
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-12 gap-5">
        <div className="col-span-7 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
            <div className="text-sm font-black text-white">
              {t("Courses", "Courses")} — {menu?.label || t("Menu", "Menu")}
            </div>
            <div className="text-xs text-zinc-500">
              {courses.length} {t("courses", "courses")}
            </div>
          </div>

          <div className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex-1">
                <div className="text-xs font-black text-zinc-300 mb-2">
                  {t("Menu name (shows in Room)", "Menu name (shows in Room)")}
                </div>
                <input
                  value={menu?.label || ""}
                  onChange={(e) => updateMenu(menu.id, { label: e.target.value })}
                  className="w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
                  placeholder={t("Classic / Seasonal / Vegetarian…", "Classic / Seasonal / Vegetarian…")}
                />
              </div>
              <div className="shrink-0">
                <div className="text-xs font-black text-zinc-300 mb-2">{t("MENU", "MENU")}</div>
                <div className="flex flex-wrap gap-2">
                  {data.menus.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setActiveId(m.id)}
                      className={[
                        "px-3 py-2 rounded-xl text-xs font-black border transition",
                        m.id === menu?.id
                          ? "bg-amber-500 text-black border-amber-400"
                          : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
                      ].join(" ")}
                    >
                      {m.label || t("Menu", "Menu")}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                value={newLine}
                onChange={(e) => setNewLine(e.target.value)}
                placeholder={t("Add new course…", "Add new course…")}
                className="flex-1 rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
              />
              <Btn onClick={add}>{t("ADD", "ADD")}</Btn>
            </div>

            <div className="mt-4 space-y-2">
              {courses.map((c, i) => (
                <div
                  key={`${c}_${i}`}
                  className="rounded-2xl border border-zinc-800 bg-black/40 px-3 py-3 flex items-center justify-between gap-3"
                >
                    <div className="min-w-0">
                      <div className="text-xs text-zinc-500 font-mono">#{i + 1}</div>
                      <div className="text-white font-black truncate">{c}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Btn onClick={() => move(i, -1)}>↑</Btn>
                      <Btn onClick={() => move(i, 1)}>↓</Btn>
                      <Btn onClick={() => remove(i)}>{t("DELETE", "DELETE")}</Btn>
                    </div>
                  </div>
                ))}
              {!courses.length ? (
                <div className="text-zinc-500 text-sm mt-4">{t("No courses yet.", "No courses yet.")}</div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="col-span-5 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
            <div className="text-sm font-black text-white">{t("Substitution presets", "Substitution presets")}</div>
            <Btn onClick={addPreset}>{t("+ PRESET", "+ PRESET")}</Btn>
          </div>
          <div className="p-4 space-y-2">
            {data.subsPresets.map((p, i) => (
              <div
                key={`${p}_${i}`}
                className="rounded-2xl border border-zinc-800 bg-black/40 px-3 py-3 flex items-center justify-between gap-3"
              >
                <div className="text-white font-bold truncate">{p}</div>
                <Btn onClick={() => removePreset(i)}>{t("DELETE", "DELETE")}</Btn>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
