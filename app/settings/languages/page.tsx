"use client";

import React from "react";
import { useI18n, type UiLang } from "../../i18n";

const options: Array<{ id: UiLang; label: string }> = [
  { id: "en", label: "English" },
  { id: "es", label: "Espanol" },
  { id: "ca", label: "Catala" },
];

export default function LanguagesSettingsPage() {
  const { lang, setLang, t } = useI18n();

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6 overflow-y-auto">
      <div className="text-2xl font-black text-white">{t("Languages", "Languages")}</div>
      <div className="text-zinc-400 mt-1">{t("Language for this device", "Language for this device")}</div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 max-w-xl">
        <div className="text-xs font-black text-zinc-300">{t("Language", "Language")}</div>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value as UiLang)}
          className="mt-3 w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
