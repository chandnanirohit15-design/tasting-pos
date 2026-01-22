"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useRole } from "../role-store";
import { useAppState, type Table, type CourseLine } from "../app-state";

type Tab = "APPROVAL" | "KDS";

function tableNumber(name: string) {
  const n = parseInt(name.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 9999;
}

function hasAnySeatNote(allergiesBySeat?: Record<number, string>) {
  if (!allergiesBySeat) return false;
  return Object.values(allergiesBySeat).some((v) => (v || "").trim().length > 0);
}

function seatNotesList(allergiesBySeat?: Record<number, string>) {
  return Object.entries(allergiesBySeat || {})
    .map(([k, v]) => ({ seat: Number(k), text: (v || "").trim() }))
    .filter((x) => x.text.length > 0)
    .sort((a, b) => a.seat - b.seat);
}

function totalRefires(setup?: { courseLines?: Array<{ refireCount?: number }> }) {
  const lines = setup?.courseLines ?? [];
  return lines.reduce((sum, c) => sum + (c.refireCount ?? 0), 0);
}

function firedCount(setup?: { courseLines?: Array<{ status?: string }> }) {
  const lines = setup?.courseLines ?? [];
  return lines.filter((c) => c.status === "FIRED").length;
}

function doneCount(setup?: { courseLines?: Array<{ status?: string }> }) {
  const lines = setup?.courseLines ?? [];
  return lines.filter((c) => c.status === "DONE").length;
}

function totalCourses(setup?: { courseLines?: Array<{ status?: string }> }) {
  return (setup?.courseLines ?? []).length;
}

function onCourseIdx(setup?: { courseLines?: Array<{ idx?: number; status?: string }> }) {
  const lines = setup?.courseLines ?? [];
  if (lines.length === 0) return null;

  // If something is FIRED, that's the current course (use last fired)
  const lastFired = [...lines].reverse().find((c) => c.status === "FIRED");
  if (lastFired && typeof lastFired.idx === "number") return lastFired.idx;

  // Otherwise next pending
  const nextPending = lines.find((c) => c.status === "PENDING");
  return nextPending && typeof nextPending.idx === "number" ? nextPending.idx : null;
}

function oldestFiredAt(setup?: { courseLines?: Array<{ status?: string; firedAt?: number }> }) {
  const lines = setup?.courseLines ?? [];
  const firedTimes = lines
    .filter((c) => c.status === "FIRED" && typeof c.firedAt === "number")
    .map((c) => c.firedAt as number);

  if (firedTimes.length === 0) return null;
  return Math.min(...firedTimes);
}

function currentFiredCourse(setup?: { courseLines?: CourseLine[] }) {
  const lines = setup?.courseLines ?? [];
  // pick the most recently fired course (highest firedAt)
  const fired = lines.filter((c) => c.status === "FIRED");
  if (fired.length === 0) return null;

  return fired.reduce((best, c) => {
    const bt = best.firedAt ?? 0;
    const ct = c.firedAt ?? 0;
    return ct >= bt ? c : best;
  }, fired[0]);
}

function firedAgeMinutes(course: CourseLine, now: number) {
  if (!course.firedAt) return 0;
  return Math.max(0, Math.floor((now - course.firedAt) / 60000));
}

function courseCountsForKitchen(course: CourseLine, pax: number) {
  const seatSubs = course.seatSubs || {};

  const substituted = Object.values(seatSubs).filter((v) => (v || "").trim().length > 0).length;
  const baseCount = Math.max(0, pax - substituted);

  // group substitutions by text so it becomes: "No Dairy Alternative 1x"
  const grouped: Record<string, number> = {};
  for (const v of Object.values(seatSubs)) {
    const txt = (v || "").trim();
    if (!txt) continue;
    grouped[txt] = (grouped[txt] ?? 0) + 1;
  }

  const subLines = Object.entries(grouped)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  return { baseCount, subLines };
}

function getLastFired(lines: CourseLine[]): CourseLine | null {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].status === "FIRED") return lines[i];
  }
  return null;
}

