"use client";

import React from "react";
import { useAppState, defaultSetup } from "../app-state";

export default function ReservationsPage() {
  const { reservations, tables, setReservations, setTables } = useAppState();

  const [selectedReservationId, setSelectedReservationId] = React.useState<string | null>(null);

  const selectedReservation = React.useMemo(
    () => reservations.find((r) => r.id === selectedReservationId) || null,
    [reservations, selectedReservationId]
  );

  const assignReservationToTable = React.useCallback(
    (reservationId: string, tableId: number) => {
      const r = reservations.find((x) => x.id === reservationId);
      if (!r) return;

      const t = tables.find((x) => x.id === tableId);
      if (!t) return;

      if (t.status === "SEATED") {
        const ok = window.confirm(`Table ${t.name} is already seated. Replace?`);
        if (!ok) return;
      }

      setTables((prev) =>
        prev.map((table) => {
          if (table.id !== tableId) return table;
          return {
            ...table,
            status: "SEATED",
            pax: r.pax,
            reservationId: r.id,
            reservationName: r.name,
            language: r.language,
            setup: defaultSetup(r.pax),
          };
        })
      );

      setReservations((prev) => prev.filter((x) => x.id !== reservationId));
      setSelectedReservationId((prev) => (prev === reservationId ? null : prev));
    },
    [reservations, tables, setReservations, setTables]
  );

  // Drag handlers
  const onDragStartReservation = (e: React.DragEvent, reservationId: string) => {
    e.dataTransfer.setData("text/plain", reservationId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOverTable = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDropOnTable = (e: React.DragEvent, tableId: number) => {
    e.preventDefault();
    const reservationId = e.dataTransfer.getData("text/plain");
    if (!reservationId) return;
    assignReservationToTable(reservationId, tableId);
  };

  const onClickTable = (tableId: number) => {
    if (!selectedReservationId) return;
    assignReservationToTable(selectedReservationId, tableId);
  };

  return (
    <div className="h-full w-full bg-[#0b0b0d] grid grid-cols-[380px_1fr]">
      {/* LEFT: RESERVATIONS */}
      <aside className="border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wide text-zinc-200">RESERVATIONS</h2>
          <span className="text-xs text-zinc-500">{reservations.length}</span>
        </div>

        <div className="text-xs text-zinc-500 mb-3">
          Tap a reservation then tap a table, or drag it onto a table.
        </div>

        <div className="space-y-2">
          {reservations.map((r) => {
            const selected = r.id === selectedReservationId;
            return (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => onDragStartReservation(e, r.id)}
                onClick={() => setSelectedReservationId(selected ? null : r.id)}
                className={[
                  "cursor-pointer select-none rounded-xl border p-3 transition",
                  selected
                    ? "border-blue-500 bg-blue-900/20"
                    : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{r.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {r.time} • {r.pax} pax
                    </div>
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 font-bold">
                    {r.language}
                  </span>
                </div>

                {r.notes && <div className="text-xs text-zinc-400 mt-2 line-clamp-2">{r.notes}</div>}

                <div className="text-[10px] text-zinc-600 mt-2">Drag to table • Tap to select</div>
              </div>
            );
          })}

          {reservations.length === 0 && (
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl p-4">
              No unassigned reservations.
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-800 pt-3">
          <div className="text-xs text-zinc-500">Selected</div>
          <div className="text-sm text-white font-bold">
            {selectedReservation ? `${selectedReservation.name} (${selectedReservation.pax})` : "None"}
          </div>
        </div>
      </aside>

      {/* RIGHT: MAP (Grid view for now) */}
      <main className="overflow-hidden bg-[#0f0f12]">
        <div className="h-full w-full p-6 overflow-y-auto">
          <div className="mb-4 flex items-center gap-2">
            <div className="px-3 py-2 rounded-lg border border-zinc-800 bg-black/60 text-xs text-zinc-300">
              Mode: <span className="font-bold text-white">Seating</span>
            </div>

            {selectedReservation && (
              <div className="px-3 py-2 rounded-lg border border-blue-700 bg-blue-900/30 text-xs text-blue-100">
                Assign: <span className="font-bold">{selectedReservation.name}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-6">
            {tables.map((table) => {
              const seated = table.status === "SEATED";
              return (
                <div
                  key={table.id}
                  onClick={() => onClickTable(table.id)}
                  onDragOver={onDragOverTable}
                  onDrop={(e) => onDropOnTable(e, table.id)}
                  className={[
                    "rounded-2xl border-2 p-4 transition select-none min-h-[160px]",
                    seated ? "bg-green-900/30 border-green-600" : "bg-zinc-900/60 border-zinc-700",
                    selectedReservationId ? "cursor-pointer hover:scale-[1.01]" : "cursor-default",
                  ].join(" ")}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-black text-white">{table.name}</span>

                    {seated && table.language && (
                      <span className="text-[10px] px-2 py-0.5 rounded border border-blue-700 bg-blue-900 text-blue-100 font-bold">
                        {table.language}
                      </span>
                    )}
                  </div>

                  {seated ? (
                    <>
                      <div className="mt-1 text-xs text-zinc-300">
                        <span className="font-bold">{table.reservationName}</span>
                      </div>
                      <div className="text-xs text-zinc-400 mt-0.5">{table.pax} pax</div>

                      <div className="grid grid-cols-6 gap-1 mt-3">
                        {Array.from({ length: table.pax }).map((_, idx) => (
                          <div
                            key={idx}
                            className="h-7 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[10px]"
                          >
                            S{idx + 1}
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-zinc-500 mt-10 text-center">
                      EMPTY
                      <div className="text-[10px] text-zinc-600 mt-1">Drop reservation</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
