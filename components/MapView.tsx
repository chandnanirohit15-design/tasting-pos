"use client";

import React from "react";
import type { Table } from "../app/app-state";

export type MapPage = { id: string; label: string };
export type MapObjType = "TABLE_SQUARE" | "TABLE_ROUND" | "TABLE_RECT";
export type MapZone = { id: string; pageId: string; label?: string; x: number; y: number; w: number; h: number };
export type MapWall = { id: string; pageId: string; x: number; y: number; w: number; h: number };
export type MapTable = { pageId: string; x: number; y: number; w: number; h: number; obj: MapObjType; name?: string };

export type MapLayout = {
  version: number;
  pages: MapPage[];
  activePageId?: string;
  pageRects: Record<string, { w: number; h: number }>;
  zones: MapZone[];
  walls: MapWall[];
  tables: Record<number, MapTable>;
};

type MapViewProps = {
  layout: MapLayout | null;
  pageId?: string | null;
  tables: Table[];
  activeTableId?: number | null;
  onTableTap?: (tableId: number) => void;
  onTableDragOver?: (e: React.DragEvent) => void;
  onTableDrop?: (e: React.DragEvent, tableId: number) => void;
};

const LS_KEY = "tastingpos_layout_v5";
const DISPLAY_ORIGIN = { x: 22, y: 22 };
const PAGE_W = 900;
const PAGE_H = 756;

const DEFAULT_PAGES: MapPage[] = [
  { id: "rest", label: "RESTAURANTE" },
  { id: "terr", label: "TERRAZA" },
  { id: "vip", label: "ZONA VIP" },
];

function reservationLabel(t: any) {
  return t.reservationName || t?.reservation?.name || t?.reservation?.guestName || t?.guestName || "";
}

function normalizeLayout(raw: any): MapLayout | null {
  if (!raw) return null;

  const defaultRects = Object.fromEntries(DEFAULT_PAGES.map((p) => [p.id, { w: PAGE_W, h: PAGE_H }]));

  if (raw.version >= 6 && Array.isArray(raw.pages)) {
    const pages = raw.pages.length ? raw.pages : DEFAULT_PAGES;
    return {
      version: raw.version,
      pages,
      activePageId: raw.activePageId ?? pages[0]?.id,
      pageRects: raw.pageRects ?? defaultRects,
      zones: Array.isArray(raw.zones) ? raw.zones : [],
      walls: Array.isArray(raw.walls) ? raw.walls : [],
      tables: raw.tables ?? {},
    };
  }

  if (raw.mains || raw.mainLabels) {
    const labels = raw.mainLabels ?? {};
    const pages: MapPage[] = [
      { id: "rest", label: labels.RESTAURANTE || "RESTAURANTE" },
      { id: "terr", label: labels.TERRAZA || "TERRAZA" },
      { id: "vip", label: labels.VIP || "ZONA VIP" },
    ];
    const mainToPageId: Record<string, string> = {
      RESTAURANTE: "rest",
      TERRAZA: "terr",
      VIP: "vip",
    };

    const zones = Array.isArray(raw.zones)
      ? raw.zones.map((z: any) => ({ ...z, pageId: mainToPageId[z.main] ?? pages[0]?.id }))
      : [];
    const walls = Array.isArray(raw.walls)
      ? raw.walls.map((w: any) => ({ ...w, pageId: mainToPageId[w.main] ?? pages[0]?.id }))
      : [];

    const tables = raw.tables
      ? Object.fromEntries(
          Object.entries(raw.tables).map(([id, t]: [string, any]) => [
            Number(id),
            {
              x: t.x,
              y: t.y,
              w: t.w,
              h: t.h,
              pageId: mainToPageId[t.main] ?? pages[0]?.id,
              obj: t.obj ?? t.shape ?? "TABLE_SQUARE",
              name: t.name,
            } satisfies MapTable,
          ])
        )
      : {};

    return {
      version: 6,
      pages,
      activePageId: pages[0]?.id,
      pageRects: defaultRects,
      zones,
      walls,
      tables,
    };
  }

  return null;
}