function getOnCourseIdx(lines: CourseLine[]): number | null {
  const lastFired = getLastFired(lines);
  if (lastFired) return lastFired.idx;
  const nextPending = lines.find((c) => c.status === "PENDING");
  return nextPending ? nextPending.idx : null;
}

function getNextPending(lines: CourseLine[]): CourseLine | null {
  return lines.find((c) => c.status === "PENDING") ?? null;
}

function courseCounts(course: CourseLine, pax: number) {
  const seatSubs = course.seatSubs || {};

  const substituted = Object.values(seatSubs).filter((v) => (v || "").trim().length > 0).length;
  const baseCount = Math.max(0, pax - substituted);

  const grouped: Record<string, number> = {};
  for (const v of Object.values(seatSubs)) {
    const txt = (v || "").trim();
    if (!txt) continue;
    grouped[txt] = (grouped[txt] ?? 0) + 1;
  }

  const subsGrouped = Object.entries(grouped)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { baseCount, subsGrouped };
}

export default function KitchenPage() {
  const router = useRouter();
  const { kitchenAuthed, setRole } = useRole();
  const { tables, approveTable, setSeatSub, coursePresetSubs, markDone } = useAppState();

  React.useEffect(() => {
    setRole("KITCHEN");
    if (!kitchenAuthed) router.replace("/kitchen/login");
  }, [kitchenAuthed, router, setRole]);

  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const [tab, setTab] = React.useState<Tab>("KDS");
  // tableId -> last acknowledged refireTotal value
  const [pauseAck, setPauseAck] = React.useState<Record<number, number>>({});
  const [activeApprovalId, setActiveApprovalId] = React.useState<number | null>(null);

  const pending = React.useMemo(() => {
    return tables
      .filter((t) => t.status === "SEATED" && (t.setup?.approval ?? "NONE") === "PENDING")
      .sort((a, b) => tableNumber(a.name) - tableNumber(b.name));
  }, [tables]);

  const approvedForKds = React.useMemo(() => {
    const base = tables.filter(
      (t) => t.status === "SEATED" && (t.setup?.approval ?? "NONE") === "APPROVED" && t.setup
    );

    return base.sort((a, b) => {
      const aPaused = !!a.setup?.paused;
      const bPaused = !!b.setup?.paused;

      // paused first
      if (aPaused !== bPaused) return aPaused ? -1 : 1;

      // then tables with fired courses (oldest fired first)
      const aOld = oldestFiredAt(a.setup);
      const bOld = oldestFiredAt(b.setup);

      const aHas = aOld !== null;
      const bHas = bOld !== null;

      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas && aOld !== bOld) return (aOld as number) - (bOld as number);

      // fallback: table number
      return tableNumber(a.name) - tableNumber(b.name);
    });
  }, [tables]);

  const getRefireTotal = React.useCallback((t: Table) => {
    const lines = t.setup?.courseLines ?? [];
    return lines.reduce((sum, c) => sum + (c.refireCount ?? 0), 0);
  }, []);

  const needsPauseAttention = React.useCallback(
    (t: Table) => {
      if (!t.setup?.paused) return false;
      const refTotal = getRefireTotal(t);
      const ackedAt = pauseAck[t.id];
      // If never acknowledged OR refireTotal increased since last ack => needs attention again
      return ackedAt === undefined || refTotal > ackedAt;
    },
    [pauseAck, getRefireTotal]
  );

  const acknowledgePause = React.useCallback(
    (t: Table) => {
      const refTotal = getRefireTotal(t);
      setPauseAck((p) => ({ ...p, [t.id]: refTotal }));
    },
    [getRefireTotal]
  );

  React.useEffect(() => {
    setPauseAck((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const t of tables) {
        if (!t.setup?.paused && next[t.id] !== undefined) {
          delete next[t.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [tables]);

  const activeApproval = React.useMemo(
    () => pending.find((t) => t.id === activeApprovalId) || null,
    [pending, activeApprovalId]
  );

  React.useEffect(() => {
    if (pending.length > 0 && activeApprovalId === null) setActiveApprovalId(pending[0].id);
    if (pending.length === 0) setActiveApprovalId(null);
  }, [pending, activeApprovalId]);

  if (!kitchenAuthed) return null;

  return (
    <div className="h-full w-full bg-zinc-950 flex flex-col">
      {/* TOP BAR */}
      <div className="h-14 border-b border-zinc-800 bg-black flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="text-white font-black tracking-tight">KITCHEN</div>
          <div className="text-xs text-zinc-500">Approval + KDS Rail</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("KDS")}
            className={[
              "px-3 py-1.5 rounded-md text-xs font-black border transition",
              tab === "KDS"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
            ].join(" ")}
          >
            KDS ({approvedForKds.length})
          </button>

          <button
            onClick={() => setTab("APPROVAL")}
            className={[
              "px-3 py-1.5 rounded-md text-xs font-black border transition",
              tab === "APPROVAL"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
            ].join(" ")}
          >
            APPROVAL ({pending.length})
          </button>

        </div>
      </div>

      {tab === "KDS" ? (
        <KdsRail
          tables={approvedForKds}
          markDone={markDone}
          now={now}
          needsPauseAttention={needsPauseAttention}
          onAcknowledgePause={acknowledgePause}
        />
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {/* LEFT LIST */}
          <aside className="w-96 border-r border-zinc-800 bg-black p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black text-zinc-200">PENDING APPROVAL</div>
              <div className="text-xs text-zinc-500">{pending.length}</div>
            </div>

            {pending.length === 0 ? (
              <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl p-4">
                No tables waiting for approval.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((t) => {
                  const isActive = t.id === activeApprovalId;
                  const noteFlag = hasAnySeatNote(t.setup?.allergiesBySeat);
                  const paused = !!t.setup?.paused;

                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveApprovalId(t.id)}
                      className={[
                        "w-full text-left rounded-xl border p-3 transition",
                        isActive
                          ? "border-amber-500 bg-amber-900/15"
                          : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-white font-black text-lg">{t.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {t.reservationName} • {t.pax} pax • {t.language}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[10px] font-black px-2 py-1 rounded border border-amber-600 bg-amber-900/30 text-amber-200">
                            PENDING
                          </span>

                          {t.setup?.pairing && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/25 text-indigo-200">
                              PAIRING
                            </span>
                          )}

                          {noteFlag && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-red-600 bg-red-900/25 text-red-200">
                              ALLERGY
                            </span>
                          )}

                          {paused && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-600 bg-zinc-900/40 text-zinc-200">
                              PAUSED
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex gap-2 items-center text-[10px] text-zinc-300">
                        <span className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900">
                          MENU {t.setup?.menu ?? "A"}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </aside>

          {/* RIGHT EDITOR */}
          <main className="flex-1 p-6 overflow-y-auto">
            <div className="text-2xl font-black text-white">Approval</div>
            <div className="text-zinc-400 mt-1">
              Seat substitutions. Seat notes are visible here and on the KDS ticket.
            </div>

            {!activeApproval || !activeApproval.setup ? (
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
                Select a pending table.
              </div>
            ) : (
              <KitchenApprovalEditor
                table={activeApproval}
                presets={coursePresetSubs}
                onSetSeatSub={setSeatSub}
                onApprove={() => approveTable(activeApproval.id)}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}

/** ===================== KDS RAIL UI ===================== */

function KdsRail({
  tables,
  markDone,
  now,
  needsPauseAttention,
  onAcknowledgePause,
}: {
  tables: Table[];
  markDone: (tableId: number, courseId: string) => void;
  now: number;
  needsPauseAttention: (t: Table) => boolean;
  onAcknowledgePause: (t: Table) => void;
}) {
  const ticketRefs = React.useRef<Record<number, HTMLDivElement | null>>({});

  const attention = React.useMemo(() => {
    return tables.filter((t) => needsPauseAttention(t));
  }, [tables, needsPauseAttention]);

  // Sort tickets: attention first, then table number
  const sorted = React.useMemo(() => {
    const copy = [...tables];
    copy.sort((a, b) => {
      const aa = needsPauseAttention(a) ? 0 : 1;
      const bb = needsPauseAttention(b) ? 0 : 1;
      if (aa !== bb) return aa - bb;
      return tableNumber(a.name) - tableNumber(b.name);
    });
    return copy;
  }, [tables, needsPauseAttention]);

  return (
    <div className="flex-1 overflow-hidden bg-zinc-900">
      {/* Header */}
      <div className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-6">
        <div className="text-sm font-black text-white">KDS RAIL</div>
        <div className="ml-3 text-xs text-zinc-400">
          White tickets • full menu • pairing/allergy/paused on top • fired time + refire count
        </div>
      </div>

      {/* ACTION RAIL */}
      <div className="border-b border-zinc-800 bg-black px-6 py-3">
        <div className="text-[11px] font-black text-zinc-300 tracking-widest">ACTION RAIL</div>

        {attention.length === 0 ? (
          <div className="mt-2 text-xs text-zinc-500">No paused tables need attention.</div>
        ) : (
          <div className="mt-2 flex gap-2 flex-wrap">
            {attention.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  // jump to ticket
                  const el = ticketRefs.current[t.id];
                  if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
                }}
                className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900/50 text-zinc-100 text-xs font-black"
              >
                {t.name} • PAUSED
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tickets (horizontal + vertical scroll) */}
      <div className="h-[calc(100%-48px-72px)] overflow-x-auto overflow-y-auto whitespace-nowrap p-6">
        {sorted.length === 0 ? (
          <div className="text-zinc-500 border border-dashed border-zinc-700 rounded-2xl p-6 bg-black/30 inline-block">
            No approved tables yet.
          </div>
        ) : (
          sorted.map((t) => (
            <div
              key={t.id}
              ref={(node) => {
                ticketRefs.current[t.id] = node;
              }}
              className="inline-block align-top mr-6"
            >
              <KdsTicket
                table={t}
                markDone={markDone}
                now={now}
                pauseNeedsAttention={needsPauseAttention(t)}
                onAcknowledgePause={() => onAcknowledgePause(t)}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function KdsTicket({
  table,
  markDone,
  now,
  pauseNeedsAttention,
  onAcknowledgePause,
}: {
  table: Table;
  markDone: (tableId: number, courseId: string) => void;
  now: number;
  pauseNeedsAttention: boolean;
  onAcknowledgePause: () => void;
}) {
  const setup = table.setup!;
  const notes = seatNotesList(setup.allergiesBySeat);
  const allergyFlag = notes.length > 0;
  const isPaused = !!setup.paused;
  const refireTotal = totalRefires(setup);
  const bodyRef = React.useRef<HTMLDivElement | null>(null);
  const firstFiredRef = React.useRef<HTMLDivElement | null>(null);
  const firstFired = setup.courseLines.find((c) => c.status === "FIRED") || null;
  const firedOldest = oldestFiredAt(setup);
  const firedMins = firedOldest ? Math.max(0, Math.floor((now - firedOldest) / 60000)) : null;
  const firedN = firedCount(setup);
  const doneN = doneCount(setup);
  const totalN = totalCourses(setup);
  const onCourse = onCourseIdx(setup);

  React.useEffect(() => {
    if (!firstFired) return;
    // scroll the ticket body to the first fired row
    if (firstFiredRef.current && bodyRef.current) {
      firstFiredRef.current.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [firstFired?.id, firstFired?.firedAt]);

  const lines = setup.courseLines;
  const onCourseIdxLocal = getOnCourseIdx(lines);
  const nextPending = getNextPending(lines);
  const lastFired = getLastFired(lines);

  const lastFiredMins =
    lastFired?.firedAt ? Math.max(0, Math.floor((now - lastFired.firedAt) / 60000)) : null;

  const firedCountLocal = lines.filter((c) => c.status === "FIRED").length;

  return (
      <div className="w-[360px] h-[calc(100vh-220px)] bg-white text-black rounded-sm shadow-2xl border border-zinc-300 overflow-hidden font-mono flex flex-col">
        {/* Top tear edge */}
        <div
          className="h-2 bg-zinc-200"
          style={{
            clipPath:
              "polygon(0% 100%, 4% 0%, 8% 100%, 12% 0%, 16% 100%, 20% 0%, 24% 100%, 28% 0%, 32% 100%, 36% 0%, 40% 100%, 44% 0%, 48% 100%, 52% 0%, 56% 100%, 60% 0%, 64% 100%, 68% 0%, 72% 100%, 76% 0%, 80% 100%, 84% 0%, 88% 100%, 92% 0%, 96% 100%, 100% 0%)",
          }}
        />

        {/* HEADER (sticky) */}
        <div className="p-4 border-b border-zinc-300 sticky top-0 bg-white z-20">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-3xl font-black tracking-tight">{table.name}</div>
              <div className="text-xs mt-1 text-zinc-700">
                {table.pax} PAX • {table.reservationName || "—"} • {table.language || "—"}
              </div>

              <div className="mt-2 text-[11px] text-zinc-800">
                <span className="font-black">ON:</span> {onCourseIdxLocal !== null ? `#${onCourseIdxLocal}` : "—"}
                {nextPending ? <span className="text-zinc-600"> • Next: #{nextPending.idx}</span> : null}
              </div>

              <div className="mt-1 text-[11px] text-zinc-800">
                <span className="font-black">FIRED:</span> {firedCountLocal > 0 ? `${firedCountLocal} active` : "none"}
                {lastFiredMins !== null ? <span className="text-zinc-600"> • Last: {lastFiredMins}m</span> : null}
                {refireTotal > 0 ? <span className="text-zinc-600"> • Refire: {refireTotal}</span> : null}
              </div>

              <div className="text-[10px] mt-1 text-zinc-700 font-black tracking-widest">
                {onCourse !== null ? `ON COURSE #${onCourse}` : "ON COURSE —"}
                {firedMins !== null ? ` • FIRED ${firedMins}m` : " • FIRED —"}
                {` • FIRED ${firedN} • DONE ${doneN}/${totalN}`}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className="text-[10px] font-black px-2 py-1 border border-zinc-400 bg-zinc-50 text-zinc-800">
                MENU {setup.menu}
              </span>

              {setup.pairing && (
                <span className="text-[10px] font-black px-2 py-1 border border-indigo-600 bg-indigo-50 text-indigo-800">
                  PAIRING
                </span>
              )}
              {allergyFlag && (
                <span className="text-[10px] font-black px-2 py-1 border border-red-600 bg-red-50 text-red-700">
                  ALLERGY
                </span>
              )}
              {isPaused && (
                <button
                  type="button"
                  onClick={onAcknowledgePause}
                  className={[
                    "text-[10px] font-black px-2 py-1 border border-zinc-500 bg-zinc-100 text-zinc-700",
                    pauseNeedsAttention ? "animate-pulse" : "",
                  ].join(" ")}
                  title={pauseNeedsAttention ? "Tap to acknowledge pause" : "Pause acknowledged"}
                >
                  PAUSED
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BODY (scrolls) */}
        <div ref={bodyRef} className="p-3 max-h-[560px] overflow-y-auto">
          {/* ✅ Seat notes ALWAYS expanded now */}
          {notes.length > 0 && (
            <div className="mb-3 border border-zinc-300 bg-zinc-50 p-2 sticky top-0 z-10">
              <div className="text-[10px] font-black tracking-widest text-zinc-700 mb-1">SEAT NOTES</div>
              <div className="text-[11px] text-zinc-800 space-y-1">
                {notes.map((x) => (
                  <div key={x.seat}>
                    <span className="font-black">S{x.seat}:</span> {x.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[10px] font-black tracking-widest text-zinc-600 mb-2">FULL COURSE LIST</div>

          <div className="space-y-1">
            {setup.courseLines.map((c) => {
              const isFirstFired = firstFired?.id === c.id;
              return (
                <div
                  key={c.id}
                  ref={isFirstFired ? firstFiredRef : undefined}
                  className={isFirstFired ? "rounded-sm ring-2 ring-orange-300/60 bg-orange-50/40" : ""}
                >
                  <CourseLineRow
                    course={c}
                    onDone={() => markDone(table.id, c.id)}
                    now={now}
                    nextPendingId={nextPending?.id ?? null}
                    pax={table.pax}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom tear edge */}
        <div
          className="h-2 bg-white border-t border-zinc-200"
          style={{
            clipPath:
              "polygon(0% 0%, 4% 100%, 8% 0%, 12% 100%, 16% 0%, 20% 100%, 24% 0%, 28% 100%, 32% 0%, 36% 100%, 40% 0%, 44% 100%, 48% 0%, 52% 100%, 56% 0%, 60% 100%, 64% 0%, 68% 100%, 72% 0%, 76% 100%, 80% 0%, 84% 100%, 88% 0%, 92% 100%, 96% 0%, 100% 100%)",
          }}
        />
      </div>
  );
}

function CourseLineRow({
  course,
  onDone,
  now,
  nextPendingId,
  pax,
}: {
  course: CourseLine;
  onDone: () => void;
  now: number;
  nextPendingId: string | null;
  pax: number;
}) {
  const fired = course.status === "FIRED";
  const done = course.status === "DONE";
  const isNext = course.status === "PENDING" && nextPendingId === course.id;

  const firedMins =
    fired && course.firedAt ? Math.max(0, Math.floor((now - course.firedAt) / 60000)) : null;

  const refires = course.refireCount ?? 0;

  const { baseCount, subsGrouped } = courseCounts(course, pax);
  const subs = Object.entries(course.seatSubs || {})
    .map(([seat, sub]) => ({ seat: Number(seat), text: (sub || "").trim() }))
    .filter((x) => x.text.length > 0)
    .sort((a, b) => a.seat - b.seat);

  return (
    <div
      className={[
        "py-1 px-2 -mx-2 rounded",
        fired ? "bg-orange-50 border border-orange-200" : "",
        isNext ? "border border-zinc-400 bg-zinc-50" : "",
        done ? "opacity-40" : course.status === "PENDING" ? "opacity-85" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <div className="text-xs font-black w-8 text-right">{course.idx}.</div>

            <div className={["text-sm font-bold truncate", done ? "line-through text-zinc-500" : ""].join(" ")}>
              {course.name} <span className="font-black">{baseCount}x</span>
            </div>

            {fired && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-orange-600 bg-white text-orange-800">
                FIRED
              </span>
            )}
            {isNext && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-zinc-500 bg-white text-zinc-700">
                NEXT
              </span>
            )}
            {done && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-green-700 bg-white text-green-800">
                DONE
              </span>
            )}

            {fired && firedMins !== null && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-zinc-400 bg-white text-zinc-700">
                {firedMins}m
              </span>
            )}

            {fired && refires > 0 && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-orange-600 bg-white text-orange-800">
                REFIRE x{refires}
              </span>
            )}
          </div>

          {subsGrouped.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-800 space-y-0.5">
              {subsGrouped.map((s) => (
                <div key={s.name}>
                  {s.name} <span className="font-black">{s.count}x</span>
                </div>
              ))}
            </div>
          )}

          {subs.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-700 space-y-0.5">
              {subs.map((s) => (
                <div key={s.seat} className={done ? "line-through text-zinc-500" : ""}>
                  <span className="font-black">S{s.seat}:</span> {s.text}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          <button
            disabled={!fired}
            onClick={onDone}
            className={[
              "text-[10px] font-black px-3 py-1 border transition",
              fired
                ? "border-green-700 bg-green-50 hover:bg-green-100"
                : "border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed",
            ].join(" ")}
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}

/** ===================== APPROVAL EDITOR ===================== */

function KitchenApprovalEditor({
  table,
  presets,
  onSetSeatSub,
  onApprove,
}: {
  table: Table;
  presets: string[];
  onSetSeatSub: (tableId: number, courseId: string, seat: number, sub: string) => void;
  onApprove: () => void;
}) {
  const setup = table.setup!;
  const noteFlag = hasAnySeatNote(setup.allergiesBySeat);
  const paused = !!setup.paused;

  const [expandedCourseId, setExpandedCourseId] = React.useState<string | null>(null);

  const notes = seatNotesList(setup.allergiesBySeat);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            {table.name}
          </span>

          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            MENU {setup.menu}
          </span>

          {setup.pairing && (
            <span className="px-3 py-1 rounded border border-indigo-600 bg-indigo-900/25 text-sm font-black text-indigo-200">
              PAIRING
            </span>
          )}

          {noteFlag && (
            <span className="px-3 py-1 rounded border border-red-600 bg-red-900/25 text-sm font-black text-red-200">
              ALLERGY
            </span>
          )}

          {paused && (
            <span className="px-3 py-1 rounded border border-zinc-600 bg-zinc-950 text-sm font-black text-zinc-200">
              PAUSED
            </span>
          )}

          <span className="px-3 py-1 rounded border border-amber-600 bg-amber-900/30 text-sm font-black text-amber-200">
            PENDING
          </span>
        </div>

        <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-4">
          <div className="text-xs font-black text-zinc-200 mb-2">SEAT NOTES (ALLERGY / PREF)</div>
          {notes.length === 0 ? (
            <div className="text-sm text-zinc-500">—</div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: table.pax }).map((_, idx) => {
                const seat = idx + 1;
                const val = (setup.allergiesBySeat?.[seat] ?? "").trim();
                return (
                  <div key={seat} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                    <div className="text-[11px] font-black text-zinc-300 mb-1">Seat {seat}</div>
                    <div className={val ? "text-sm text-white font-black" : "text-sm text-zinc-500"}>
                      {val || "—"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">SUBSTITUTIONS PER SEAT</div>
          <div className="text-xs text-zinc-500">Tap a course → choose substitute per seat</div>
        </div>

        <div className="divide-y divide-zinc-800">
          {setup.courseLines.map((c) => (
            <div key={c.id} className="p-4">
              <button
                onClick={() => setExpandedCourseId((prev) => (prev === c.id ? null : c.id))}
                className="w-full text-left flex items-start justify-between gap-3"
              >
                <div>
                  <div className="text-white font-black">
                    {c.idx}. {c.name}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {Object.values(c.seatSubs || {}).some((v) => (v || "").trim().length > 0)
                      ? "Substitutions set"
                      : "No substitutions"}
                  </div>
                </div>

                <div className="text-xs font-black text-zinc-300">{expandedCourseId === c.id ? "CLOSE" : "EDIT"}</div>
              </button>

              {expandedCourseId === c.id && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {Array.from({ length: table.pax }).map((_, idx) => {
                    const seat = idx + 1;
                    const current = c.seatSubs?.[seat] ?? "";
                    return (
                      <div key={seat} className="rounded-xl border border-zinc-800 bg-black p-3">
                        <div className="text-[11px] font-black text-zinc-300 mb-2">Seat {seat}</div>
                        <select
                          value={current}
                          onChange={(e) => onSetSeatSub(table.id, c.id, seat, e.target.value)}
                          className="w-full rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                        >
                          <option value="">— No substitution —</option>
                          {presets.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-end">
        <button onClick={onApprove} className="px-6 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-black font-black">
          APPROVE TABLE
        </button>
      </div>
    </div>
  );
}
