"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useRole } from "../role-store";
import { useAppState, type Table, type CourseLine, type Reservation } from "../app-state";
import { getMenuById, loadSettings } from "../settings/settings-store";
import { KdsTicket, hasAnySeatNote, tableNumber, oldestFiredAt } from "../../components/kds-ticket";
import { TicketEditor } from "../../components/ticket-editor";
import { useI18n } from "../i18n";

type Tab = "DRAFT" | "APPROVAL" | "KDS";

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

function getNextPending(lines: CourseLine[]): CourseLine | null {
  return lines.find((c) => c.status === "PENDING") ?? null;
}

export default function KitchenPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { kitchenAuthed, setRole } = useRole();
  const {
    tables,
    reservations,
    approveTable,
    setSeatSub,
    coursePresetSubs,
    dishPresets,
    addExtraDish,
    removeExtraDish,
    setChefNote,
    insertCourseLine,
    deleteCourseLine,
    moveCourseLine,
    setSeatMenu,
    draftMoveCourse,
    draftDeleteCourse,
    draftInsertCourse,
    draftSetSeatSub,
    draftAddExtraDish,
    draftRemoveExtraDish,
    draftSetChefNote,
    markDone,
  } = useAppState();

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
  const menus = React.useMemo(() => loadSettings().menus || [], []);
  // tableId -> last acknowledged refireTotal value
  const [pauseAck, setPauseAck] = React.useState<Record<number, number>>({});
  const [activeApprovalId, setActiveApprovalId] = React.useState<number | null>(null);
  const [activeDraftId, setActiveDraftId] = React.useState<string | null>(null);
  const [kdsEditTableId, setKdsEditTableId] = React.useState<number | null>(null);
  const [draftEditReservationId, setDraftEditReservationId] = React.useState<string | null>(null);
  const reservationById = React.useMemo(() => {
    return new Map(reservations.map((r) => [String(r.id), r]));
  }, [reservations]);

  const kdsEditTable = React.useMemo(
    () => (kdsEditTableId ? tables.find((t) => t.id === kdsEditTableId) || null : null),
    [kdsEditTableId, tables]
  );

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

  const draftReservations = React.useMemo(() => {
    return reservations.filter(
      (r) =>
        (r.draftStatus === "DRAFT" || r.draftStatus === "PREPPED") &&
        !!r.draftSetup &&
        !r.sentToApproval
    );
  }, [reservations]);

  const activeDraft = React.useMemo(
    () => (activeDraftId ? reservations.find((r) => r.id === activeDraftId) || null : null),
    [activeDraftId, reservations]
  );
  const draftTable = React.useMemo(() => {
    if (!activeDraft?.draftSetup) return null;
    const previewTable: Table = {
      id: -1,
      name: activeDraft.tablePref || t("DRAFT", "DRAFT"),
      pax: activeDraft.pax,
      status: "SEATED",
      x: 0,
      y: 0,
      reservationName: activeDraft.name,
      reservationPax: activeDraft.pax,
      reservationTime: activeDraft.time,
      language: activeDraft.language,
      setup: activeDraft.draftSetup,
    };
    return previewTable;
  }, [activeDraft, t]);

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
    <>
      <div className="h-full w-full bg-zinc-950 flex flex-col">
      {/* TOP BAR */}
      <div className="h-14 border-b border-zinc-800 bg-black flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <div className="text-white font-black tracking-tight">{t("KITCHEN", "KITCHEN")}</div>
          <div className="text-xs text-zinc-500">{t("Approval + KDS Rail", "Approval + KDS Rail")}</div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setTab("DRAFT")}
            className={[
              "px-3 py-1.5 rounded-md text-xs font-black border transition",
              tab === "DRAFT"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
            ].join(" ")}
          >
            {t("DRAFT", "DRAFT")} ({draftReservations.length})
          </button>
          <button
            onClick={() => setTab("KDS")}
            className={[
              "px-3 py-1.5 rounded-md text-xs font-black border transition",
              tab === "KDS"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-900 text-zinc-300 border-zinc-800 hover:bg-zinc-800",
            ].join(" ")}
          >
            {t("KDS", "KDS")} ({approvedForKds.length})
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
            {t("APPROVAL", "APPROVAL")} ({pending.length})
          </button>

        </div>
      </div>

      {tab === "DRAFT" ? (
        <DraftRail
          reservations={draftReservations}
          onEditDraft={(resId) => setDraftEditReservationId(String(resId))}
        />
      ) : tab === "KDS" ? (
        <KdsRail
          tables={approvedForKds}
          markDone={markDone}
          now={now}
          needsPauseAttention={needsPauseAttention}
          onAcknowledgePause={acknowledgePause}
          reservationById={reservationById}
          onEditKdsTable={(tableId) => setKdsEditTableId(tableId)}
        />
      ) : (
        <div className="grid grid-cols-[320px_1fr_420px] gap-4 h-full p-4 overflow-hidden">
          {/* LEFT: approval queue */}
          <div className="h-full overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-black text-zinc-200">{t("PENDING APPROVAL", "PENDING APPROVAL")}</div>
              <div className="text-xs text-zinc-500">{pending.length}</div>
            </div>

            {pending.length === 0 ? (
              <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl p-4">
                {t("No tables waiting for approval.", "No tables waiting for approval.")}
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map((table) => {
                  const isActive = table.id === activeApprovalId;
                  const noteFlag = hasAnySeatNote(table.setup?.allergiesBySeat);
                  const paused = !!table.setup?.paused;

                  return (
                    <button
                      key={table.id}
                      onClick={() => {
                        setActiveApprovalId(table.id);
                        setActiveDraftId(null);
                      }}
                      className={[
                        "w-full text-left rounded-xl border p-3 transition",
                        isActive
                          ? "border-amber-500 bg-amber-900/15"
                          : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70",
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-white font-black text-lg">{table.name}</div>
                          <div className="text-xs text-zinc-400 mt-0.5">
                            {table.reservationName} • {table.pax} {t("pax", "pax")} • {table.language}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[10px] font-black px-2 py-1 rounded border border-amber-600 bg-amber-900/30 text-amber-200">
                            {t("PENDING", "PENDING")}
                          </span>

                          {table.setup?.pairing && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/25 text-indigo-200">
                              {t("PAIRING", "PAIRING")}
                            </span>
                          )}

                          {noteFlag && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-red-600 bg-red-900/25 text-red-200">
                              {t("ALLERGY", "ALLERGY")}
                            </span>
                          )}

                          {paused && (
                            <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-600 bg-zinc-900/40 text-zinc-200">
                              {t("PAUSED", "PAUSED")}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 flex gap-2 items-center text-[10px] text-zinc-300">
                        <span className="px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900">
                          {t("MENU", "MENU")} {getMenuById(table.setup?.menuId || "")?.label || t("Menu", "Menu")}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* MIDDLE: approval editor */}
          <div className="h-full overflow-y-auto">
            <div className="text-2xl font-black text-white">{t("Approval", "Approval")}</div>
            <div className="text-zinc-400 mt-1">
              {t(
                "Seat substitutions. Seat notes are visible here and on the KDS ticket.",
                "Seat substitutions. Seat notes are visible here and on the KDS ticket."
              )}
            </div>

            {!activeApproval || !activeApproval.setup ? (
              <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
                {t("Select a pending table.", "Select a pending table.")}
              </div>
            ) : (
              <KitchenApprovalEditor
                table={activeApproval}
                presets={coursePresetSubs}
                dishPresets={dishPresets}
                menus={menus}
                onSetSeatMenu={setSeatMenu}
                onSetSeatSub={setSeatSub}
                onAddExtraDish={addExtraDish}
                onRemoveExtraDish={removeExtraDish}
                onSetChefNote={setChefNote}
                onInsertChefSpecial={insertCourseLine}
                onDeleteCourseLine={deleteCourseLine}
                onMoveCourseLine={moveCourseLine}
                onApprove={() => approveTable(activeApproval.id)}
              />
            )}
          </div>

          {/* RIGHT: live KDS preview */}
          <div className="h-full overflow-y-auto">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-black text-zinc-200">{t("LIVE PREVIEW", "LIVE PREVIEW")}</div>
                <div className="text-[10px] font-black text-zinc-500">{t("KDS ticket", "KDS ticket")}</div>
              </div>

              {activeDraft && draftTable ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-2">
                  <KdsTicket
                    table={draftTable}
                    mode="PREVIEW"
                    labelMode="draft"
                    guestSubs={activeDraft.draftGuestSubs || []}
                    guestSeatMap={activeDraft.draftGuestSeatMap || undefined}
                  />
                </div>
              ) : activeApproval ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-2">
                  <KdsTicket
                    table={activeApproval}
                    mode="PREVIEW"
                    labelMode="approval"
                    guestSeatMap={
                      activeApproval.reservationId
                        ? reservationById.get(String(activeApproval.reservationId))?.draftGuestSeatMap
                        : undefined
                    }
                  />
                </div>
              ) : (
                <div className="text-sm text-zinc-500">
                  {t("Select a table or draft ticket.", "Select a table or draft ticket.")}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>

      {kdsEditTable ? (
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
        onClick={() => setKdsEditTableId(null)}
      >
        <div
          className="w-full max-w-3xl max-h-[92vh] rounded-2xl border border-zinc-800 bg-[#0f0f12] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#0f0f12] z-10">
            <div className="text-sm font-black text-white">
              {t("KDS EDIT", "KDS EDIT")} — {kdsEditTable.name}
            </div>
            <button
              onClick={() => setKdsEditTableId(null)}
              className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
            >
              {t("DONE", "DONE")}
            </button>
          </div>

          <div className="p-4 overflow-y-auto min-h-0">
            <TicketEditor
              pax={kdsEditTable.pax}
              setup={kdsEditTable.setup!}
              presets={coursePresetSubs}
              dishPresets={dishPresets}
              menus={menus}
              onSetSeatMenu={(seat, menuId) => setSeatMenu(kdsEditTable.id, seat, menuId)}
              onSetSeatSub={(courseId, seat, sub) => setSeatSub(kdsEditTable.id, courseId, seat, sub)}
              onAddExtraDish={(courseId, dishName) => addExtraDish(kdsEditTable.id, courseId, dishName)}
              onRemoveExtraDish={(courseId, index) => removeExtraDish(kdsEditTable.id, courseId, index)}
              onSetChefNote={(note) => setChefNote(kdsEditTable.id, note)}
              onInsertCourseLine={(anchorCourseId, where, name) =>
                insertCourseLine(kdsEditTable.id, anchorCourseId, where, name)
              }
              onDeleteCourseLine={(courseId) => deleteCourseLine(kdsEditTable.id, courseId)}
              onMoveCourseLine={(courseId, dir) => moveCourseLine(kdsEditTable.id, courseId, dir)}
            />
          </div>
        </div>
      </div>
      ) : null}

      {draftEditReservationId ? (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center p-4"
          onClick={() => setDraftEditReservationId(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] rounded-2xl border border-zinc-800 bg-[#0f0f12] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-[#0f0f12] z-10">
              <div className="text-sm font-black text-white">
                {t("DRAFT", "DRAFT")} {t("EDIT", "EDIT")}
              </div>
              <button
                onClick={() => setDraftEditReservationId(null)}
                className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
              >
                {t("DONE", "DONE")}
              </button>
            </div>

            <div className="p-4 overflow-y-auto min-h-0">
              {(() => {
                const r = reservations.find((x) => String(x.id) === String(draftEditReservationId));
                if (!r?.draftSetup) {
                  return <div className="text-sm text-zinc-500">{t("No draft tickets.", "No draft tickets.")}</div>;
                }
                return (
                  <TicketEditor
                    pax={r.pax}
                    setup={r.draftSetup}
                    presets={coursePresetSubs}
                    dishPresets={dishPresets}
                    onSetSeatSub={(courseId, seat, sub) => draftSetSeatSub(r.id, courseId, seat, sub)}
                    onAddExtraDish={(courseId, dishName) => draftAddExtraDish(r.id, courseId, dishName)}
                    onRemoveExtraDish={(courseId, index) => draftRemoveExtraDish(r.id, courseId, index)}
                    onSetChefNote={(note) => draftSetChefNote(r.id, note)}
                    onInsertCourseLine={(anchorCourseId, where, name) => draftInsertCourse(r.id, anchorCourseId, where, name)}
                    onDeleteCourseLine={(courseId) => draftDeleteCourse(r.id, courseId)}
                    onMoveCourseLine={(courseId, dir) => draftMoveCourse(r.id, courseId, dir)}
                  />
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** ===================== KDS RAIL UI ===================== */

function KdsRail({
  tables,
  markDone,
  now,
  needsPauseAttention,
  onAcknowledgePause,
  reservationById,
  onEditKdsTable,
}: {
  tables: Table[];
  markDone: (tableId: number, courseId: string) => void;
  now: number;
  needsPauseAttention: (t: Table) => boolean;
  onAcknowledgePause: (t: Table) => void;
  reservationById: Map<string, Reservation>;
  onEditKdsTable: (tableId: number) => void;
}) {
  const { t } = useI18n();
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
        <div className="text-sm font-black text-white">{t("KDS RAIL", "KDS RAIL")}</div>
        <div className="ml-3 text-xs text-zinc-400">
          {t(
            "White tickets • full menu • pairing/allergy/paused on top • fired time + refire count",
            "White tickets • full menu • pairing/allergy/paused on top • fired time + refire count"
          )}
        </div>
      </div>

      {/* ACTION RAIL */}
      <div className="border-b border-zinc-800 bg-black px-6 py-3">
        <div className="text-[11px] font-black text-zinc-300 tracking-widest">{t("ACTION RAIL", "ACTION RAIL")}</div>

        {attention.length === 0 ? (
          <div className="mt-2 text-xs text-zinc-500">
            {t("No paused tables need attention.", "No paused tables need attention.")}
          </div>
        ) : (
          <div className="mt-2 flex gap-2 flex-wrap">
          {attention.map((table) => (
              <button
                key={table.id}
                onClick={() => {
                  // jump to ticket
                  const el = ticketRefs.current[table.id];
                  if (el) el.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
                }}
                className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900/50 text-zinc-100 text-xs font-black"
              >
                {table.name} • {t("PAUSED", "PAUSED")}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tickets (horizontal rail) */}
      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-4 min-w-max">
          {sorted.length === 0 ? (
            <div className="text-zinc-500 border border-dashed border-zinc-700 rounded-2xl p-6 bg-black/30">
              {t("No approved tables yet.", "No approved tables yet.")}
            </div>
          ) : (
            sorted.map((table) => (
              <div
                key={table.id}
                ref={(node) => {
                  ticketRefs.current[table.id] = node;
                }}
                className="w-[360px] shrink-0"
              >
                <div className="mb-2 text-xs font-black text-zinc-300">{t("KDS TICKET", "KDS TICKET")}</div>
                <KdsTicket
                  table={table}
                  markDone={markDone}
                  now={now}
                  pauseNeedsAttention={needsPauseAttention(table)}
                  onAcknowledgePause={() => onAcknowledgePause(table)}
                  mode="KDS"
                  editMode={false}
                  onToggleEdit={() => onEditKdsTable(table.id)}
                  labelMode="approval"
                  guestSeatMap={
                    table.reservationId
                      ? reservationById.get(String(table.reservationId))?.draftGuestSeatMap
                      : undefined
                  }
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** ===================== DRAFT RAIL UI ===================== */

function DraftRail({
  reservations,
  onEditDraft,
}: {
  reservations: Reservation[];
  onEditDraft: (resId: string | number) => void;
}) {
  const { t } = useI18n();
  const draftTables = React.useMemo(() => {
    return reservations
      .filter((r) => r.draftSetup)
      .map((r) => ({
        id: -1,
        name: r.tablePref || t("DRAFT", "DRAFT"),
        pax: r.pax,
        status: "SEATED",
        x: 0,
        y: 0,
        reservationName: r.name,
        reservationPax: r.pax,
        reservationTime: r.time,
        language: r.language,
        setup: r.draftSetup,
        reservationId: r.id,
      })) as Table[];
  }, [reservations, t]);

  return (
    <div className="flex-1 overflow-hidden bg-zinc-900">
      <div className="h-12 border-b border-zinc-800 bg-zinc-950 flex items-center px-6">
        <div className="text-sm font-black text-white">{t("DRAFT TICKETS", "DRAFT TICKETS")}</div>
        <div className="ml-3 text-xs text-zinc-400">{draftTables.length}</div>
      </div>

      <div className="h-full overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 p-4 min-w-max">
          {draftTables.length === 0 ? (
            <div className="text-zinc-500 border border-dashed border-zinc-700 rounded-2xl p-6 bg-black/30">
              {t("No draft tickets.", "No draft tickets.")}
            </div>
          ) : (
            draftTables.map((table) => {
              const resId = table.reservationId as string;
              return (
                <div key={resId} className="w-[360px] shrink-0">
                  <div className="mb-2 text-xs font-black text-zinc-300">{t("KDS TICKET", "KDS TICKET")}</div>
                  <KdsTicket
                    table={table}
                    mode="PREVIEW"
                    editMode={false}
                    onToggleEdit={() => onEditDraft(resId)}
                    labelMode="draft"
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/** ===================== APPROVAL EDITOR ===================== */

function KitchenApprovalEditor({
  table,
  presets,
  dishPresets,
  menus,
  onSetSeatMenu,
  onSetSeatSub,
  onAddExtraDish,
  onRemoveExtraDish,
  onSetChefNote,
  onInsertChefSpecial,
  onDeleteCourseLine,
  onMoveCourseLine,
  onApprove,
}: {
  table: Table;
  presets: string[];
  dishPresets: string[];
  menus: Array<{ id: string; label: string }>;
  onSetSeatMenu: (tableId: number, seat: number, menuId: string) => void;
  onSetSeatSub: (tableId: number, courseId: string, seat: number, sub: string) => void;
  onAddExtraDish: (tableId: number, courseId: string, dishName: string) => void;
  onRemoveExtraDish: (tableId: number, courseId: string, index: number) => void;
  onSetChefNote: (tableId: number, note: string) => void;
  onInsertChefSpecial: (
    tableId: number,
    anchorCourseId: string,
    where: "BEFORE" | "AFTER",
    name: string
  ) => void;
  onDeleteCourseLine: (tableId: number, courseId: string) => void;
  onMoveCourseLine: (tableId: number, courseId: string, dir: -1 | 1) => void;
  onApprove: () => void;
}) {
  const { t } = useI18n();
  const setup = table.setup!;
  const noteFlag = hasAnySeatNote(setup.allergiesBySeat);
  const paused = !!setup.paused;

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            {table.name}
          </span>
          {table.tableLanguage ? (
            <div className="ml-2 px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-[10px] font-black text-zinc-200">
              {table.tableLanguage}
            </div>
          ) : null}

          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            {t("MENU", "MENU")} {getMenuById(setup.menuId)?.label || t("Menu", "Menu")}
          </span>

          {setup.pairing && (
            <span className="px-3 py-1 rounded border border-indigo-600 bg-indigo-900/25 text-sm font-black text-indigo-200">
              {t("PAIRING", "PAIRING")}
            </span>
          )}

          {noteFlag && (
            <span className="px-3 py-1 rounded border border-red-600 bg-red-900/25 text-sm font-black text-red-200">
              {t("ALLERGY", "ALLERGY")}
            </span>
          )}

          {paused && (
            <span className="px-3 py-1 rounded border border-zinc-600 bg-zinc-950 text-sm font-black text-zinc-200">
              {t("PAUSED", "PAUSED")}
            </span>
          )}

          <span className="px-3 py-1 rounded border border-amber-600 bg-amber-900/30 text-sm font-black text-amber-200">
            {t("PENDING", "PENDING")}
          </span>
        </div>
      </div>

      <TicketEditor
        pax={table.pax}
        setup={setup}
        presets={presets}
        dishPresets={dishPresets}
        menus={menus}
        onSetSeatMenu={(seat, menuId) => onSetSeatMenu(table.id, seat, menuId)}
        onSetSeatSub={(courseId, seat, sub) => onSetSeatSub(table.id, courseId, seat, sub)}
        onAddExtraDish={(courseId, dishName) => onAddExtraDish(table.id, courseId, dishName)}
        onRemoveExtraDish={(courseId, index) => onRemoveExtraDish(table.id, courseId, index)}
        onSetChefNote={(note) => onSetChefNote(table.id, note)}
        onInsertCourseLine={(anchorCourseId, where, name) =>
          onInsertChefSpecial(table.id, anchorCourseId, where, name)
        }
        onDeleteCourseLine={(courseId) => onDeleteCourseLine(table.id, courseId)}
        onMoveCourseLine={(courseId, dir) => onMoveCourseLine(table.id, courseId, dir)}
      />

      <div className="flex items-center justify-end">
        <button onClick={onApprove} className="px-6 py-4 rounded-2xl bg-green-600 hover:bg-green-500 text-black font-black">
          {t("APPROVE TABLE", "APPROVE TABLE")}
        </button>
      </div>
    </div>
  );
}
