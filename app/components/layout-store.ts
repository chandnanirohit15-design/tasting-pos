'use client';

export type LegacyMain = 'RESTAURANTE' | 'TERRAZA' | 'VIP';

// Supports both current "legacy" layout (mains/mainLabels) and future "pages[]"
export type LayoutPage = { id: string; label: string };

export type LayoutTable = {
  id: number;
  name?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  // legacy
  main?: LegacyMain;
  // future
  pageId?: string;
  obj?: 'TABLE_SQUARE' | 'TABLE_ROUND' | 'TABLE_RECT' | string;
};

export type LayoutZone = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label?: string;
  main?: LegacyMain;
  pageId?: string;
};

export type LayoutWall = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  main?: LegacyMain;
  pageId?: string;
};

export type LegacyPayload = {
  version?: number;
  mains: Record<LegacyMain, { x: number; y: number; w: number; h: number }>;
  mainLabels?: Record<LegacyMain, string>;
  zones?: LayoutZone[];
  walls?: LayoutWall[];
  tables?: Record<number, any>;
};

export type PagesPayload = {
  version?: number;
  pages: LayoutPage[];
  pageRects?: Record<string, { x: number; y: number; w: number; h: number }>;
  zones?: LayoutZone[];
  walls?: LayoutWall[];
  tables?: Record<number, any>;
};

const LEGACY_KEY = 'tastingpos_layout_v5';
const PAGES_KEY = 'tastingpos_layout_v6';

export function loadLayout(): {
  kind: 'legacy' | 'pages';
  // normalized pages list
  pages: LayoutPage[];
  // rect lookup by page id
  rectByPage: Record<string, { x: number; y: number; w: number; h: number }>;
  zones: LayoutZone[];
  walls: LayoutWall[];
  tableById: Record<number, LayoutTable>;
} | null {
  if (typeof window === 'undefined') return null;

  const rawPages = window.localStorage.getItem(PAGES_KEY);
  const rawLegacy = window.localStorage.getItem(LEGACY_KEY);

  const tryParse = (raw: string | null) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  };

  const pages = tryParse(rawPages) as PagesPayload | null;
  if (pages && Array.isArray((pages as any).pages)) {
    const rectByPage: Record<string, any> = pages.pageRects || {};
    // If pageRects missing, make sane defaults
    for (const p of pages.pages) {
      if (!rectByPage[p.id]) rectByPage[p.id] = { x: 0, y: 0, w: 900, h: 756 };
    }
    return {
      kind: 'pages',
      pages: pages.pages,
      rectByPage,
      zones: (pages.zones || []) as LayoutZone[],
      walls: (pages.walls || []) as LayoutWall[],
      tableById: normalizeTables(pages.tables || {}, 'pages'),
    };
  }

  const legacy = tryParse(rawLegacy) as LegacyPayload | null;
  if (legacy && legacy.mains) {
    const labels = legacy.mainLabels || {
      RESTAURANTE: 'RESTAURANTE',
      TERRAZA: 'TERRAZA',
      VIP: 'ZONA VIP',
    };

    const pagesList: LayoutPage[] = (['RESTAURANTE', 'TERRAZA', 'VIP'] as LegacyMain[]).map((m) => ({
      id: m,
      label: (labels as any)[m] || m,
    }));

    const rectByPage: Record<string, any> = {};
    for (const m of ['RESTAURANTE', 'TERRAZA', 'VIP'] as LegacyMain[]) {
      rectByPage[m] = legacy.mains[m] || { x: 0, y: 0, w: 900, h: 756 };
    }

    return {
      kind: 'legacy',
      pages: pagesList,
      rectByPage,
      zones: (legacy.zones || []) as LayoutZone[],
      walls: (legacy.walls || []) as LayoutWall[],
      tableById: normalizeTables(legacy.tables || {}, 'legacy'),
    };
  }

  return null;
}

function normalizeTables(tablesObj: Record<number, any>, kind: 'legacy' | 'pages'): Record<number, LayoutTable> {
  const out: Record<number, LayoutTable> = {};
  for (const [k, v] of Object.entries(tablesObj || {})) {
    const id = Number(k);
    if (!id || !v) continue;

    out[id] = {
      id,
      name: v.name,
      x: v.x,
      y: v.y,
      w: v.w ?? 92,
      h: v.h ?? 92,
      obj: v.obj ?? v.shape,
      ...(kind === 'legacy' ? { main: v.main } : { pageId: v.pageId }),
    };
  }
  return out;
}
