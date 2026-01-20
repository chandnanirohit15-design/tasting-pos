"use client";

import React from "react";
import { useRole } from "./role-store";

type TableStatus = "EMPTY" | "SEATED";
type ApprovalStatus = "NONE" | "PENDING" | "APPROVED";

type Language = "EN" | "ES" | "FR";
type MenuType = "A" | "B";

interface Reservation {
  id: string;
  name: string;
  pax: number;
  time: string;
  notes?: string;
  language: Language;
}

type SeatNumber = number;

interface SeatSubstitution {
  seat: SeatNumber;
  dish: string;
}

interface CourseLine {
  courseId: string;
  baseDish: string;
  subsBySeat: SeatSubstitution[];
}

interface TableSetup {
  menu: MenuType;
  pairing: boolean;
  allergiesBySeat: Record<number, string>;
  approval: ApprovalStatus;

  // chef editable
  courseLines: CourseLine[];
}

interface Table {
  id: number;
  name: string;
  pax: number;
  status: TableStatus;
  x: number;
  y: number;
  reservationId?: string;
  reservationName?: string;
  language?: Language;
  setup?: TableSetup;
}

// --- MENU DEFINITIONS ---
const MENU_A = [
  "Amuse",
  "Oyster / Citrus",
  "Scallop Crudo",
  "Caviar / Potato",
  "Langoustine",
  "Turbot",
  "Pigeon",
  "Wagyu",
  "Pre-dessert",
  "Citrus",
  "Chocolate",
  "Mignardises",
];

const MENU_B = [
  "Amuse",
  "Tomato Water",
  "Tartare",
  "Foie / Brioche",
  "Truffle Pasta",
  "Monkfish",
  "Duck",
  "Lamb",
  "Pre-dessert",
  "Strawberry",
  "Caramel",
  "Mignardises",
];

const SUB_DISHES = [
  "",
  "No Shellfish Alternative",
  "Gluten-Free Alternative",
  "No Dairy Alternative",
  "Vegetarian Alternative",
  "Chef Surprise (Allergy Safe)",
  "Extra garnish removed",
];

// --- INITIAL DATA ---
const initialReservations: Reservation[] = [
  { id: "r1", name: "Tanaka", pax: 4, time: "20:00", notes: "Shellfish allergy (Seat 3)", language: "EN" },
  { id: "r2", name: "Jenkins", pax: 2, time: "20:15", notes: "Anniversary", language: "ES" },
  { id: "r3", name: "Roquefort", pax: 6, time: "20:30", notes: "VIP • Quiet table", language: "FR" },
];

const initialTables: Table[] = [
  { id: 1, name: "T1", pax: 0, status: "EMPTY", x: 80, y: 80 },
  { id: 2, name: "T2", pax: 0, status: "EMPTY", x: 280, y: 80 },
  { id: 3, name: "T3", pax: 0, status: "EMPTY", x: 480, y: 80 },
  { id: 4, name: "T4", pax: 0, status: "EMPTY", x: 80, y: 260 },
  { id: 5, name: "T5", pax: 0, status: "EMPTY", x: 280, y: 260 },
];

function buildCourseLines(menu: MenuType): CourseLine[] {
  const src = menu === "A" ? MENU_A : MENU_B;
  const prefix = menu === "A" ? "a" : "b";
  return src.map((dish, idx) => ({
    courseId: `${prefix}${idx + 1}`,
    baseDish: dish,
    subsBySeat: [],
  }));
}

function defaultSetup(pax: number): TableSetup {
  const allergiesBySeat: Record<number, string> = {};
  for (let i = 1; i <= pax; i++) allergiesBySeat[i] = "";
  return {
    menu: "A",
    pairing: false,
    allergiesBySeat,
    approval: "NONE",
    courseLines: buildCourseLines("A"),
  };
}

function sortTablesByName(tables: Table[]) {
  return [...tables].sort((a, b) => {
    const na = parseInt(a.name.replace("T", ""), 10) || 0;
    const nb = parseInt(b.name.replace("T", ""), 10) || 0;
    return na - nb;
  });
}