export function loadLayoutFromStorage(): MapLayout | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return null;
  try {
    return normalizeLayout(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function MapView({ layout, pageId, tables, activeTableId, onTableTap, onTableDragOver, onTableDrop }: MapViewProps) {
  if (!layout) {
    return (
      <div className="h-full w-full rounded-2xl border border-zinc-800 bg-black/30 grid place-items-center text-zinc-500">
        No saved layout yet.
      </div>
    );
  }

  const activeId = pageId ?? layout.activePageId ?? layout.pages[0]?.id;
  const activePage = layout.pages.find((p) => p.id === activeId) ?? layout.pages[0];
  const pageRect = layout.pageRects[activePage.id] ?? { w: PAGE_W, h: PAGE_H };

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const zones = layout.zones.filter((z) => z.pageId === activePage.id);
  const walls = layout.walls.filter((w) => w.pageId === activePage.id);
  const pageTables = Object.entries(layout.tables)
    .map(([id, t]) => ({ id: Number(id), ...t }))
    .filter((t) => t.pageId === activePage.id);

  return (
    <div className="relative h-full w-full">
      <div className="relative" style={{ height: pageRect.h + 90 }}>
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 to-black/80" />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />

        <div
          className="absolute inset-0 pointer-events-none opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />

        <div
          className="absolute rounded-2xl border border-zinc-800/80 overflow-hidden"
          style={{
            left: DISPLAY_ORIGIN.x,
            top: DISPLAY_ORIGIN.y,
            width: pageRect.w,
            height: pageRect.h,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-amber-500/8 to-amber-500/0" />
          <div className="absolute inset-0 bg-black/18" />
          <div className="relative h-11 px-4 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/40">
            <div className="text-[11px] font-black tracking-widest text-zinc-200">MAP</div>
            <div className="text-[10px] text-zinc-500 font-mono tabular-nums">
              {pageRect.w}×{pageRect.h}
            </div>
          </div>
        </div>

        {zones.map((z) => (
          <div
            key={z.id}
            className="absolute rounded-2xl border border-zinc-800/80 bg-zinc-900/10 overflow-hidden"
            style={{ left: z.x, top: z.y, width: z.w, height: z.h }}
          >
            {z.label ? (
              <div className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-200">
                {z.label}
              </div>
            ) : null}
          </div>
        ))}

        {walls.map((w) => (
          <div
            key={w.id}
            className="absolute rounded border border-zinc-800/80 bg-zinc-500/40"
            style={{ left: w.x, top: w.y, width: w.w, height: w.h }}
          />
        ))}

        {pageTables.map((t) => {
          const appTable = tableById.get(t.id);
          const seatedName = appTable ? reservationLabel(appTable) : "";
          const rounded = t.obj === "TABLE_ROUND";
          const isActive = activeTableId === t.id;

          return (
            <div
              key={t.id}
              className={[
                "absolute border select-none backdrop-blur-md bg-black/35 overflow-hidden",
                rounded ? "rounded-full" : "rounded-2xl",
                isActive
                  ? "border-amber-400/90 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_10px_30px_rgba(0,0,0,0.55)]"
                  : "border-zinc-800/90 shadow-[0_10px_26px_rgba(0,0,0,0.55)]",
              ].join(" ")}
              style={{ left: t.x, top: t.y, width: t.w, height: t.h }}
              onClick={() => onTableTap?.(t.id)}
              onDragOver={onTableDragOver}
              onDrop={(e) => onTableDrop?.(e, t.id)}
              title={t.name || `T${t.id}`}
            >
              <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_55%)]" />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className={rounded ? "text-[18px] font-black text-white" : "text-[16px] font-black text-white"}>
                  {t.name || `T${t.id}`}
                </div>
                {seatedName ? (
                  <div className="mt-1 text-[11px] font-semibold text-zinc-300 max-w-[90%] truncate">
                    {seatedName}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
