"use client";

import React from "react";
import { type CourseLine, type Table, type DraftSub, type GuestId, guestsForPax } from "../app/app-state";
import { getMenuById } from "../app/settings/settings-store";
import { SimpleCourseEditor } from "./SimpleCourseEditor";
import { useI18n } from "../app/i18n";

export function tableNumber(name: string) {
  const n = parseInt(name.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 9999;
}

export function hasAnySeatNote(allergiesBySeat?: Record<number, string>) {
  if (!allergiesBySeat) return false;
  return Object.values(allergiesBySeat).some((v) => (v || "").trim().length > 0);
}

export function seatNotesList(allergiesBySeat?: Record<number, string>) {
  return Object.entries(allergiesBySeat || {})
    .map(([k, v]) => ({ seat: Number(k), text: (v || "").trim() }))
    .filter((x) => x.text.length > 0)
    .sort((a, b) => a.seat - b.seat);
}

function normalizeDishName(name: string) {
  return (name || "").trim().toLowerCase();
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

export function oldestFiredAt(setup?: { courseLines?: Array<{ status?: string; firedAt?: number }> }) {
  const lines = setup?.courseLines ?? [];
  const firedTimes = lines
    .filter((c) => c.status === "FIRED" && typeof c.firedAt === "number")
    .map((c) => c.firedAt as number);

  if (firedTimes.length === 0) return null;
  return Math.min(...firedTimes);
}

export function courseSeatBreakdown(course: CourseLine, pax: number) {
  const seatDish: Record<number, string> = { ...(course.seatDish || {}) };
  const subs: Record<number, string> = course.seatSubs || {};
  for (let s = 1; s <= pax; s++) {
    const sub = (subs[s] || "").trim();
    if (sub) seatDish[s] = sub;
  }

  const dishBySeat: { seat: number; dish: string; key: string }[] = [];
  for (let s = 1; s <= pax; s++) {
    const d = (seatDish[s] || "").trim();
    if (d) dishBySeat.push({ seat: s, dish: d, key: normalizeDishName(d) });
  }

  if (dishBySeat.length === 0) {
    return {
      baseDish: course.name,
      baseCount: pax,
      exceptions: [] as { seat: number; dish: string }[],
    };
  }

  const counts = new Map<string, number>();
  for (const x of dishBySeat) counts.set(x.key, (counts.get(x.key) || 0) + 1);

  let baseKey = dishBySeat[0].key;
  let baseCount = counts.get(baseKey) || 1;
  for (const [dishKey, cnt] of counts.entries()) {
    if (cnt > baseCount) {
      baseKey = dishKey;
      baseCount = cnt;
    }
  }

  const baseDish = dishBySeat.find((x) => x.key === baseKey)?.dish || dishBySeat[0].dish;
  const exceptions = dishBySeat
    .filter((x) => x.key !== baseKey)
    .map(({ seat, dish }) => ({ seat, dish }));

  return { baseDish, baseCount, exceptions };
}

function guestMenuBreakdown(
  course: CourseLine,
  pax: number,
  guestSeatMap?: Partial<Record<GuestId, number>>,
  excludeSeats?: Set<number>
) {
  const seatDish: Record<number, string> = { ...(course.seatDish || {}) };
  const dishBySeat: { seat: number; dish: string; key: string }[] = [];
  for (let s = 1; s <= pax; s++) {
    const d = (seatDish[s] || "").trim();
    if (d) dishBySeat.push({ seat: s, dish: d, key: normalizeDishName(d) });
  }

  if (dishBySeat.length === 0) {
    return { baseDish: course.name, baseCount: pax, guestLines: [] as { label: string; dish: string }[] };
  }

  const counts = new Map<string, number>();
  for (const x of dishBySeat) counts.set(x.key, (counts.get(x.key) || 0) + 1);

  let baseKey = dishBySeat[0].key;
  let baseCount = counts.get(baseKey) || 1;
  for (const [dishKey, cnt] of counts.entries()) {
    if (cnt > baseCount) {
      baseKey = dishKey;
      baseCount = cnt;
    }
  }

  const baseDish = dishBySeat.find((x) => x.key === baseKey)?.dish || dishBySeat[0].dish;
  const seatToGuestLabel: Record<number, string> = {};
  const defaults = guestsForPax(pax);
  for (let s = 1; s <= pax; s++) {
    const g = defaults[s - 1];
    seatToGuestLabel[s] = g ? `Guest ${g}` : `Seat ${s}`;
  }
  if (guestSeatMap) {
    (Object.entries(guestSeatMap) as Array<[GuestId, number]>).forEach(([g, seat]) => {
      if (seat && seat >= 1 && seat <= pax) seatToGuestLabel[seat] = `Guest ${g}`;
    });
  }

  const exceptions = dishBySeat.filter((x) => x.key !== baseKey && !excludeSeats?.has(x.seat));
  const baseCountAdjusted = Math.max(0, pax - exceptions.length);

  const byDish = new Map<string, string[]>();
  for (const ex of exceptions) {
    const label = seatToGuestLabel[ex.seat];
    const list = byDish.get(ex.dish) || [];
    list.push(label);
    byDish.set(ex.dish, list);
  }

  const guestLines = Array.from(byDish.entries()).map(([dish, labels]) => ({
    label: labels.join(" & "),
    dish,
  }));

  return { baseDish, baseCount: baseCountAdjusted, guestLines };
}

function getOnCourseIdx(lines: CourseLine[]): number | null {
  if (!lines || lines.length === 0) return null;
  const fired = [...lines].reverse().find((c) => c.status === "FIRED");
  if (fired && typeof fired.idx === "number") return fired.idx;
  const next = lines.find((c) => c.status === "PENDING");
  return next && typeof next.idx === "number" ? next.idx : null;
}

export function KdsTicket({
  table,
  markDone,
  now,
  pauseNeedsAttention = false,
  onAcknowledgePause,
  mode = "KDS",
  editMode,
  onToggleEdit,
  onEditCourseText,
  onMoveCourse,
  onDeleteCourse,
  onAddCourse,
  guestSubs,
  guestSeatMap,
  labelMode,
}: {
  table: Table;
  markDone?: (tableId: number, courseId: string) => void;
  now?: number;
  pauseNeedsAttention?: boolean;
  onAcknowledgePause?: () => void;
  mode?: "KDS" | "PREVIEW";
  editMode?: boolean;
  onToggleEdit?: () => void;
  onEditCourseText?: (courseId: string, text: string) => void;
  onMoveCourse?: (courseId: string, dir: -1 | 1) => void;
  onDeleteCourse?: (courseId: string) => void;
  onAddCourse?: (anchorCourseId?: string) => void;
  guestSubs?: DraftSub[];
  guestSeatMap?: Partial<Record<GuestId, number>>;
  labelMode?: "draft" | "approval" | "room";
}) {
  const { t } = useI18n();
  const setup = table.setup!;
  const ticketNow = now ?? Date.now();
  const allowActions = mode === "KDS" && !!markDone;
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const nowRef = React.useRef<HTMLDivElement | null>(null);
  const doneLock = React.useRef<Record<string, number>>({});
  const notes = seatNotesList(setup.allergiesBySeat);
  const allergyFlag = notes.length > 0;
  const isPaused = !!setup.paused;
  const refireTotal = totalRefires(setup);
  const firedOldest = oldestFiredAt(setup);
  const firedMins = firedOldest ? Math.max(0, Math.floor((ticketNow - firedOldest) / 60000)) : null;
  const firedN = firedCount(setup);
  const doneN = doneCount(setup);
  const totalN = totalCourses(setup);
  const onCourse = onCourseIdx(setup);

  const lines = setup.courseLines;
  const fired = lines.filter((c) => c.status === "FIRED");
  const nowCourse = fired[0] || null;
  const nextPending = lines.find((c) => c.status === "PENDING") || null;
  const all = lines;
  const onCourseIdxLocal = getOnCourseIdx(lines);
  const firedCountLocal = fired.length;
  const lastFired = fired[fired.length - 1] || null;
  const lastFiredMins =
    lastFired?.firedAt ? Math.max(0, Math.floor((ticketNow - lastFired.firedAt) / 60000)) : null;
  const showOnLine = onCourseIdxLocal !== null || !!nextPending;
  const editEnabled = !!editMode && !!onEditCourseText && !!onMoveCourse && !!onDeleteCourse && !!onAddCourse;
  const labelModeResolved: "draft" | "approval" | "room" =
    labelMode || (mode === "PREVIEW" ? "approval" : "approval");

  React.useEffect(() => {
    const t = setTimeout(() => {
      nowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
    return () => clearTimeout(t);
  }, [setup?.courseLines]);

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
            <div className="flex items-center gap-2">
              <div className="text-3xl font-black tracking-tight">{table.name}</div>
              {table.tableLanguage ? (
                <div className="ml-2 px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-[10px] font-black text-zinc-200">
                  {table.tableLanguage}
                </div>
              ) : null}
            </div>
            <div className="text-xs mt-1 text-zinc-700">
              {table.pax} PAX • {table.reservationName || "—"} • {table.language || "—"}
            </div>

            {showOnLine ? (
              <div className="mt-2 text-[11px] text-zinc-800">
                <span className="font-black">ON:</span> {onCourseIdxLocal !== null ? `#${onCourseIdxLocal}` : "—"}
                {nextPending ? <span className="text-zinc-600"> • Next: #{nextPending.idx}</span> : null}
              </div>
            ) : null}

            {firedCountLocal > 0 ? (
              <div className="mt-1 text-[11px] text-zinc-800">
                <span className="font-black">FIRED:</span> {firedCountLocal} active
                {lastFiredMins !== null ? <span className="text-zinc-600"> • Last: {lastFiredMins}m</span> : null}
                {refireTotal > 0 ? <span className="text-zinc-600"> • Refire: {refireTotal}</span> : null}
              </div>
            ) : null}

            <div className="text-[10px] mt-1 text-zinc-700 font-black tracking-widest">
              {onCourse !== null ? `${t("ON COURSE", "ON COURSE")} #${onCourse}` : `${t("ON COURSE", "ON COURSE")} —`}
              {firedMins !== null ? ` • ${t("FIRED", "FIRED")} ${firedMins}m` : ` • ${t("FIRED", "FIRED")} —`}
              {` • ${t("FIRED", "FIRED")} ${firedN} • ${t("DONE", "DONE")} ${doneN}/${totalN}`}
            </div>

            {setup.chefNote?.trim() ? (
              <div className="mt-2 border border-zinc-300 bg-zinc-50 p-2">
                <div className="text-[10px] font-black tracking-widest text-zinc-700 mb-1">CHEF NOTE</div>
                <div className="text-[11px] text-zinc-800">{setup.chefNote}</div>
              </div>
            ) : null}
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            {mode === "KDS" ? (
              <button
                onClick={() => nowRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
                className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-black text-zinc-900 hover:bg-zinc-100"
              >
                JUMP NOW
              </button>
            ) : null}
            {onToggleEdit ? (
              <button
                onClick={onToggleEdit}
                className="px-3 py-2 rounded-xl border border-zinc-300 bg-white text-xs font-black text-zinc-900 hover:bg-zinc-100"
              >
                {editMode ? "DONE" : "EDIT"}
              </button>
            ) : null}
            <span className="text-[10px] font-black px-2 py-1 border border-zinc-400 bg-zinc-50 text-zinc-800">
              {t("MENU", "MENU")} {getMenuById(setup.menuId)?.label || t("Menu", "Menu")}
            </span>

            {setup.pairing ? (
              <div className="ml-2 px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-50 text-[10px] font-black text-indigo-700">
                {t("SLOW PACE", "SLOW PACE")}
              </div>
            ) : null}
            {allergyFlag && (
              <span className="text-[10px] font-black px-2 py-1 border border-red-600 bg-red-50 text-red-700">
                {t("ALLERGY", "ALLERGY")}
              </span>
            )}
            {isPaused ? (
              allowActions && onAcknowledgePause ? (
                <button
                  type="button"
                  onClick={onAcknowledgePause}
                  className={[
                    "ml-2 px-2 py-1 rounded-lg border border-red-700 bg-red-50 text-[10px] font-black text-red-700",
                    pauseNeedsAttention ? "animate-pulse" : "",
                  ].join(" ")}
                  title={pauseNeedsAttention ? "Tap to acknowledge pause" : "Pause acknowledged"}
                >
                  {t("PAUSED", "PAUSED")}
                </button>
              ) : (
                <div className="ml-2 px-2 py-1 rounded-lg border border-red-700 bg-red-50 text-[10px] font-black text-red-700">
                  {t("PAUSED", "PAUSED")}
                </div>
              )
            ) : null}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div className="p-3 overflow-y-auto">
        {notes.length > 0 && (
          <div className="mb-3 border border-zinc-300 bg-zinc-50 p-2">
            <div className="text-[10px] font-black tracking-widest text-zinc-700 mb-1">
              {t("SEAT NOTES", "SEAT NOTES")}
            </div>
            <div className="text-[11px] text-zinc-800 space-y-1">
              {notes.map((x) => (
                <div key={x.seat}>
                  <span className="font-black">{t("Seat", "Seat")} {x.seat}:</span> {x.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {nowCourse && !editEnabled ? (
          <div className="mt-3 rounded-xl border border-zinc-300 bg-white p-3">
            <div className="text-[10px] font-black tracking-widest text-zinc-600">{t("NOW", "NOW")}</div>
            <CourseLineRow
              course={nowCourse}
              onDone={allowActions ? () => markDone?.(table.id, nowCourse.id) : undefined}
              doneLock={doneLock}
              now={ticketNow}
              nextPendingId={null}
              pax={table.pax}
              extras={setup.extrasByCourseId?.[nowCourse.id] || []}
              mode={mode}
              guestSubs={guestSubs}
              guestSeatMap={guestSeatMap}
              labelMode={labelModeResolved}
            />
          </div>
        ) : !editEnabled ? (
          <div className="mt-3 rounded-xl border border-zinc-300 bg-white p-3">
            <div className="text-[10px] font-black tracking-widest text-zinc-600">{t("NOW", "NOW")}</div>
            <div className="text-sm text-zinc-500">{t("Nothing fired.", "Nothing fired.")}</div>
          </div>
        ) : null}

        <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-200 flex items-center justify-between">
            <div className="text-[10px] font-black tracking-widest text-zinc-600">{t("FULL MENU", "FULL MENU")}</div>
            <div className="text-[10px] font-black text-zinc-500">{all.length} {t("courses", "courses")}</div>
          </div>

          <div ref={listRef} className="max-h-[520px] overflow-y-auto">
            <div className="p-3 space-y-2">
              {all.map((c) => (
                <div
                  key={c.id}
                  ref={c.status === "FIRED" ? nowRef : undefined}
                  className={[
                    "rounded-lg border p-2",
                    c.status === "FIRED" ? "border-amber-400 bg-amber-50" : "border-zinc-200 bg-white",
                  ].join(" ")}
                >
                  {editEnabled ? (
                    <div>
                      <SimpleCourseEditor
                        value={c.displayText || c.name || ""}
                        onChange={(v) => onEditCourseText?.(c.id, v)}
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => onMoveCourse?.(c.id, -1)}
                          className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
                        >
                          ↑
                        </button>
                        <button
                          onClick={() => onMoveCourse?.(c.id, 1)}
                          className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
                        >
                          ↓
                        </button>
                        <button
                          onClick={() => onDeleteCourse?.(c.id)}
                          className="px-3 py-2 rounded-xl text-xs font-black border border-red-400 bg-red-50 text-red-800 hover:bg-red-100"
                        >
                          DELETE
                        </button>
                        <button
                          onClick={() => onAddCourse?.(c.id)}
                          className="px-3 py-2 rounded-xl text-xs font-black border border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100"
                        >
                          + ADD
                        </button>
                      </div>
                    </div>
                  ) : (
                    <CourseLineRow
                      course={c}
                    onDone={allowActions ? () => markDone?.(table.id, c.id) : undefined}
                    doneLock={doneLock}
                    now={ticketNow}
                    nextPendingId={null}
                    pax={table.pax}
                    extras={setup.extrasByCourseId?.[c.id] || []}
                    mode={mode}
                    guestSubs={guestSubs}
                    guestSeatMap={guestSeatMap}
                    labelMode={labelModeResolved}
                  />
                  )}
                </div>
              ))}
            </div>
          </div>
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
  doneLock,
  now,
  nextPendingId,
  pax,
  extras,
  mode = "KDS",
  guestSubs,
  guestSeatMap,
  labelMode = "approval",
}: {
  course: CourseLine;
  onDone?: () => void;
  doneLock: React.MutableRefObject<Record<string, number>>;
  now: number;
  nextPendingId: string | null;
  pax: number;
  extras: string[];
  mode?: "KDS" | "PREVIEW";
  guestSubs?: DraftSub[];
  guestSeatMap?: Partial<Record<GuestId, number>>;
  labelMode?: "draft" | "approval" | "room";
}) {
  const { t } = useI18n();
  const fired = course.status === "FIRED";
  const done = course.status === "DONE";
  const isNext = course.status === "PENDING" && nextPendingId === course.id;

  const firedMins =
    fired && course.firedAt ? Math.max(0, Math.floor((now - course.firedAt) / 60000)) : null;

  const refires = course.refireCount ?? 0;

  const { baseDish, baseCount, exceptions } = courseSeatBreakdown(course, pax);
  const guestSubsForCourse = (guestSubs || []).filter((s) => s.courseId === course.id);
  const guestSubCount = Array.from(new Set(guestSubsForCourse.map((s) => s.guest))).length;
  const subSeatSet = React.useMemo(() => {
    const set = new Set<number>();
    if (!guestSubsForCourse.length) return set;
    const defaults = guestsForPax(pax);
    const seatForGuest = (g: GuestId) => {
      const mapped = guestSeatMap?.[g];
      if (mapped && mapped >= 1) return mapped;
      const idx = defaults.indexOf(g);
      return idx >= 0 ? idx + 1 : null;
    };
    for (const s of guestSubsForCourse) {
      const seat = seatForGuest(s.guest);
      if (seat) set.add(seat);
    }
    return set;
  }, [guestSubsForCourse, guestSeatMap, pax]);
  const menuBreakdown = guestMenuBreakdown(course, pax, guestSeatMap, subSeatSet);
  const subs = Object.entries(course.seatSubs || {})
    .map(([seat, sub]) => ({ seat: Number(seat), text: (sub || "").trim() }))
    .filter((x) => x.text.length > 0)
    .sort((a, b) => a.seat - b.seat);
  const exceptionSeatSet = new Set(exceptions.map((e) => e.seat));
  const subsForDisplay = subs.filter((s) => !exceptionSeatSet.has(s.seat));
  const showGuestLabels = labelMode === "draft";
  const showSeatLabels = labelMode !== "draft";
  const safeDone = React.useCallback(() => {
    if (!onDone) return;
    const key = course.id;
    const last = doneLock.current[key] || 0;
    const nowTs = Date.now();
    if (nowTs - last < 900) return;
    doneLock.current[key] = nowTs;
    onDone();
  }, [course.id, doneLock, onDone]);
  const highlight = mode === "PREVIEW";

  const displayLines = (course.displayText || "").split("\n");
  const displayMain = (displayLines[0] || "").trim();
  const displaySubs = displayLines.slice(1).map((l) => l.trim()).filter((l) => l.length > 0);

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
              {displayMain ||
                `${Math.max(
                  0,
                  (showGuestLabels ? menuBreakdown.baseCount : baseCount) -
                    (showGuestLabels ? guestSubCount : 0)
                )}x ${showGuestLabels ? menuBreakdown.baseDish || baseDish : baseDish}`}
            </div>

            {fired && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-orange-600 bg-white text-orange-800">
                {t("FIRED", "FIRED")}
              </span>
            )}
            {isNext && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-zinc-500 bg-white text-zinc-700">
                {t("NEXT", "NEXT")}
              </span>
            )}
            {done && (
              <span className="text-[10px] font-black px-2 py-0.5 border border-green-700 bg-white text-green-800">
                {t("DONE", "DONE")}
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

          {displaySubs.length > 0 ? (
            <div className="mt-1 space-y-1">
              {displaySubs.map((s, i) => (
                <div key={`${course.id}_dl_${i}`} className="text-xs text-zinc-300 font-semibold">
                  {s}
                </div>
              ))}
            </div>
          ) : null}

          {showGuestLabels && menuBreakdown.guestLines.length > 0 ? (
            <div className="mt-1 text-[11px] text-zinc-700 space-y-0.5">
              {menuBreakdown.guestLines.map((g, i) => (
                <div key={`${course.id}_gmenu_${i}`} className="font-black">
                  {g.label} — {g.dish}
                </div>
              ))}
            </div>
          ) : null}

          {exceptions.length > 0 && showSeatLabels ? (
            <div
              className={[
                "mt-1 text-[11px] space-y-0.5",
                highlight ? "text-amber-800" : "text-zinc-700",
              ].join(" ")}
            >
              {exceptions.map((e) => (
                <div key={e.seat} className={highlight ? "font-black" : ""}>
                  <span className="font-black">{t("Seat", "Seat")} {e.seat} →</span> {e.dish}
                </div>
              ))}
            </div>
          ) : null}

          {showGuestLabels && guestSubsForCourse.length > 0 ? (
            <div className="mt-1 text-[11px] text-zinc-700 space-y-0.5">
              {guestSubsForCourse.map((s) => (
                <div key={s.id} className="font-black">
                  {t("Guest", "Guest")} {s.guest} — {s.text}
                </div>
              ))}
            </div>
          ) : showSeatLabels && subsForDisplay.length > 0 ? (
            <div
              className={[
                "mt-1 text-[11px] space-y-0.5",
                highlight ? "text-amber-800" : "text-zinc-700",
              ].join(" ")}
            >
              {subsForDisplay.map((s) => (
                <div
                  key={s.seat}
                  className={[done ? "line-through text-zinc-500" : "", highlight ? "font-black" : ""].join(" ")}
                >
                  <span className="font-black">{t("Seat", "Seat")} {s.seat} →</span> {t("Substitute", "Substitute")}: {s.text}
                </div>
              ))}
            </div>
          ) : null}

          {extras.length > 0 && (
            <div className="mt-1 text-[11px] text-zinc-800 space-y-0.5">
              {extras.map((x, i) => (
                <div key={`${x}_${i}`}>
                  <span className="font-black">{t("EXTRA", "EXTRA")}:</span> {x}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {mode === "KDS" ? (
            <button
              disabled={!fired}
              onClick={safeDone}
              className={[
                "px-4 py-3 rounded-2xl border text-sm font-black transition",
                fired
                  ? "border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-100"
                  : "border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed",
              ].join(" ")}
            >
              {t("DONE", "DONE")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
