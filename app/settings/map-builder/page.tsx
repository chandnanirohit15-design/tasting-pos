'use client';

import React from 'react';
import { useAppState } from '../../app-state';
import { useI18n } from '../../i18n';

type ObjType = 'TABLE_SQUARE' | 'TABLE_ROUND' | 'TABLE_RECT';

type MapPage = { id: string; label: string };

type AreaZone = {
  id: string;
  pageId: string;
  label?: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type Wall = {
  id: string;
  pageId: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

type LayoutTablePatch = {
  x: number;
  y: number;
  w: number;
  h: number;
  pageId: string;
  obj: ObjType;
  name?: string;
};

type LayoutPayload = {
  version: number;
  pages: MapPage[];
  pageRects: Record<string, { x: number; y: number; w: number; h: number }>;
  zones: AreaZone[];
  walls: Wall[];
  tables: Record<number, LayoutTablePatch>;
};

const LEGACY_KEY = 'tastingpos_layout_v5';
const LS_KEY = 'tastingpos_layout_v6';

// Active page is always edited at this origin (viewport shift)
const DISPLAY_ORIGIN = { x: 22, y: 22 };

// All pages same size (your request)
const PAGE_W = 900;
const PAGE_H = 756;

// Internal snap (we keep it simple + fast)
const SNAP = 20;

const uid = () => Math.random().toString(36).slice(2) + '_' + Date.now().toString(16);

const DEFAULT_PAGES: MapPage[] = [
  { id: 'rest', label: 'RESTAURANTE' },
  { id: 'terr', label: 'TERRAZA' },
  { id: 'vip', label: 'ZONA VIP' },
];

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function snap(v: number) {
  return Math.round(v / SNAP) * SNAP;
}
function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getPageId(t: any, fallback: string) {
  return (t.pageId as string) || fallback;
}

function getObj(t: any): ObjType {
  const s = (t.obj as string) || (t.shape as string) || 'TABLE_SQUARE';
  if (s === 'SQUARE') return 'TABLE_SQUARE';
  if (s === 'ROUND') return 'TABLE_ROUND';
  if (s === 'RECT') return 'TABLE_RECT';

  if (s === 'UMBRELLA' || s === 'BAR_SEATS' || s === 'TERRACE' || s === 'BAR') return 'TABLE_SQUARE';

  return (s as ObjType) || 'TABLE_SQUARE';
}

function getSize(t: any) {
  const w = Number.isFinite(t.w) ? t.w : 92;
  const h = Number.isFinite(t.h) ? t.h : 92;
  return { w, h };
}

const PAGE_TINTS = ['from-amber-500/8 to-amber-500/0', 'from-emerald-500/10 to-emerald-500/0', 'from-fuchsia-500/10 to-fuchsia-500/0'];

function pageTint(index: number) {
  return PAGE_TINTS[index % PAGE_TINTS.length];
}

type Selected =
  | { kind: 'table'; id: number }
  | { kind: 'zone'; id: string }
  | { kind: 'wall'; id: string }
  | null;

/* ---------- Object renderers ---------- */

function reservationLabel(t: any) {
  // UI-only: show reservation name if it exists on table object
  // (works later when you add real reservation binding)
  return (
    t.reservationName ||
    t?.reservation?.name ||
    t?.reservation?.guestName ||
    t?.guestName ||
    ''
  );
}

/* ---------- Component ---------- */

export default function MapBuilderPage() {
  const { t } = useI18n();
  const { tables, setTables } = useAppState();
  const canvasRef = React.useRef<HTMLDivElement | null>(null);

  const [pages, setPages] = React.useState<MapPage[]>(DEFAULT_PAGES);
  const [activePageId, setActivePageId] = React.useState<string>(DEFAULT_PAGES[0]?.id ?? 'rest');
  const [mode, setMode] = React.useState<'select' | 'zone' | 'wall'>('select');

  const [pageRects, setPageRects] = React.useState<Record<string, { x: number; y: number; w: number; h: number }>>(() =>
    Object.fromEntries(DEFAULT_PAGES.map((p) => [p.id, { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H }]))
  );

  const [zones, setZones] = React.useState<AreaZone[]>([]);
  const [walls, setWalls] = React.useState<Wall[]>([]);

  const [selected, setSelected] = React.useState<Selected>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const [drag, setDrag] = React.useState<{
    pointerId: number;
    kind: 'table' | 'zone' | 'wall' | 'resizeTable' | 'resizeZone' | 'resizeWall';
    id: number | string;
    offsetX: number;
    offsetY: number;
    startW?: number;
    startH?: number;
  } | null>(null);

  React.useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 1300);
    return () => clearTimeout(id);
  }, [toast]);

  const fallbackPageId = pages[0]?.id ?? 'rest';
  const activePageRect = pageRects[activePageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };

  // Single display origin for all pages (no world shift needed)
  const viewOffset = React.useMemo(() => {
    return { x: 0, y: 0 };
  }, []);

  const toWorld = React.useCallback((sx: number, sy: number) => ({ x: sx + viewOffset.x, y: sy + viewOffset.y }), [
    viewOffset.x,
    viewOffset.y,
  ]);
  const toScreen = React.useCallback((wx: number, wy: number) => ({ x: wx - viewOffset.x, y: wy - viewOffset.y }), [
    viewOffset.x,
    viewOffset.y,
  ]);

  const save = React.useCallback(() => {
    const payload: LayoutPayload = {
      version: 6,
      pages,
      pageRects,
      zones,
      walls,
      tables: Object.fromEntries(
        (tables as any[]).map((t) => [
          t.id,
          {
            x: t.x,
            y: t.y,
            w: getSize(t).w,
            h: getSize(t).h,
            pageId: getPageId(t, fallbackPageId),
            obj: getObj(t),
            name: t.name,
          } satisfies LayoutTablePatch,
        ])
      ),
    };
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
    setToast(t('Saved', 'Saved'));
  }, [fallbackPageId, pageRects, pages, zones, walls, tables]);

  // Load + migrate (normalize to dynamic pages)
  React.useEffect(() => {
    const raw =
      safeParse<any>(localStorage.getItem(LS_KEY)) ??
      safeParse<any>(localStorage.getItem(LEGACY_KEY));
    if (!raw) return;

    const mainToPageId: Record<string, string> = {
      RESTAURANTE: 'rest',
      TERRAZA: 'terr',
      VIP: 'vip',
    };

    let nextPages = DEFAULT_PAGES;
    let nextPageRects: Record<string, { x: number; y: number; w: number; h: number }> = Object.fromEntries(
      DEFAULT_PAGES.map((p) => [p.id, { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H }])
    );
    let nextActivePageId: string | undefined = DEFAULT_PAGES[0]?.id;
    let nextZones: AreaZone[] = [];
    let nextWalls: Wall[] = [];
    let nextTables: Record<number, LayoutTablePatch> = {};

    if (raw.version >= 6 && Array.isArray(raw.pages)) {
      nextPages = raw.pages;
      nextPageRects = raw.pageRects ?? nextPageRects;
      nextActivePageId = raw.pages[0]?.id ?? DEFAULT_PAGES[0]?.id;
      nextZones = Array.isArray(raw.zones) ? raw.zones : [];
      nextWalls = Array.isArray(raw.walls) ? raw.walls : [];
      nextTables = raw.tables ?? {};
    } else if (raw.mains || raw.mainLabels) {
      const labels = raw.mainLabels ?? {};
      nextPages = [
        { id: 'rest', label: labels.RESTAURANTE || 'RESTAURANTE' },
        { id: 'terr', label: labels.TERRAZA || 'TERRAZA' },
        { id: 'vip', label: labels.VIP || 'ZONA VIP' },
      ];
      nextPageRects = {
        rest: {
          x: raw.mains?.RESTAURANTE?.x ?? DISPLAY_ORIGIN.x,
          y: raw.mains?.RESTAURANTE?.y ?? DISPLAY_ORIGIN.y,
          w: PAGE_W,
          h: PAGE_H,
        },
        terr: {
          x: raw.mains?.TERRAZA?.x ?? DISPLAY_ORIGIN.x,
          y: raw.mains?.TERRAZA?.y ?? DISPLAY_ORIGIN.y,
          w: PAGE_W,
          h: PAGE_H,
        },
        vip: {
          x: raw.mains?.VIP?.x ?? DISPLAY_ORIGIN.x,
          y: raw.mains?.VIP?.y ?? DISPLAY_ORIGIN.y,
          w: PAGE_W,
          h: PAGE_H,
        },
      };
      nextActivePageId = nextPages[0]?.id;

      nextZones = Array.isArray(raw.zones)
        ? raw.zones.map((z: any) => ({ ...z, pageId: mainToPageId[z.main] ?? nextPages[0]?.id }))
        : [];
      nextWalls = Array.isArray(raw.walls)
        ? raw.walls.map((w: any) => ({ ...w, pageId: mainToPageId[w.main] ?? nextPages[0]?.id }))
        : [];

      if (raw.tables) {
        nextTables = Object.fromEntries(
          Object.entries(raw.tables).map(([id, t]: [string, any]) => [
            Number(id),
            {
              x: t.x,
              y: t.y,
              w: t.w,
              h: t.h,
              pageId: mainToPageId[t.main] ?? nextPages[0]?.id,
              obj: t.obj ?? t.shape ?? 'TABLE_SQUARE',
              name: t.name,
            } satisfies LayoutTablePatch,
          ])
        );
      }

      const upgraded: LayoutPayload = {
        version: 6,
        pages: nextPages,
        pageRects: nextPageRects,
        zones: nextZones,
        walls: nextWalls,
        tables: nextTables,
      };
      localStorage.setItem(LS_KEY, JSON.stringify(upgraded));
    } else {
      return;
    }

    nextPages.forEach((p) => {
      if (!nextPageRects[p.id]) {
        nextPageRects[p.id] = { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
        return;
      }
      const rect = nextPageRects[p.id];
      nextPageRects[p.id] = {
        x: rect.x ?? DISPLAY_ORIGIN.x,
        y: rect.y ?? DISPLAY_ORIGIN.y,
        w: PAGE_W,
        h: PAGE_H,
      };
    });

    setPages(nextPages);
    setPageRects(nextPageRects);
    setActivePageId(nextActivePageId ?? nextPages[0]?.id ?? DEFAULT_PAGES[0]?.id);
    setZones(nextZones);
    setWalls(nextWalls);

    if (nextTables) {
      setTables((prev) =>
        prev.map((t: any) => {
          const p = nextTables[t.id];
          if (!p) return t;
          return {
            ...t,
            x: p.x,
            y: p.y,
            w: p.w,
            h: p.h,
            pageId: p.pageId,
            obj: p.obj,
            name: p.name ?? t.name,
          };
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportNow = React.useCallback(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const blob = new Blob([raw], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tastingpos-layout.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, []);

  const importFromPrompt = React.useCallback(() => {
    const raw = window.prompt(t('Paste layout JSON:', 'Paste layout JSON:'));
    if (!raw) return;
    const parsed = safeParse<any>(raw);
    if (!parsed) {
      setToast(t('Invalid JSON', 'Invalid JSON'));
      return;
    }
    localStorage.setItem(LS_KEY, raw);
    window.location.reload();
  }, []);

  const reset = React.useCallback(() => {
    localStorage.removeItem(LS_KEY);
    window.location.reload();
  }, []);

  const visibleTables = React.useMemo(
    () => (tables as any[]).filter((t) => getPageId(t, fallbackPageId) === activePageId),
    [tables, activePageId, fallbackPageId]
  );
  const visibleZones = React.useMemo(() => zones.filter((z) => z.pageId === activePageId), [zones, activePageId]);
  const visibleWalls = React.useMemo(() => walls.filter((w) => w.pageId === activePageId), [walls, activePageId]);

  const sortedTables = React.useMemo(() => {
    return [...(tables as any[])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [tables]);

  const selectedTable = React.useMemo(() => {
    if (!selected || selected.kind !== 'table') return null;
    return (tables as any[]).find((t) => t.id === selected.id) ?? null;
  }, [selected, tables]);

  const selectedZone = React.useMemo(() => {
    if (!selected || selected.kind !== 'zone') return null;
    return zones.find((z) => z.id === selected.id) ?? null;
  }, [selected, zones]);

  const selectedWall = React.useMemo(() => {
    if (!selected || selected.kind !== 'wall') return null;
    return walls.find((w) => w.id === selected.id) ?? null;
  }, [selected, walls]);

  const clampIntoPage = React.useCallback(
    (pageId: string, x: number, y: number, w: number, h: number) => {
      const r = pageRects[pageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
      const pad = 14;
      const header = 44;
      const minX = r.x + pad;
      const minY = r.y + header;
      const maxX = r.x + r.w - w - pad;
      const maxY = r.y + r.h - h - pad;
      return { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
    },
    [pageRects]
  );

  const setTablePatch = (id: number, patch: Partial<LayoutTablePatch & { name: string }>) => {
    setTables((prev) =>
      prev.map((t: any) => {
        if (t.id !== id) return t;

        const pageId = (patch.pageId ?? t.pageId ?? fallbackPageId) as string;
        const obj = (patch.obj ?? getObj(t)) as ObjType;

        let w = Number.isFinite(patch.w) ? (patch.w as number) : getSize(t).w;
        let h = Number.isFinite(patch.h) ? (patch.h as number) : getSize(t).h;

        // Round must be circle
        if (obj === 'TABLE_ROUND') {
          const s = Math.max(w, h);
          w = s;
          h = s;
        }

        let x = Number.isFinite(patch.x) ? (patch.x as number) : t.x;
        let y = Number.isFinite(patch.y) ? (patch.y as number) : t.y;

        x = snap(x);
        y = snap(y);

        const clamped = clampIntoPage(pageId, x, y, w, h);

        return {
          ...t,
          name: patch.name ?? t.name,
          pageId,
          obj,
          w,
          h,
          x: clamped.x,
          y: clamped.y,
        };
      })
    );
  };

  const setZonePatch = (id: string, patch: Partial<AreaZone>) => {
    setZones((prev) =>
      prev.map((z) => {
        if (z.id !== id) return z;
        const next = { ...z, ...patch };
        const r = pageRects[next.pageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
        const pad = 14;
        const header = 44;
        next.w = clamp(next.w, 80, r.w - pad * 2);
        next.h = clamp(next.h, 60, r.h - header - pad);
        next.x = clamp(next.x, r.x + pad, r.x + r.w - next.w - pad);
        next.y = clamp(next.y, r.y + header, r.y + r.h - next.h - pad);
        return next;
      })
    );
  };

  const setWallPatch = (id: string, patch: Partial<Wall>) => {
    setWalls((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w, ...patch };
        const r = pageRects[next.pageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
        const pad = 14;
        const header = 44;
        next.w = clamp(next.w, 20, r.w - pad * 2);
        next.h = clamp(next.h, 6, r.h - header - pad);
        next.x = clamp(next.x, r.x + pad, r.x + r.w - next.w - pad);
        next.y = clamp(next.y, r.y + header, r.y + r.h - next.h - pad);
        return next;
      })
    );
  };

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(sx, sy);

    const r = activePageRect;
    const pad = 14;
    const header = 44;

    const inside =
      wx >= r.x + pad &&
      wx <= r.x + r.w - pad &&
      wy >= r.y + header &&
      wy <= r.y + r.h - pad;

    if (!inside) return;

    if (mode === 'zone') {
      const z: AreaZone = {
        id: uid(),
        pageId: activePageId,
        x: snap(wx - 120),
        y: snap(wy - 80),
        w: 240,
        h: 160,
      };
      z.x = clamp(z.x, r.x + pad, r.x + r.w - z.w - pad);
      z.y = clamp(z.y, r.y + header, r.y + r.h - z.h - pad);
      setZones((p) => [z, ...p]);
      setSelected({ kind: 'zone', id: z.id });
      setMode('select');
      save();
      return;
    }

    if (mode === 'wall') {
      const w: Wall = {
        id: uid(),
        pageId: activePageId,
        x: snap(wx - 140),
        y: snap(wy),
        w: 280,
        h: 10,
      };
      w.x = clamp(w.x, r.x + pad, r.x + r.w - w.w - pad);
      w.y = clamp(w.y, r.y + header, r.y + r.h - w.h - pad);
      setWalls((p) => [w, ...p]);
      setSelected({ kind: 'wall', id: w.id });
      setMode('select');
      save();
      return;
    }

    setSelected(null);
  };

  const startDrag = (
    e: React.PointerEvent,
    kind: 'table' | 'zone' | 'wall',
    id: number | string,
    worldX: number,
    worldY: number
  ) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(sx, sy);

    setDrag({
      pointerId: e.pointerId,
      kind,
      id,
      offsetX: wx - worldX,
      offsetY: wy - worldY,
    });

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const startResize = (
    e: React.PointerEvent,
    kind: 'resizeTable' | 'resizeZone' | 'resizeWall',
    id: number | string,
    startW: number,
    startH: number
  ) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(sx, sy);

    setDrag({
      pointerId: e.pointerId,
      kind,
      id,
      offsetX: wx,
      offsetY: wy,
      startW,
      startH,
    });

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const { x: wx, y: wy } = toWorld(sx, sy);

    if (drag.kind === 'table') {
      setTables((prev) =>
        prev.map((t: any) => {
          if (t.id !== drag.id) return t;
          const pageId = getPageId(t, fallbackPageId);
          const obj = getObj(t);
          const { w, h } = getSize(t);

          const rawX = wx - drag.offsetX;
          const rawY = wy - drag.offsetY;

          const nx = snap(rawX);
          const ny = snap(rawY);

          const clamped = clampIntoPage(pageId, nx, ny, w, h);
          return { ...t, x: clamped.x, y: clamped.y, obj, pageId };
        })
      );
      return;
    }

    if (drag.kind === 'zone') {
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== drag.id) return z;
          const r = pageRects[z.pageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
          const pad = 14;
          const header = 44;

          const rawX = wx - drag.offsetX;
          const rawY = wy - drag.offsetY;

          const nx = snap(rawX);
          const ny = snap(rawY);

          const minX = r.x + pad;
          const minY = r.y + header;
          const maxX = r.x + r.w - z.w - pad;
          const maxY = r.y + r.h - z.h - pad;

          return { ...z, x: clamp(nx, minX, maxX), y: clamp(ny, minY, maxY) };
        })
      );
      return;
    }

    if (drag.kind === 'wall') {
      setWalls((prev) =>
        prev.map((w) => {
          if (w.id !== drag.id) return w;
          const r = pageRects[w.pageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
          const pad = 14;
          const header = 44;

          const rawX = wx - drag.offsetX;
          const rawY = wy - drag.offsetY;

          const nx = snap(rawX);
          const ny = snap(rawY);

          const minX = r.x + pad;
          const minY = r.y + header;
          const maxX = r.x + r.w - w.w - pad;
          const maxY = r.y + r.h - w.h - pad;

          return { ...w, x: clamp(nx, minX, maxX), y: clamp(ny, minY, maxY) };
        })
      );
      return;
    }

    if (drag.kind === 'resizeTable') {
      const id = drag.id as number;
      const t = (tables as any[]).find((tt) => tt.id === id);
      if (!t) return;

      const dx = wx - drag.offsetX;
      const dy = wy - drag.offsetY;

      let nw = snap((drag.startW ?? getSize(t).w) + dx);
      let nh = snap((drag.startH ?? getSize(t).h) + dy);

      nw = clamp(nw, 60, 560);
      nh = clamp(nh, 60, 360);

      const obj = getObj(t);
      if (obj === 'TABLE_ROUND') {
        const s = Math.max(nw, nh);
        nw = s;
        nh = s;
      }

      setTablePatch(id, { w: nw, h: nh });
      return;
    }

    if (drag.kind === 'resizeZone') {
      const id = drag.id as string;
      const z = zones.find((zz) => zz.id === id);
      if (!z) return;
      const dx = wx - drag.offsetX;
      const dy = wy - drag.offsetY;
      const nw = snap((drag.startW ?? z.w) + dx);
      const nh = snap((drag.startH ?? z.h) + dy);
      setZonePatch(id, { w: nw, h: nh });
      return;
    }

    if (drag.kind === 'resizeWall') {
      const id = drag.id as string;
      const w = walls.find((ww) => ww.id === id);
      if (!w) return;
      const dx = wx - drag.offsetX;
      const dy = wy - drag.offsetY;
      const nw = snap((drag.startW ?? w.w) + dx);
      const nh = snap((drag.startH ?? w.h) + dy);
      setWallPatch(id, { w: nw, h: nh });
      return;
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(drag.pointerId);
    } catch {}
    setDrag(null);
    save();
  };

  const addTable = React.useCallback(() => {
    setTables((prev: any[]) => {
      const maxId = prev.reduce((m, t) => Math.max(m, Number(t.id) || 0), 0);
      const nextId = maxId + 1;

      const r = pageRects[activePageId] ?? { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H };
      const pad = 14;
      const header = 44;

      const x = snap(r.x + pad + 80);
      const y = snap(r.y + header + 80);

      const newTable = {
        id: nextId,
        name: `T${nextId}`,
        pageId: activePageId,
        obj: 'TABLE_SQUARE',
        w: 92,
        h: 92,
        x: clamp(x, r.x + pad, r.x + r.w - 92 - pad),
        y: clamp(y, r.y + header, r.y + r.h - 92 - pad),
      };

      return [...prev, newTable];
    });

    setToast(t('Table added', 'Table added'));
    setTimeout(() => save(), 0);
  }, [activePageId, pageRects, save, setTables]);

  const addPage = React.useCallback(() => {
    const id = `p_${Date.now().toString(36)}`;
    const label = 'NEW PAGE';
    setPages((prev) => [...prev, { id, label }]);
    setPageRects((prev) => ({ ...prev, [id]: { x: DISPLAY_ORIGIN.x, y: DISPLAY_ORIGIN.y, w: PAGE_W, h: PAGE_H } }));
    setActivePageId(id);
    setToast(t('Page added', 'Page added'));
    setTimeout(() => save(), 0);
  }, [pages.length, save]);

  const deletePage = React.useCallback(
    (pageId: string) => {
      if (pages.length <= 1) {
        setToast(t('At least one page is required', 'At least one page is required'));
        return;
      }
      const page = pages.find((p) => p.id === pageId);
      const pageName = page?.label || t('page', 'page');
      const ok = window.confirm(
        `${t('Delete', 'Delete')} ${pageName}? ${t('Zones/walls will be removed, tables moved.', 'Zones/walls will be removed, tables moved.')}`
      );
      if (!ok) return;

      const remaining = pages.filter((p) => p.id !== pageId);
      const nextActive = remaining[0]?.id ?? fallbackPageId;

      setPages(remaining);
      setPageRects((prev) => {
        const next = { ...prev };
        delete next[pageId];
        return next;
      });
      setZones((prev) => prev.filter((z) => z.pageId !== pageId));
      setWalls((prev) => prev.filter((w) => w.pageId !== pageId));
      setTables((prev) =>
        prev.map((t: any) => (getPageId(t, nextActive) === pageId ? { ...t, pageId: nextActive } : t))
      );
      if (activePageId === pageId) setActivePageId(nextActive);
      setTimeout(() => save(), 0);
    },
    [activePageId, fallbackPageId, pages, save, setTables, setWalls, setZones]
  );

  const removeSelected = () => {
    if (!selected) return;

    if (selected.kind === 'table') {
      setTables((p) => p.filter((t: any) => t.id !== selected.id));
    }
    if (selected.kind === 'zone') {
      setZones((p) => p.filter((z) => z.id !== selected.id));
    }
    if (selected.kind === 'wall') {
      setWalls((p) => p.filter((w) => w.id !== selected.id));
    }

    setSelected(null);
    save();
  };

  const applyPreset = (preset: 'S' | 'M' | 'L' | 'RECT' | 'BIG') => {
    if (!selectedTable) return;
    const id = selectedTable.id;
    if (preset === 'S') return setTablePatch(id, { w: 72, h: 72 });
    if (preset === 'M') return setTablePatch(id, { w: 92, h: 92 });
    if (preset === 'L') return setTablePatch(id, { w: 120, h: 120 });
    if (preset === 'RECT') return setTablePatch(id, { w: 190, h: 92, obj: 'TABLE_RECT' });
    return setTablePatch(id, { w: 280, h: 120, obj: 'TABLE_RECT' });
  };

  const pageById = React.useMemo(() => new Map(pages.map((p) => [p.id, p])), [pages]);
  const pageLabel = pageById.get(activePageId)?.label || t('PAGE', 'PAGE');
  const activePageIndex = Math.max(0, pages.findIndex((p) => p.id === activePageId));

  return (
    <div className="h-full w-full bg-[#0b0b0e] text-white">
      <div className="px-6 pt-6">
        <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-950/80 to-black/50 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)] overflow-hidden">
          {/* Top bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800/70">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-zinc-900 border border-zinc-800 grid place-items-center">
                <div className="h-2.5 w-2.5 rounded bg-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.6)]" />
              </div>
              <div>
                <div className="text-lg font-black leading-tight">{t('Map Builder', 'Map Builder')}</div>
                <div className="text-xs text-zinc-400">
                  {t('Build map here • During service it’s locked • Offline save', 'Build map here • During service it’s locked • Offline save')}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button onClick={save} className={topBtnPrimary}>{t('SAVE', 'SAVE')}</button>
              <button onClick={exportNow} className={topBtn}>{t('EXPORT', 'EXPORT')}</button>
              <button onClick={importFromPrompt} className={topBtn}>{t('IMPORT', 'IMPORT')}</button>
              <button onClick={reset} className={topBtn}>{t('RESET', 'RESET')}</button>
            </div>
          </div>

          {/* Tabs + tools */}
          <div className="px-4 py-3 border-b border-zinc-800/70 bg-black/30 flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2 flex-wrap">
              {pages.map((p) => (
                <div key={p.id} className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setActivePageId(p.id);
                      setSelected(null);
                      setMode('select');
                    }}
                    className={[
                      "px-4 py-2 rounded-xl text-xs font-black border transition",
                      activePageId === p.id
                        ? "bg-amber-500 text-black border-amber-400"
                        : "bg-zinc-950/40 text-zinc-200 border-zinc-800 hover:bg-zinc-900/40",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePage(p.id);
                    }}
                    className="h-8 w-8 rounded-xl border border-zinc-800 bg-zinc-950/40 text-zinc-400 hover:text-white hover:border-zinc-700"
                    title={t('Page options', 'Page options')}
                  >
                    ⋯
                  </button>
                </div>
              ))}
              <button onClick={addPage} className={pill}>
                + {t('PAGE', 'PAGE')}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setMode('select')} className={mode === 'select' ? pillActive : pill}>
                {t('SELECT', 'SELECT')}
              </button>
              <button onClick={addTable} className={pill}>
                + {t('TABLE', 'TABLE')}
              </button>
              <button onClick={() => setMode('zone')} className={mode === 'zone' ? pillActive : pill}>
                + {t('ZONE', 'ZONE')}
              </button>
              <button onClick={() => setMode('wall')} className={mode === 'wall' ? pillActive : pill}>
                + {t('WALL', 'WALL')}
              </button>
              {selected ? (
                <button onClick={removeSelected} className={pill}>
                  {t('DELETE', 'DELETE')}
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-12 gap-4 p-4">
            {/* Left panel */}
            <div className="col-span-3 rounded-2xl border border-zinc-800 bg-black/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/70 bg-zinc-950/40">
                <div className="text-xs font-black tracking-widest text-zinc-300">{t('SETTINGS', 'SETTINGS')}</div>
              </div>

              <div className="p-4 space-y-4">
                {/* Page rename */}
                <div className="rounded-2xl border border-zinc-800 bg-black/25 p-4">
                  <div className="text-[11px] font-black tracking-widest text-zinc-500">{t('PAGE NAME', 'PAGE NAME')}</div>
                  <div className="mt-2 text-sm text-zinc-300">
                    {t('Editing:', 'Editing:')} <span className="font-black text-white">{pageLabel}</span>
                  </div>
                  <input
                    className={input + ' mt-2'}
                    value={pageById.get(activePageId)?.label || ''}
                    placeholder={t('(optional label)', '(optional label)')}
                    onChange={(e) =>
                      setPages((prev) =>
                        prev.map((p) => (p.id === activePageId ? { ...p, label: e.target.value.slice(0, 18) } : p))
                      )
                    }
                    onBlur={save}
                  />
                </div>

                {/* Selected inspector */}
                <div className="rounded-2xl border border-zinc-800 bg-black/25 p-4">
                  <div className="text-[11px] font-black tracking-widest text-zinc-500">{t('SELECTED', 'SELECTED')}</div>

                  {selectedTable ? (
                    <>
                      <div className="mt-2 text-white font-black">{selectedTable.name}</div>

                      <div className="mt-3">
                        <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-2">
                          {t('TABLE NAME / NUMBER', 'TABLE NAME / NUMBER')}
                        </div>
                        <input
                          value={selectedTable.name}
                          onChange={(e) => {
                            const v = e.target.value.slice(0, 12);
                            setTables((prev) =>
                              prev.map((t: any) => (t.id === selectedTable.id ? { ...t, name: v } : t))
                            );
                          }}
                          onBlur={save}
                          placeholder="T12"
                          className={input}
                        />
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-2">{t('OBJECT', 'OBJECT')}</div>
                        <div className="grid grid-cols-2 gap-2">
                          <ObjBtn
                            label={t('SQUARE', 'SQUARE')}
                            active={getObj(selectedTable) === 'TABLE_SQUARE'}
                            onClick={() => { setTablePatch(selectedTable.id, { obj: 'TABLE_SQUARE' }); save(); }}
                          />
                          <ObjBtn
                            label={t('ROUND', 'ROUND')}
                            active={getObj(selectedTable) === 'TABLE_ROUND'}
                            onClick={() => { setTablePatch(selectedTable.id, { obj: 'TABLE_ROUND' }); save(); }}
                          />
                          <ObjBtn
                            label={t('RECT', 'RECT')}
                            active={getObj(selectedTable) === 'TABLE_RECT'}
                            onClick={() => { setTablePatch(selectedTable.id, { obj: 'TABLE_RECT' }); save(); }}
                          />
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-2">{t('SIZE PRESETS', 'SIZE PRESETS')}</div>
                        <div className="grid grid-cols-5 gap-2">
                          <button onClick={() => applyPreset('S')} className={miniBtn}>S</button>
                          <button onClick={() => applyPreset('M')} className={miniBtn}>M</button>
                          <button onClick={() => applyPreset('L')} className={miniBtn}>L</button>
                          <button onClick={() => applyPreset('RECT')} className={miniBtn}>RECT</button>
                          <button onClick={() => applyPreset('BIG')} className={miniBtn}>BIG</button>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <Field label={t('Width', 'Width')}>
                          <input
                            type="number"
                            value={getSize(selectedTable).w}
                            onChange={(e) => {
                              const v = clamp(parseInt(e.target.value || '0', 10), 60, 560);
                              setTablePatch(selectedTable.id, { w: v });
                            }}
                            onBlur={save}
                            className={input}
                          />
                        </Field>
                        <Field label={t('Height', 'Height')}>
                          <input
                            type="number"
                            value={getSize(selectedTable).h}
                            onChange={(e) => {
                              const v = clamp(parseInt(e.target.value || '0', 10), 60, 360);
                              setTablePatch(selectedTable.id, { h: v });
                            }}
                            onBlur={save}
                            className={input}
                          />
                        </Field>
                      </div>

                      <div className="mt-4">
                        <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-2">{t('PAGE', 'PAGE')}</div>
                        <div className="grid grid-cols-3 gap-2">
                          {pages.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setTablePatch(selectedTable.id, { pageId: p.id }); save(); }}
                              className={[
                                "px-3 py-2 rounded-xl text-[11px] font-black border transition",
                                getPageId(selectedTable, fallbackPageId) === p.id
                                  ? "bg-amber-500 text-black border-amber-400"
                                  : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
                              ].join(" ")}
                            >
                              (p.label || p.id).slice(0, 8)
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : null}

                  {selectedZone ? (
                    <>
                      <div className="mt-2 text-white font-black">{t('Zone', 'Zone')}</div>
                      <div className="mt-2 text-xs text-zinc-500">{t('Name optional', 'Name optional')}</div>
                      <input
                        placeholder={t('(optional label)', '(optional label)')}
                        value={selectedZone.label ?? ''}
                        onChange={(e) => setZonePatch(selectedZone.id, { label: e.target.value })}
                        onBlur={save}
                        className={input + " mt-2"}
                      />
                    </>
                  ) : null}

                  {selectedWall ? (
                    <>
                      <div className="mt-2 text-white font-black">{t('Wall', 'Wall')}</div>
                      <div className="mt-2 text-xs text-zinc-500">{t('Resize with handle', 'Resize with handle')}</div>
                    </>
                  ) : null}

                  {!selectedTable && !selectedZone && !selectedWall ? (
                    <div className="mt-2 text-sm text-zinc-500">{t('Tap a table / zone / wall.', 'Tap a table / zone / wall.')}</div>
                  ) : null}
                </div>

                {/* All tables list */}
                <div>
                  <div className="text-[11px] font-black tracking-widest text-zinc-500 mb-2">{t('ALL TABLES', 'ALL TABLES')}</div>
                  <div className="space-y-2 max-h-[30vh] overflow-auto pr-1">
                    {sortedTables.map((t: any) => {
                      const isSel = selected?.kind === 'table' && selected.id === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSelected({ kind: 'table', id: t.id });
                            setActivePageId(getPageId(t, fallbackPageId));
                            setMode('select');
                          }}
                          className={[
                            "w-full text-left rounded-2xl border px-3 py-3 transition",
                            isSel ? "border-amber-500/70 bg-amber-500/10" : "border-zinc-800 bg-zinc-950/30 hover:bg-zinc-900/30",
                          ].join(" ")}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-white">{t.name}</div>
                            <span className="text-[10px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-300">
                              {(pageById.get(getPageId(t, fallbackPageId))?.label || getPageId(t, fallbackPageId)).slice(0, 10)}
                            </span>
                          </div>
                          <div className="mt-2 text-xs text-zinc-500 font-mono tabular-nums">
                            {getObj(t)} • {getSize(t).w}×{getSize(t).h}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            </div>

            {/* Canvas */}
            <div className="col-span-9 rounded-2xl border border-zinc-800 bg-black/30 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800/70 bg-zinc-950/40 flex items-center justify-between">
                {/* Show page name ONCE */}
                <div className="text-xs font-black tracking-widest text-zinc-300">{pageLabel}</div>
                <div className="text-xs text-zinc-500">
                  {`${t('Mode', 'Mode')}: ${mode.toUpperCase()} • ${t('Drag', 'Drag')} • ${t('Resize handle', 'Resize handle')}`}
                </div>
              </div>

              <div
                ref={canvasRef}
                className="relative touch-none"
                style={{ height: activePageRect.h + 90 }}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
                onPointerCancel={endDrag}
                onPointerLeave={endDrag}
                onPointerDown={onCanvasPointerDown}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 to-black/80" />
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />

                {/* subtle grid always on (no controls) */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-[0.06]"
                  style={{
                    backgroundImage:
                      'linear-gradient(to right, rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.12) 1px, transparent 1px)',
                    backgroundSize: `${SNAP}px ${SNAP}px`,
                  }}
                />

                {/* Active page container at DISPLAY_ORIGIN */}
                <div
                  className="absolute rounded-2xl border border-zinc-800/80 overflow-hidden"
                  style={{
                    left: activePageRect.x,
                    top: activePageRect.y,
                    width: activePageRect.w,
                    height: activePageRect.h,
                  }}
                >
                  <div className={`absolute inset-0 bg-gradient-to-b ${pageTint(activePageIndex)}`} />
                  <div className="absolute inset-0 bg-black/18" />
                  <div className="relative h-11 px-4 flex items-center justify-between border-b border-zinc-800/70 bg-zinc-950/40">
                    {/* No duplicate labels here */}
                    <div className="text-[11px] font-black tracking-widest text-zinc-200">{t('MAP', 'MAP')}</div>
                    <div className="text-[10px] text-zinc-500 font-mono tabular-nums">{activePageRect.w}×{activePageRect.h}</div>
                  </div>
                </div>

                {/* Zones */}
                {visibleZones.map((z) => {
                  const isSel = selected?.kind === 'zone' && selected.id === z.id;
                  const s = toScreen(z.x, z.y);
                  return (
                    <div
                      key={z.id}
                      className={[
                        "absolute rounded-2xl border overflow-hidden",
                        isSel ? "border-amber-400/80" : "border-zinc-800/80",
                        "bg-zinc-900/10",
                      ].join(" ")}
                      style={{ left: s.x, top: s.y, width: z.w, height: z.h }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'zone', id: z.id });
                        startDrag(e, 'zone', z.id, z.x, z.y);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'zone', id: z.id });
                      }}
                    >
                      {z.label ? (
                        <div className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-200">
                          {z.label}
                        </div>
                      ) : null}
                      <div
                        className="absolute right-1 bottom-1 h-4 w-4 rounded bg-zinc-950/70 border border-zinc-800 cursor-nwse-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelected({ kind: 'zone', id: z.id });
                          startResize(e, 'resizeZone', z.id, z.w, z.h);
                        }}
                      />
                    </div>
                  );
                })}

                {/* Walls */}
                {visibleWalls.map((w) => {
                  const isSel = selected?.kind === 'wall' && selected.id === w.id;
                  const s = toScreen(w.x, w.y);
                  return (
                    <div
                      key={w.id}
                      className={[
                        "absolute rounded border",
                        isSel ? "border-amber-400/80" : "border-zinc-800/80",
                        "bg-zinc-500/40",
                      ].join(" ")}
                      style={{ left: s.x, top: s.y, width: w.w, height: w.h }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'wall', id: w.id });
                        startDrag(e, 'wall', w.id, w.x, w.y);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'wall', id: w.id });
                      }}
                    >
                      <div
                        className="absolute right-1 bottom-1 h-4 w-4 rounded bg-zinc-950/70 border border-zinc-800 cursor-nwse-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelected({ kind: 'wall', id: w.id });
                          startResize(e, 'resizeWall', w.id, w.w, w.h);
                        }}
                      />
                    </div>
                  );
                })}

                {/* Tables + objects */}
                {visibleTables.map((t: any) => {
                  const isSel = selected?.kind === 'table' && selected.id === t.id;
                  const obj = getObj(t);
                  const { w, h } = getSize(t);
                  const s = toScreen(t.x, t.y);

                  const seatedName = reservationLabel(t);

                  // Normal tables (NO inner icon/square—just number + optional reservation name)
                  const rounded = obj === 'TABLE_ROUND';

                  return (
                    <div
                      key={t.id}
                      className={[
                        "absolute border select-none backdrop-blur-md bg-black/35 overflow-hidden",
                        rounded ? "rounded-full" : "rounded-2xl",
                        isSel
                          ? "border-amber-400/90 shadow-[0_0_0_1px_rgba(245,158,11,0.35),0_10px_30px_rgba(0,0,0,0.55)]"
                          : "border-zinc-800/90 shadow-[0_10px_26px_rgba(0,0,0,0.55)]",
                      ].join(" ")}
                      style={{ left: s.x, top: s.y, width: w, height: h }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'table', id: t.id });
                        startDrag(e, 'table', t.id, t.x, t.y);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelected({ kind: 'table', id: t.id });
                      }}
                      title={t.name}
                    >
                      <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_55%)]" />

                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <div className={rounded ? "text-[18px] font-black text-white" : "text-[16px] font-black text-white"}>
                          {t.name}
                        </div>
                        {seatedName ? (
                          <div className="mt-1 text-[11px] font-semibold text-zinc-300 max-w-[90%] truncate">
                            {seatedName}
                          </div>
                        ) : null}
                      </div>

                      <div
                        className="absolute right-1 bottom-1 h-4 w-4 rounded bg-zinc-950/70 border border-zinc-800 cursor-nwse-resize"
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          setSelected({ kind: 'table', id: t.id });
                          startResize(e, 'resizeTable', t.id, w, h);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {toast ? (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-6 px-4 py-2 rounded-xl border border-zinc-800 bg-zinc-950/90 text-zinc-200 text-sm font-black shadow-[0_20px_60px_rgba(0,0,0,0.65)] backdrop-blur-xl">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ---------- small UI helpers ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-black tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function ObjBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-3 py-3 rounded-xl text-[11px] font-black border transition text-left",
        active ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

const input =
  'w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80';

const topBtn =
  'px-4 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40';

const topBtnPrimary =
  'px-4 py-2 rounded-xl text-xs font-black border border-amber-400/70 bg-amber-500 text-black hover:bg-amber-400';

const pill =
  'px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40';

const pillActive =
  'px-3 py-2 rounded-xl text-xs font-black border border-amber-400/70 bg-amber-500 text-black';

const miniBtn =
  'px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40';
