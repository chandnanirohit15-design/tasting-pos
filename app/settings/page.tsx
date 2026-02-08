"use client";

import Link from "next/link";
import React from "react";
import { useI18n } from "../i18n";

function Card({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  const { t } = useI18n();
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-zinc-800 bg-zinc-950/50 hover:bg-zinc-900/40 transition p-5"
    >
      <div className="text-lg font-black text-white">{title}</div>
      <div className="text-sm text-zinc-400 mt-1">{subtitle}</div>
      <div className="mt-4 text-xs font-black text-amber-300">{t("OPEN →", "OPEN →")}</div>
    </Link>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  return (
    <div className="h-full w-full bg-[#0f0f12] p-6 overflow-y-auto">
      <div className="text-2xl font-black text-white">{t("Settings", "Settings")}</div>
      <div className="text-zinc-400 mt-1">{t("UI-first. Offline. Sync/database later.", "UI-first. Offline. Sync/database later.")}</div>

      <div className="mt-6 grid grid-cols-3 gap-5">
        <Card href="/settings/map-builder" title={t("Map Builder", "Map Builder")} subtitle={t("Build the floor plan", "Build the floor plan")} />
        <Card href="/settings/menus" title={t("Edit Menu", "Edit Menu")} subtitle={t("Menu A/B courses + substitution presets", "Menu A/B courses + substitution presets")} />
        <Card href="/settings/wines" title={t("Edit Wine", "Edit Wine")} subtitle={t("Wine list for maridaje", "Wine list for maridaje")} />
        <Card href="/settings/pairing" title={t("Pairing", "Pairing")} subtitle={t("Map wines to courses (ranges)", "Map wines to courses (ranges)")} />
        <Card href="/settings/languages" title={t("Languages", "Languages")} subtitle={t("Language for this device", "Language for this device")} />
      </div>
    </div>
  );
}
