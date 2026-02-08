'use client';

import React from 'react';
import { loadLayout, type LayoutPage } from './layout-store';
import { useI18n } from '../i18n';

type Props = {
  // app-state tables (for showing seated/res name)
  tables: any[];
  mode?: 'service' | 'seating';
  storageKey?: string;

  // reservations flow hooks
  selectedReservationId?: string | null;
  onDropReservationOnTable?: (reservationId: string, tableId: number) => void;
  onClickTable?: (tableId: number) => void;

  // allow parent to know which page is selected
  activePageId?: string | null;
  onChangePage?: (pageId: string) => void;
};

const ROOM_PAGE_KEY = 'tastingpos_room_active_map_page';

export function MapView({
  tables,
  mode = 'service',
  storageKey,
  selectedReservationId,
  onDropReservationOnTable,
  onClickTable,
  activePageId,
  onChangePage,
}: Props) {
  const { t } = useI18n();
  const pageStorageKey = storageKey || ROOM_PAGE_KEY;
  const [layout, setLayout] = React.useState<ReturnType<typeof loadLayout> | null>(null);
  const [pageId, setPageId] = React.useState<string | null>(activePageId ?? null);

  React.useEffect(() => {
    setLayout(loadLayout());
  }, []);

  React.useEffect(() => {
    if (activePageId !== undefined) setPageId(activePageId);
  }, [activePageId]);

  const pages: LayoutPage[] = layout?.pages || [{ id: 'RESTAURANTE', label: t('RESTAURANTE', 'RESTAURANTE') }];

  React.useEffect(() => {
    if (!pageId && pages.length) setPageId(pages[0].id);
  }, [pageId, pages]);

  React.useEffect(() => {
    if (!layout) return;
    try {
      const saved = localStorage.getItem(pageStorageKey);
      if (saved && pages.some((p) => p.id === saved)) {
        setPageId(saved);
      }
    } catch {}
  }, [layout, pages, pageStorageKey]);

  const currentPageId = pageId || (pages[0]?.id ?? t('RESTAURANTE', 'RESTAURANTE'));

  const rect = layout?.rectByPage?.[currentPageId] || { x: 0, y: 0, w: 900, h: 756 };
  const zones = (layout?.zones || []).filter((z: any) => (z.pageId ?? z.main) === currentPageId);
  const walls = (layout?.walls || []).filter((w: any) => (w.pageId ?? w.main) === currentPageId);

  // Use layout table positions; fall back to app-state if not found
  const layoutTableById = layout?.tableById || {};

  const pageTables = tables
    .filter((t) => {
      const lt = layoutTableById[t.id];
      const page = (lt?.pageId ?? lt?.main) || (t as any).pageId || (t as any).main;
      return page === currentPageId;
    })
    .map((table) => {
      const lt = layoutTableById[table.id];
      const w = lt?.w ?? (table as any).w ?? 92;
      const h = lt?.h ?? (table as any).h ?? 92;
      const x = lt?.x ?? (table as any).x ?? rect.x + 80;
      const y = lt?.y ?? (table as any).y ?? rect.y + 80;
      const obj = lt?.obj ?? (table as any).obj ?? 'TABLE_SQUARE';
      return { table, lt: { x, y, w, h, obj } };
    });

  const setPage = (id: string) => {
    setPageId(id);
    onChangePage?.(id);
    try {
      localStorage.setItem(pageStorageKey, id);
    } catch {}
  };

  const onDragOverTable = (e: React.DragEvent) => {
    if (mode !== 'seating') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, tableId: number) => {
    if (mode !== 'seating') return;
    e.preventDefault();
    const reservationId = e.dataTransfer.getData('text/plain');
    if (!reservationId) return;
    onDropReservationOnTable?.(reservationId, tableId);
  };

  const bgGrid = {
    backgroundImage:
      'linear-gradient(to right, rgba(255,255,255,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.10) 1px, transparent 1px)',
    backgroundSize: `20px 20px`,
    opacity: 0.06,
  } as React.CSSProperties;

  return (
    <div className="h-full w-full">
      {/* Page tabs */}
      <div className="flex items-center gap-2 mb-3">
        {pages.map((p) => (
          <button
            key={p.id}
            onClick={() => setPage(p.id)}
            className={[
              'px-4 py-2 rounded-xl text-xs font-black border transition',
              currentPageId === p.id
                ? 'bg-amber-500 text-black border-amber-400'
                : 'bg-zinc-950/40 text-zinc-200 border-zinc-800 hover:bg-zinc-900/40',
            ].join(' ')}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Map container */}
      <div className="relative rounded-2xl border border-zinc-800 bg-black/30 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={bgGrid} />
        <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_120px_rgba(0,0,0,0.85)]" />

        {/* fixed "page" frame */}
        <div className="relative p-4">
          <div
            className="relative rounded-2xl border border-zinc-800/80 overflow-hidden bg-gradient-to-b from-zinc-950/40 to-black/40"
            style={{ width: rect.w, height: rect.h }}
          >
            {/* Zones */}
            {zones.map((z: any) => (
              <div
                key={z.id}
                className="absolute rounded-2xl border border-zinc-800/80 bg-zinc-900/10"
                style={{
                  left: z.x - rect.x,
                  top: z.y - rect.y,
                  width: z.w,
                  height: z.h,
                }}
              >
                {z.label ? (
                  <div className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-200">
                    {z.label}
                  </div>
                ) : null}
              </div>
            ))}

            {/* Walls */}
            {walls.map((w: any) => (
              <div
                key={w.id}
                className="absolute rounded border border-zinc-800/80 bg-zinc-500/40"
                style={{
                  left: w.x - rect.x,
                  top: w.y - rect.y,
                  width: w.w,
                  height: w.h,
                }}
              />
            ))}

            {/* Tables */}
            {pageTables.map(({ table, lt }) => {
              const assigned = table.reservationStatus === 'ASSIGNED';
              const seated = table.reservationStatus === 'SEATED' || table.status === 'SEATED';
              const rounded = lt.obj === 'TABLE_ROUND';

              return (
                <div
                  key={table.id}
                  onClick={() => onClickTable?.(table.id)}
                  onDragOver={onDragOverTable}
                  onDrop={(e) => onDrop(e, table.id)}
                  className={[
                    'absolute select-none border backdrop-blur-md overflow-hidden',
                    rounded ? 'rounded-full' : 'rounded-2xl',
                    selectedReservationId && mode === 'seating' ? 'cursor-pointer hover:scale-[1.01]' : 'cursor-default',
                    seated
                      ? 'border-emerald-500/60 bg-black/40'
                      : assigned
                        ? 'border-amber-500/60 bg-black/35'
                        : 'border-zinc-800/90 bg-black/25',
                  ].join(' ')}
                  style={{
                    left: lt.x - rect.x,
                    top: lt.y - rect.y,
                    width: lt.w,
                    height: lt.h,
                  }}
                  title={table.name}
                >
                  <div className="absolute inset-0 pointer-events-none [background:radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.10),transparent_55%)]" />
                  {table.tableLanguage ? (
                    <div className="absolute top-1 right-1 px-2 py-1 rounded-lg border border-zinc-800 bg-black/50 text-[10px] font-black text-zinc-200">
                      {table.tableLanguage}
                    </div>
                  ) : null}
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="text-[14px] font-black text-white">{table.name}</div>
                    {seated && table.reservationName ? (
                      <div className="mt-1 text-[11px] font-semibold text-zinc-300 max-w-[90%] truncate">
                        {table.reservationName}
                      </div>
                    ) : null}
                    {assigned && !seated && table.reservationName ? (
                      <div className="mt-1 text-[11px] font-semibold text-amber-200 max-w-[90%] truncate">
                        {t('Assigned', 'Assigned')}: {table.reservationName}
                      </div>
                    ) : null}
                    {!seated && !assigned && mode === 'seating' ? (
                      <div className="mt-1 text-[10px] text-zinc-500">{t('Drop reservation', 'Drop reservation')}</div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* tiny legend */}
        <div className="px-4 pb-4 text-xs text-zinc-500">
          {mode === 'seating'
            ? t('Seating mode: drag reservation onto table', 'Seating mode: drag reservation onto table')
            : t('Service mode: map is read-only', 'Service mode: map is read-only')}
        </div>
      </div>
    </div>
  );
}