// Backfill: if a table has setup but missing courseLines, rebuild them from menu.
function normalizeTables(prev: Table[]): Table[] {
  return prev.map((t) => {
    if (!t.setup) return t;

    const menu: MenuType = t.setup.menu ?? "A";
    const hasLines = Array.isArray((t.setup as any).courseLines);

    if (hasLines) return t;

    return {
      ...t,
      setup: {
        ...t.setup,
        menu,
        courseLines: buildCourseLines(menu),
      },
    };
  });
}

export default function Page() {
  const { role } = useRole();

  const [reservations, setReservations] = React.useState<Reservation[]>(initialReservations);

  const [tables, setTables] = React.useState<Table[]>(() => {
    // in case hot reload left old objects in memory, normalize at init
    return normalizeTables(initialTables);
  });

  // SERVER
  const [selectedReservationId, setSelectedReservationId] = React.useState<string | null>(null);
  const [activeTableId, setActiveTableId] = React.useState<number | null>(null);

  // KITCHEN
  const [kitchenActiveTableId, setKitchenActiveTableId] = React.useState<number | null>(null);

  // Auto-backfill if tables came from older setup (safe no-op after first run)
  React.useEffect(() => {
    setTables((prev) => normalizeTables(prev));
  }, []);

  const selectedReservation = React.useMemo(
    () => reservations.find((r) => r.id === selectedReservationId) || null,
    [reservations, selectedReservationId]
  );

  const activeTable = React.useMemo(
    () => tables.find((t) => t.id === activeTableId) || null,
    [tables, activeTableId]
  );

  const kitchenActiveTable = React.useMemo(
    () => tables.find((t) => t.id === kitchenActiveTableId) || null,
    [tables, kitchenActiveTableId]
  );

  const assignReservationToTable = (reservationId: string, tableId: number) => {
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
  };

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

  // SERVER click
  const onClickTable = (tableId: number) => {
    const t = tables.find((x) => x.id === tableId);
    if (!t) return;

    if (selectedReservationId) {
      assignReservationToTable(selectedReservationId, tableId);
      return;
    }

    if (t.status === "SEATED") setActiveTableId(tableId);
  };

  const updateTableSetup = (tableId: number, patch: Partial<TableSetup>) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        const next = { ...current, ...patch };

        // If someone passes menu but forgets courseLines, keep consistent
        if (!Array.isArray((next as any).courseLines)) {
          next.courseLines = buildCourseLines(next.menu ?? "A");
        }

        return { ...t, setup: next };
      })
    );
  };

  const updateAllergySeat = (tableId: number, seat: number, value: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        return {
          ...t,
          setup: {
            ...current,
            allergiesBySeat: {
              ...current.allergiesBySeat,
              [seat]: value,
            },
            courseLines: Array.isArray((current as any).courseLines)
              ? current.courseLines
              : buildCourseLines(current.menu ?? "A"),
          },
        };
      })
    );
  };

  const sendToKitchenForApproval = (tableId: number) => {
    updateTableSetup(tableId, { approval: "PENDING" });
    setActiveTableId(null);
  };

  const setMenuForTable = (tableId: number, menu: MenuType) => {
    updateTableSetup(tableId, { menu, courseLines: buildCourseLines(menu) });
  };

  // --- KITCHEN EDIT ACTIONS ---
  const setSubstitution = (tableId: number, courseId: string, seat: number, dish: string) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        if (!t.setup) return t;

        const lines = Array.isArray((t.setup as any).courseLines)
          ? t.setup.courseLines
          : buildCourseLines(t.setup.menu ?? "A");

        const nextLines = lines.map((line) => {
          if (line.courseId !== courseId) return line;

          if (!dish) {
            return { ...line, subsBySeat: line.subsBySeat.filter((s) => s.seat !== seat) };
          }

          const exists = line.subsBySeat.find((s) => s.seat === seat);
          let nextSubs = exists
            ? line.subsBySeat.map((s) => (s.seat === seat ? { ...s, dish } : s))
            : [...line.subsBySeat, { seat, dish }];

          nextSubs = nextSubs.sort((a, b) => a.seat - b.seat);
          return { ...line, subsBySeat: nextSubs };
        });

        return { ...t, setup: { ...t.setup, courseLines: nextLines } };
      })
    );
  };

  const moveCourse = (tableId: number, courseId: string, dir: "UP" | "DOWN") => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        if (!t.setup) return t;

        const lines = Array.isArray((t.setup as any).courseLines)
          ? t.setup.courseLines
          : buildCourseLines(t.setup.menu ?? "A");

        const idx = lines.findIndex((l) => l.courseId === courseId);
        if (idx < 0) return t;

        const swapWith = dir === "UP" ? idx - 1 : idx + 1;
        if (swapWith < 0 || swapWith >= lines.length) return t;

        const next = [...lines];
        const tmp = next[idx];
        next[idx] = next[swapWith];
        next[swapWith] = tmp;

        return { ...t, setup: { ...t.setup, courseLines: next } };
      })
    );
  };

  const approveTable = (tableId: number) => {
    updateTableSetup(tableId, { approval: "APPROVED" });
    setKitchenActiveTableId(null);
  };

  // SERVER preview helper (now safe)
  const renderCoursePreview = (t: Table) => {
    if (!t.setup) return null;
    const lines = Array.isArray((t.setup as any).courseLines)
      ? t.setup.courseLines
      : buildCourseLines(t.setup.menu ?? "A");

    const preview = lines.slice(0, 3);
    return (
      <div className="mt-2 text-[10px] text-zinc-300 space-y-1">
        {preview.map((line, idx) => (
          <div key={line.courseId} className="truncate">
            <span className="text-zinc-500 mr-1">{idx + 1}.</span>
            {line.baseDish}
            {line.subsBySeat.length > 0 && (
              <span className="text-amber-300 ml-2">
                ({line.subsBySeat.map((s) => `S${s.seat}`).join(", ")})
              </span>
            )}
          </div>
        ))}
        {lines.length > 3 && <div className="text-zinc-500">+ more…</div>}
      </div>
    );
  };

  // ---------- KITCHEN VIEW ----------
  if (role === "KITCHEN") {
    const pendingTables = sortTablesByName(
      tables.filter((t) => t.status === "SEATED" && (t.setup?.approval ?? "NONE") === "PENDING")
    );

    return (
      <div className="h-full w-full bg-zinc-950 flex">
        <aside className="w-96 border-r border-zinc-800 bg-black p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold tracking-wide text-zinc-200">PENDING APPROVAL</h2>
            <span className="text-xs text-zinc-500">{pendingTables.length}</span>
          </div>

          {pendingTables.length === 0 ? (
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-lg p-4">
              No tables waiting for approval.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTables.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setKitchenActiveTableId(t.id)}
                  className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70 p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="text-white font-black text-lg">{t.name}</div>
                      <div className="text-xs text-zinc-400 mt-0.5">
                        {t.reservationName} • {t.pax} pax • {t.language}
                      </div>
                    </div>
                    <div className="text-[10px] font-bold px-2 py-1 rounded border border-amber-600 bg-amber-900/30 text-amber-200">
                      PENDING
                    </div>
                  </div>

                  <div className="mt-2 flex gap-2 items-center text-[10px] text-zinc-300">
                    <span className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900">
                      MENU {t.setup?.menu ?? "A"}
                    </span>
                    {t.setup?.pairing && (
                      <span className="px-2 py-0.5 rounded border border-purple-600 bg-purple-900/30 text-purple-200 font-bold">
                        SLOW PACE
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-400">
                      {(Array.isArray((t.setup as any)?.courseLines)
                        ? (t.setup as any).courseLines.length
                        : buildCourseLines(t.setup?.menu ?? "A").length)}{" "}
                      courses
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="text-2xl font-black text-white">Kitchen Board</div>
          <div className="text-zinc-400 mt-1">Tap a pending table → edit substitutions/reorder → approve.</div>
        </main>

        {/* KITCHEN MODAL */}
        {kitchenActiveTable && kitchenActiveTable.setup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
            <div className="w-full max-w-5xl bg-zinc-950 border border-zinc-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900">
                <div>
                  <div className="text-lg font-black">{kitchenActiveTable.name} — Edit & Approve</div>
                  <div className="text-xs text-zinc-400">
                    {kitchenActiveTable.reservationName} • {kitchenActiveTable.pax} pax • Language:{" "}
                    {kitchenActiveTable.language}
                  </div>
                </div>
                <button onClick={() => setKitchenActiveTableId(null)} className="text-zinc-400 hover:text-white text-sm font-bold">
                  CLOSE
                </button>
              </div>

              {/* derive safe lines */}
              {(() => {
                const lines = Array.isArray((kitchenActiveTable.setup as any).courseLines)
                  ? kitchenActiveTable.setup.courseLines
                  : buildCourseLines(kitchenActiveTable.setup.menu ?? "A");

                return (
                  <>
                    <div className="p-5 grid grid-cols-12 gap-4">
                      <div className="col-span-4 space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-900 text-sm font-bold text-zinc-200">
                            MENU {kitchenActiveTable.setup!.menu}
                          </span>
                          {kitchenActiveTable.setup!.pairing && (
                            <span className="px-3 py-1 rounded border border-purple-600 bg-purple-900/30 text-sm font-bold text-purple-200">
                              SLOW PACE
                            </span>
                          )}
                          <span className="px-3 py-1 rounded border border-amber-600 bg-amber-900/30 text-sm font-bold text-amber-200">
                            PENDING
                          </span>
                        </div>

                        <div className="rounded-xl border border-zinc-800 bg-black p-4">
                          <div className="text-sm font-bold mb-2 text-red-300">ALLERGIES BY SEAT</div>
                          <div className="space-y-2">
                            {Array.from({ length: kitchenActiveTable.pax }).map((_, idx) => {
                              const seat = idx + 1;
                              const val = kitchenActiveTable.setup?.allergiesBySeat?.[seat] ?? "";
                              return (
                                <div key={seat} className="flex items-start justify-between gap-3">
                                  <div className="text-xs font-bold text-zinc-400 w-16">Seat {seat}</div>
                                  <div className={`text-xs flex-1 ${val ? "text-white" : "text-zinc-600"}`}>{val || "—"}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-8">
                        <div className="text-sm font-bold text-zinc-200 mb-2">Courses — substitutions per seat + reorder</div>

                        <div className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                          {lines.map((line, idx) => (
                            <div key={line.courseId} className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-xs text-zinc-500 font-mono mb-1">{idx + 1}.</div>
                                  <div className="text-white font-bold">{line.baseDish}</div>

                                  {line.subsBySeat.length > 0 && (
                                    <div className="mt-2 text-xs text-amber-200 space-y-1">
                                      {line.subsBySeat.map((s) => (
                                        <div key={`${line.courseId}-${s.seat}`}>
                                          Seat {s.seat} → <span className="font-bold">{s.dish}</span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div className="flex flex-col gap-2 shrink-0">
                                  <button
                                    onClick={() => moveCourse(kitchenActiveTable.id, line.courseId, "UP")}
                                    className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold hover:bg-zinc-800"
                                    disabled={idx === 0}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    onClick={() => moveCourse(kitchenActiveTable.id, line.courseId, "DOWN")}
                                    className="px-3 py-2 rounded bg-zinc-900 border border-zinc-700 text-zinc-200 text-xs font-bold hover:bg-zinc-800"
                                    disabled={idx === lines.length - 1}
                                  >
                                    ↓
                                  </button>
                                </div>
                              </div>

                              <div className="mt-3 border-t border-zinc-800 pt-3">
                                <div className="text-xs font-bold text-zinc-300 mb-2">Substitute by seat</div>

                                <div className="grid grid-cols-2 gap-2">
                                  {Array.from({ length: kitchenActiveTable.pax }).map((_, sIdx) => {
                                    const seat = sIdx + 1;
                                    const currentSub = line.subsBySeat.find((x) => x.seat === seat)?.dish ?? "";

                                    return (
                                      <div key={seat} className="flex items-center gap-2">
                                        <div className="text-[10px] w-14 text-zinc-400 font-bold">Seat {seat}</div>
                                        <select
                                          value={currentSub}
                                          onChange={(e) =>
                                            setSubstitution(kitchenActiveTable.id, line.courseId, seat, e.target.value)
                                          }
                                          className="flex-1 bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                                        >
                                          {SUB_DISHES.map((d) => (
                                            <option key={d || "none"} value={d}>
                                              {d || "— no substitute —"}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="text-[10px] text-zinc-500 mt-2">
                                  Pick substitutes only for the seats that need it.
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center px-5 py-4 border-t border-zinc-800 bg-zinc-900">
                      <div className="text-xs text-zinc-500">Approving locks current order + substitutions for service.</div>
                      <button
                        onClick={() => approveTable(kitchenActiveTable.id)}
                        className="px-5 py-3 rounded font-black bg-green-600 hover:bg-green-500 text-black"
                      >
                        APPROVE TABLE
                      </button>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- SERVER VIEW ----------
  return (
    <div className="h-full w-full bg-[#111] flex">
      <aside className="w-80 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wide text-zinc-200">RESERVATIONS</h2>
          <span className="text-xs text-zinc-500">{reservations.length}</span>
        </div>

        <div className="text-xs text-zinc-500 mb-3">Tap a reservation then tap a table, or drag it onto a table.</div>

        <div className="space-y-2">
          {reservations.map((r) => {
            const selected = r.id === selectedReservationId;
            return (
              <div
                key={r.id}
                draggable
                onDragStart={(e) => onDragStartReservation(e, r.id)}
                onClick={() => setSelectedReservationId(selected ? null : r.id)}
                className={`
                  cursor-pointer select-none rounded-lg border p-3
                  ${selected ? "border-blue-500 bg-blue-900/20" : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70"}
                `}
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
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-lg p-4">
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

      <main className="flex-1 relative overflow-hidden">
        {selectedReservation && (
          <div className="absolute top-4 left-4 z-10 bg-blue-900/30 border border-blue-700 text-blue-100 text-xs px-3 py-2 rounded-lg">
            Tap a table to assign: <span className="font-bold">{selectedReservation.name}</span>
          </div>
        )}

        {tables.map((table) => {
          const approval = table.setup?.approval ?? "NONE";
          return (
            <div
              key={table.id}
              onClick={() => onClickTable(table.id)}
              onDragOver={onDragOverTable}
              onDrop={(e) => onDropOnTable(e, table.id)}
              className={`
                absolute rounded-lg border-2 p-2 transition-all
                ${table.status === "SEATED" ? "bg-green-900/40 border-green-600" : "bg-zinc-900 border-zinc-600"}
                ${(selectedReservation || table.status === "SEATED") ? "cursor-pointer hover:scale-[1.02]" : "cursor-default"}
              `}
              style={{ left: table.x, top: table.y, width: 220, height: 190 }}
              title={table.status === "SEATED" ? "Tap to open setup" : "Drop reservation here"}
            >
              <div className="flex justify-between items-center">
                <span className="font-bold text-white">{table.name}</span>
                {table.status === "SEATED" && table.language && (
                  <span className="text-[10px] px-2 py-0.5 rounded border border-blue-700 bg-blue-900 text-blue-100 font-bold">
                    {table.language}
                  </span>
                )}
              </div>

              {table.status === "SEATED" ? (
                <>
                  <div className="mt-1 text-xs text-zinc-300">
                    <span className="font-bold">{table.reservationName}</span>
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">{table.pax} pax</div>

                  <div className="grid grid-cols-3 gap-1 mt-2">
                    {Array.from({ length: table.pax }).map((_, idx) => (
                      <div
                        key={idx}
                        className="h-7 rounded bg-zinc-800 border border-zinc-600 flex items-center justify-center text-[10px]"
                      >
                        S{idx + 1}
                      </div>
                    ))}
                  </div>

                  {renderCoursePreview(table)}

                  <div className="mt-2 text-[10px]">
                    {approval === "NONE" && (
                      <span className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-300">
                        NOT SENT
                      </span>
                    )}
                    {approval === "PENDING" && (
                      <span className="px-2 py-0.5 rounded border border-amber-600 bg-amber-900/30 text-amber-200 font-bold">
                        PENDING APPROVAL
                      </span>
                    )}
                    {approval === "APPROVED" && (
                      <span className="px-2 py-0.5 rounded border border-green-600 bg-green-900/30 text-green-200 font-bold">
                        APPROVED
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500 mt-10 text-center">
                  EMPTY
                  <div className="text-[10px] text-zinc-600 mt-1">Drop reservation</div>
                </div>
              )}

              <div className="absolute bottom-1 right-2 text-[10px] text-zinc-400">{table.status}</div>
            </div>
          );
        })}

        {activeTable && activeTable.setup && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-6 z-50">
            <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-700 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900">
                <div>
                  <div className="text-lg font-black">{activeTable.name} — Table Setup</div>
                  <div className="text-xs text-zinc-400">
                    {activeTable.reservationName} • {activeTable.pax} pax • Language: {activeTable.language}
                  </div>
                </div>
                <button onClick={() => setActiveTableId(null)} className="text-zinc-400 hover:text-white text-sm font-bold">
                  CLOSE
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <div className="text-sm font-bold mb-2">MENU</div>
                  <div className="flex gap-2">
                    {(["A", "B"] as MenuType[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMenuForTable(activeTable.id, m)}
                        className={`px-4 py-2 rounded font-bold border transition-all ${
                          activeTable.setup!.menu === m
                            ? "bg-amber-500 text-black border-amber-400"
                            : "bg-zinc-900 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                        }`}
                      >
                        MENU {m}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold">MARIDAJE</div>
                    <div className="text-xs text-zinc-400">Kitchen sees pacing indicator, not wines.</div>
                  </div>
                  <button
                    onClick={() => updateTableSetup(activeTable.id, { pairing: !activeTable.setup!.pairing })}
                    className={`px-4 py-2 rounded font-bold border ${
                      activeTable.setup!.pairing
                        ? "bg-purple-600 border-purple-500 text-white"
                        : "bg-zinc-900 border-zinc-700 text-zinc-300"
                    }`}
                  >
                    {activeTable.setup!.pairing ? "PAIRING ON" : "NO PAIRING"}
                  </button>
                </div>

                <div>
                  <div className="text-sm font-bold mb-2 text-red-300">ALLERGIES BY SEAT</div>
                  <div className="grid grid-cols-2 gap-3">
                    {Array.from({ length: activeTable.pax }).map((_, idx) => {
                      const seat = idx + 1;
                      return (
                        <div key={seat} className="space-y-1">
                          <div className="text-xs text-zinc-400 font-bold">Seat {seat}</div>
                          <input
                            value={activeTable.setup!.allergiesBySeat[seat] ?? ""}
                            onChange={(e) => updateAllergySeat(activeTable.id, seat, e.target.value)}
                            placeholder="e.g. No shellfish, no dairy…"
                            className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center px-5 py-4 border-t border-zinc-800 bg-zinc-900">
                <div className="text-xs text-zinc-500">After sending, kitchen can edit substitutions + reorder before approving.</div>
                <button
                  onClick={() => sendToKitchenForApproval(activeTable.id)}
                  className="px-5 py-3 rounded font-black bg-green-600 hover:bg-green-500 text-black"
                >
                  SEND TO KITCHEN
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
