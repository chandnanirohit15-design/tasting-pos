"use client";

import React from "react";
import {
  useAppState,
  type Table,
  type Reservation,
  type GuestId,
  guestsForPax,
} from "../app-state";
import { MapView } from "../components/map-view";
import { KdsTicket } from "../../components/kds-ticket";
import { courseSeatBreakdown } from "../../components/kds-ticket";
import { loadSettings } from "../settings/settings-store";
import { useI18n } from "../i18n";

export default function ReservationsPage() {
  const { t } = useI18n();
  const {
    reservations,
    tables,
    assignReservationToTable,
    clearReservationFromTable,
    seatAssignedTable,
    updateReservation,
    updateReservationNote,
    addReservation,
    deleteReservation,
    setDraftMenu,
    setDraftGuestMenu,
    createDraftForReservation,
    markDraftPrepared,
    clearDraft,
    draftInsertCourse,
    draftDeleteCourse,
    draftMoveCourse,
    draftAddExtraDish,
    draftRemoveExtraDish,
    dishPresets,
    draftAddGuestSub,
    draftRemoveGuestSub,
    getEffectiveDraftSetupForTable,
  } = useAppState();

  const [selectedReservationId, setSelectedReservationId] = React.useState<string | null>(null);
  const [openResNotesId, setOpenResNotesId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"ALL" | "NOT_SEATED" | "SEATED">("NOT_SEATED");
  const [draftOpenId, setDraftOpenId] = React.useState<string | null>(null);
  const [selectedDate, setSelectedDate] = React.useState(() => {
    const d = new Date();
    return d.toISOString().slice(0, 10);
  });
  const [service, setService] = React.useState<"LUNCH" | "DINNER">("DINNER");
  const [viewMode, setViewMode] = React.useState<"PLAN" | "SERVICE">("PLAN");
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const selectedReservation = React.useMemo(
    () => reservations.find((r) => r.id === selectedReservationId) || null,
    [reservations, selectedReservationId]
  );
  const editing = React.useMemo(() => reservations.find((r) => r.id === editingId) || null, [reservations, editingId]);
  const activeDraft = React.useMemo(() => reservations.find((r) => r.id === draftOpenId) || null, [reservations, draftOpenId]);

  const tableById = React.useMemo(() => new Map(tables.map((t) => [t.id, t])), [tables]);

  const filteredReservations = reservations
    .filter((r) => {
      if (r.date && r.date !== selectedDate) return false;
      if (r.service && r.service !== service) return false;
      return true;
    })
    .filter((r) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        r.name?.toLowerCase().includes(q) ||
        String(r.pax ?? "").includes(q) ||
        r.time?.toLowerCase?.().includes(q)
      );
    })
    .filter((r) => {
      const isSeated = !!r.tableId;
      if (filter === "ALL") return true;
      if (filter === "SEATED") return isSeated;
      return !isSeated;
    });

  const draftOpen = !!activeDraft;
  const draftGuestSeatMap = React.useMemo(() => {
    if (!activeDraft) return null;
    const preview: Partial<Record<GuestId, number>> = {};
    guestsForPax(activeDraft.pax).forEach((g, idx) => {
      preview[g] = idx + 1;
    });
    return { ...preview, ...(activeDraft.draftGuestSeatMap || {}) };
  }, [activeDraft]);
  const draftTable = React.useMemo(() => {
    if (!activeDraft?.draftSetup) return null;

    const previewTable: Table = {
      id: -1,
      name: activeDraft.tablePref || "RES",
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

    const previewReservation: Reservation = {
      ...activeDraft,
      tableId: -1,
      // Draft page should NOT assign seats, but preview needs a stable mapping.
      draftGuestSeatMap: draftGuestSeatMap || {},
    };

    const effective = getEffectiveDraftSetupForTable(previewReservation, previewReservation.pax || 0);
    return { ...previewTable, setup: effective ?? previewTable.setup };
  }, [activeDraft, draftGuestSeatMap, getEffectiveDraftSetupForTable]);

  const assignToTable = React.useCallback(
    (reservationId: string, tableId: number) => {
      const r = reservations.find((x) => x.id === reservationId);
      if (!r) return;

      const t = tables.find((x) => x.id === tableId);
      if (!t) return;

      if (t.reservationStatus === "ASSIGNED" || t.reservationStatus === "SEATED") {
        const ok = window.confirm(`Table ${t.name} is already reserved. Replace?`);
        if (!ok) return;
      }

      assignReservationToTable(r, tableId);
      updateReservation(reservationId, { tableId });
      if (t.reservationId) updateReservation(t.reservationId, { tableId: undefined });

      if (viewMode === "SERVICE") {
        seatAssignedTable(tableId);
      }

      setSelectedReservationId((prev) => (prev === reservationId ? null : prev));
    },
    [assignReservationToTable, reservations, tables, updateReservation, seatAssignedTable, viewMode]
  );

  const unassignReservationFromTable = React.useCallback(
    (reservationId: string) => {
      const r = reservations.find((x) => x.id === reservationId);
      if (!r?.tableId) return;
      clearReservationFromTable(r.tableId);
      updateReservation(reservationId, { tableId: undefined });
    },
    [clearReservationFromTable, reservations, updateReservation]
  );

  // Drag handlers
  const onDragStartReservation = (e: React.DragEvent, reservationId: string) => {
    e.dataTransfer.setData("text/plain", reservationId);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <>
      <div
        className={[
          "h-full w-full bg-[#0b0b0d] grid",
          draftOpen ? "md:grid-cols-[360px_1fr_380px]" : "md:grid-cols-[380px_1fr]",
        ].join(" ")}
      >
        {/* LEFT: RESERVATIONS */}
        <aside className="border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold tracking-wide text-zinc-200">{t("Reservations", "Reservations")}</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-500">{reservations.length}</span>
            <button
              onClick={() => {
                const id = `r_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`;
                addReservation({
                  id,
                  name: t("New reservation", "New reservation"),
                  pax: 2,
                  language: "EN",
                  date: selectedDate,
                  service,
                  status: "BOOKED",
                  note: "",
                  reservationNote: "",
                  draftMenuId: loadSettings().menus[0]?.id || "m_a",
                  tags: [],
                });
                setEditingId(id);
              }}
              className="px-4 py-2 rounded-xl text-xs font-black border border-amber-400 bg-amber-500 text-black hover:bg-amber-400"
            >
              {t("+ NEW", "+ NEW")}
            </button>
          </div>
        </div>

        <div className="text-xs text-zinc-500 mb-3">
          {t(
            "Tap a reservation then tap a table, or drag it onto a table.",
            "Tap a reservation then tap a table, or drag it onto a table."
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none"
          />

          <button
            onClick={() => setService("LUNCH")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              service === "LUNCH"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {t("LUNCH", "LUNCH")}
          </button>
          <button
            onClick={() => setService("DINNER")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              service === "DINNER"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {t("DINNER", "DINNER")}
          </button>
          <button
            onClick={() => setViewMode("PLAN")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              viewMode === "PLAN"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {t("PLAN VIEW", "PLAN VIEW")}
          </button>
          <button
            onClick={() => setViewMode("SERVICE")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              viewMode === "SERVICE"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            {t("SERVICE VIEW", "SERVICE VIEW")}
          </button>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("Search name / pax / time…", "Search name / pax / time…")}
            className="flex-1 rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
          />

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none"
          >
            <option value="NOT_SEATED">{t("Not seated", "Not seated")}</option>
            <option value="SEATED">{t("Seated", "Seated")}</option>
            <option value="ALL">{t("All", "All")}</option>
          </select>
        </div>

        <div className="space-y-2">
          {filteredReservations.map((r) => {
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
                    ? "border-amber-500/70 bg-amber-500/10"
                    : "border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/70",
                ].join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-bold text-white">{r.name}</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {r.time} • {r.pax} {t("pax", "pax")}
                    </div>
                    {r.tableId ? (
                      <div className="mt-1 text-xs font-black text-amber-300">
                        {t("Assigned to", "Assigned to")} {tableById.get(r.tableId)?.name || `T${r.tableId}`}
                      </div>
                    ) : null}
                  </div>

                  <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200 font-bold">
                    {r.language}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded border border-zinc-700 bg-zinc-950 text-zinc-200 font-bold">
                    {t("DRAFT", "DRAFT")} {r.draftStatus || "NONE"}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenResNotesId(openResNotesId === r.id ? null : r.id);
                    }}
                    className="text-[11px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-300 hover:bg-zinc-900/40"
                  >
                    {t("Notes", "Notes")}
                    {r.reservationNote ? (
                      <span className="ml-2 text-[10px] font-black text-amber-300">{t("NOTE", "NOTE")}</span>
                    ) : null}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingId(r.id);
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
                  >
                    {t("EDIT", "EDIT")}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-2">
                  {(r.draftStatus ?? "NONE") === "NONE" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        createDraftForReservation(r.id);
                        setDraftOpenId(r.id);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-black border border-amber-500/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                    >
                      {t("CREATE DRAFT", "CREATE DRAFT")}
                    </button>
                  ) : null}

                  {(r.draftStatus ?? "NONE") === "DRAFT" ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftOpenId(r.id);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      >
                        {t("EDIT DRAFT", "EDIT DRAFT")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          markDraftPrepared(r.id);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-green-600/60 bg-green-900/20 text-green-200 hover:bg-green-900/30"
                      >
                        {t("MARK PREPPED", "MARK PREPPED")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearDraft(r.id);
                          if (draftOpenId === r.id) setDraftOpenId(null);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-red-700 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                      >
                        {t("CLEAR", "CLEAR")}
                      </button>
                    </>
                  ) : null}

                  {(r.draftStatus ?? "NONE") === "PREPPED" ? (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDraftOpenId(r.id);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      >
                        {t("VIEW/EDIT", "VIEW/EDIT")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateReservation(r.id, { draftStatus: "DRAFT", draftUpdatedAt: Date.now() });
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      >
                        {t("UNPREP", "UNPREP")}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearDraft(r.id);
                          if (draftOpenId === r.id) setDraftOpenId(null);
                        }}
                        className="px-3 py-2 rounded-xl text-xs font-black border border-red-700 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                      >
                        {t("CLEAR", "CLEAR")}
                      </button>
                    </>
                  ) : null}
                </div>

                {openResNotesId === r.id && r.reservationNote ? (
                  <div className="mt-2 text-xs text-zinc-300 rounded-xl border border-zinc-800 bg-black/40 p-2">
                    {r.reservationNote}
                  </div>
                ) : null}

                {r.tableId ? (
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        unassignReservationFromTable(r.id);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
                    >
                      {t("UNSEAT", "UNSEAT")}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedReservationId(r.id);
                      }}
                      className="px-3 py-2 rounded-xl text-xs font-black border border-amber-400/50 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15"
                    >
                      {t("MOVE", "MOVE")}
                    </button>
                  </div>
                ) : null}

                <div className="text-[10px] text-zinc-600 mt-2">
                  {t("Drag to table • Tap to select", "Drag to table • Tap to select")}
                </div>
              </div>
            );
          })}

          {filteredReservations.length === 0 && (
            <div className="text-sm text-zinc-500 border border-dashed border-zinc-800 rounded-xl p-4">
              {t("No reservations match this filter.", "No reservations match this filter.")}
            </div>
          )}
        </div>

        <div className="mt-4 border-t border-zinc-800 pt-3">
          <div className="text-xs text-zinc-500">{t("Selected", "Selected")}</div>
          <div className="text-sm text-white font-bold">
            {selectedReservation ? `${selectedReservation.name} (${selectedReservation.pax})` : t("None", "None")}
          </div>
        </div>
      </aside>

        {/* MIDDLE: MAP or DRAFT EDITOR */}
        <main className="overflow-hidden bg-[#0f0f12]">
          {!draftOpen ? (
            <div className="h-full w-full p-6 overflow-y-auto">
              <div className="mb-4 flex items-center gap-2">
                <div className="px-3 py-2 rounded-lg border border-zinc-800 bg-black/60 text-xs text-zinc-300">
                  {t("Mode", "Mode")}: <span className="font-bold text-white">{t("Seating", "Seating")}</span>
                </div>

                {selectedReservation && (
                  <div className="px-3 py-2 rounded-lg border border-blue-700 bg-blue-900/30 text-xs text-blue-100">
                    {t("Assign", "Assign")}: <span className="font-bold">{selectedReservation.name}</span>
                  </div>
                )}
              </div>

              <MapView
                mode="seating"
                tables={tables}
                storageKey="tastingpos_res_active_map_page"
                selectedReservationId={selectedReservationId}
                onDropReservationOnTable={(reservationId, tableId) => assignToTable(reservationId, tableId)}
                onClickTable={(tableId) => {
                  if (!selectedReservationId) return;
                  assignToTable(selectedReservationId, tableId);
                  setSelectedReservationId(null);
                }}
              />
            </div>
          ) : (
            <div className="hidden md:block h-full w-full p-6 overflow-y-auto">
              <div className="mb-4 flex items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-black text-white">{t("Draft Ticket", "Draft Ticket")}</div>
                  <div className="text-xs text-zinc-500">{activeDraft?.name}</div>
                </div>
                <button
                  onClick={() => setDraftOpenId(null)}
                  className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
                >
                  {t("CLOSE", "CLOSE")}
                </button>
              </div>

              {activeDraft?.draftSetup ? (
                <DraftEditor
                  reservation={activeDraft}
                  dishPresets={dishPresets}
                  onUpdateReservationNote={(text) => updateReservationNote(activeDraft.id, text)}
                  onSetDraftMenu={(menuId) => setDraftMenu(activeDraft.id, menuId)}
                  onSetDraftGuestMenu={(guest, menuId) => setDraftGuestMenu(activeDraft.id, guest, menuId)}
                  onInsertCourseLine={(anchorCourseId, where, name) =>
                    draftInsertCourse(activeDraft.id, anchorCourseId, where, name)
                  }
                  onDeleteCourseLine={(courseId) => draftDeleteCourse(activeDraft.id, courseId)}
                  onMoveCourseLine={(courseId, dir) => draftMoveCourse(activeDraft.id, courseId, dir)}
                  onAddExtraDish={(courseId, dishName) => draftAddExtraDish(activeDraft.id, courseId, dishName)}
                  onRemoveExtraDish={(courseId, index) => draftRemoveExtraDish(activeDraft.id, courseId, index)}
                  onAddGuestSub={(courseId, guest, text) =>
                    draftAddGuestSub(String(activeDraft.id), courseId, guest, text)
                  }
                  onRemoveGuestSub={(subId) => draftRemoveGuestSub(String(activeDraft.id), subId)}
                />
              ) : (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
                  {t("No draft setup yet. Create a draft to start editing.", "No draft setup yet. Create a draft to start editing.")}
                </div>
              )}
            </div>
          )}
        </main>

        {/* RIGHT: DRAFT PREVIEW */}
        {draftOpen ? (
          <aside className="hidden md:block h-full overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-black text-zinc-200">{t("DRAFT PREVIEW", "DRAFT PREVIEW")}</div>
                <div className="text-[10px] font-black text-zinc-500">{t("KDS ticket", "KDS ticket")}</div>
              </div>

              {draftTable ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-2">
                  <KdsTicket
                    table={draftTable}
                    mode="PREVIEW"
                    labelMode="draft"
                    guestSubs={activeDraft?.draftGuestSubs || []}
                    guestSeatMap={draftGuestSeatMap || undefined}
                  />
                </div>
              ) : (
                <div className="text-sm text-zinc-500">{t("Create a draft to preview.", "Create a draft to preview.")}</div>
              )}
            </div>
          </aside>
        ) : null}
      </div>

      {draftOpen ? (
        <div className="md:hidden fixed inset-0 z-40 bg-[#0b0b0d] flex flex-col">
          <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
            <div>
              <div className="text-sm font-black text-white">{t("Draft Ticket", "Draft Ticket")}</div>
              <div className="text-xs text-zinc-500">{activeDraft?.name}</div>
            </div>
            <button
              onClick={() => setDraftOpenId(null)}
              className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
            >
              {t("CLOSE", "CLOSE")}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {activeDraft?.draftSetup ? (
                <DraftEditor
                  reservation={activeDraft}
                  dishPresets={dishPresets}
                  onUpdateReservationNote={(text) => updateReservationNote(activeDraft.id, text)}
                  onSetDraftMenu={(menuId) => setDraftMenu(activeDraft.id, menuId)}
                  onSetDraftGuestMenu={(guest, menuId) => setDraftGuestMenu(activeDraft.id, guest, menuId)}
                  onInsertCourseLine={(anchorCourseId, where, name) =>
                    draftInsertCourse(activeDraft.id, anchorCourseId, where, name)
                  }
                onDeleteCourseLine={(courseId) => draftDeleteCourse(activeDraft.id, courseId)}
                onMoveCourseLine={(courseId, dir) => draftMoveCourse(activeDraft.id, courseId, dir)}
                onAddExtraDish={(courseId, dishName) => draftAddExtraDish(activeDraft.id, courseId, dishName)}
                onRemoveExtraDish={(courseId, index) => draftRemoveExtraDish(activeDraft.id, courseId, index)}
                onAddGuestSub={(courseId, guest, text) =>
                  draftAddGuestSub(String(activeDraft.id), courseId, guest, text)
                }
                onRemoveGuestSub={(subId) => draftRemoveGuestSub(String(activeDraft.id), subId)}
              />
            ) : (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
                {t("No draft setup yet. Create a draft to start editing.", "No draft setup yet. Create a draft to start editing.")}
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-black text-zinc-200">{t("DRAFT PREVIEW", "DRAFT PREVIEW")}</div>
                <div className="text-[10px] font-black text-zinc-500">{t("KDS ticket", "KDS ticket")}</div>
              </div>

              {draftTable ? (
                <div className="rounded-2xl border border-zinc-800 bg-black/30 p-2">
                  <KdsTicket
                    table={draftTable}
                    mode="PREVIEW"
                    labelMode="draft"
                    guestSubs={activeDraft?.draftGuestSubs || []}
                    guestSeatMap={draftGuestSeatMap || undefined}
                  />
                </div>
              ) : (
                <div className="text-sm text-zinc-500">{t("Create a draft to preview.", "Create a draft to preview.")}</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {editing ? (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-[#0f0f12] overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
              <div className="text-sm font-black text-white">{t("Edit reservation", "Edit reservation")}</div>
              <button
                onClick={() => setEditingId(null)}
                className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40"
              >
                {t("CLOSE", "CLOSE")}
              </button>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              <Field label={t("Name", "Name")}>
                <input
                  className={inp}
                  value={editing.name}
                  onChange={(e) => updateReservation(editing.id, { name: e.target.value })}
                />
              </Field>

              <Field label={t("Phone", "Phone")}>
                <input
                  className={inp}
                  value={editing.phone || ""}
                  onChange={(e) => updateReservation(editing.id, { phone: e.target.value })}
                />
              </Field>

              <Field label={t("Email", "Email")}>
                <input
                  className={inp}
                  value={editing.email || ""}
                  onChange={(e) => updateReservation(editing.id, { email: e.target.value })}
                />
              </Field>

              <Field label={t("Pax", "Pax")}>
                <input
                  type="number"
                  className={inp}
                  value={editing.pax}
                  onChange={(e) =>
                    updateReservation(editing.id, { pax: parseInt(e.target.value || "1", 10) })
                  }
                />
              </Field>

              <Field label={t("Date", "Date")}>
                <input
                  type="date"
                  className={inp}
                  value={editing.date || selectedDate}
                  onChange={(e) => updateReservation(editing.id, { date: e.target.value })}
                />
              </Field>

              <Field label={t("Service", "Service")}>
                <select
                  className={inp}
                  value={editing.service || service}
                  onChange={(e) => updateReservation(editing.id, { service: e.target.value as any })}
                >
                  <option value="LUNCH">{t("LUNCH", "LUNCH")}</option>
                  <option value="DINNER">{t("DINNER", "DINNER")}</option>
                </select>
              </Field>

              <Field label={t("Status", "Status")}>
                <select
                  className={inp}
                  value={editing.status || "BOOKED"}
                  onChange={(e) => updateReservation(editing.id, { status: e.target.value as any })}
                >
                  <option value="BOOKED">{t("BOOKED", "BOOKED")}</option>
                  <option value="ARRIVED">{t("ARRIVED", "ARRIVED")}</option>
                  <option value="NO_SHOW">{t("NO SHOW", "NO SHOW")}</option>
                  <option value="CANCELLED">{t("CANCELLED", "CANCELLED")}</option>
                </select>
              </Field>

              <Field label={t("Channel", "Channel")}>
                <input
                  className={inp}
                  value={editing.channel || ""}
                  onChange={(e) => updateReservation(editing.id, { channel: e.target.value })}
                />
              </Field>

              <div className="col-span-2">
                <div className="text-xs font-black text-zinc-300 mb-2">
                  {t("Reservation notes (hidden unless opened)", "Reservation notes (hidden unless opened)")}
                </div>
                <textarea
                  className={`${inp} min-h-[90px]`}
                  value={editing.reservationNote || ""}
                  onChange={(e) => updateReservationNote(editing.id, e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <div className="text-xs font-black text-zinc-300 mb-2">
                  {t("Allergies (reservation level)", "Allergies (reservation level)")}
                </div>
                <input
                  className={inp}
                  value={editing.allergies || ""}
                  onChange={(e) => updateReservation(editing.id, { allergies: e.target.value })}
                />
              </div>

              <div className="col-span-2 flex items-center justify-between pt-2">
                <button
                  onClick={() => {
                    deleteReservation(editing.id);
                    setEditingId(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-black border border-red-700 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                >
                  {t("DELETE", "DELETE")}
                </button>
                <div className="text-xs text-zinc-500">{t("Auto-saved (offline)", "Auto-saved (offline)")}</div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function DraftEditor({
  reservation,
  dishPresets,
  onUpdateReservationNote,
  onSetDraftMenu,
  onSetDraftGuestMenu,
  onInsertCourseLine,
  onDeleteCourseLine,
  onMoveCourseLine,
  onAddExtraDish,
  onRemoveExtraDish,
  onAddGuestSub,
  onRemoveGuestSub,
}: {
  reservation: Reservation;
  dishPresets: string[];
  onUpdateReservationNote: (text: string) => void;
  onSetDraftMenu: (menuId: string) => void;
  onSetDraftGuestMenu: (guest: GuestId, menuId: string) => void;
  onInsertCourseLine: (anchorCourseId: string, where: "BEFORE" | "AFTER", name: string) => void;
  onDeleteCourseLine: (courseId: string) => void;
  onMoveCourseLine: (courseId: string, dir: -1 | 1) => void;
  onAddExtraDish: (courseId: string, dishName: string) => void;
  onRemoveExtraDish: (courseId: string, index: number) => void;
  onAddGuestSub: (courseId: string, guest: GuestId, text: string) => void;
  onRemoveGuestSub: (subId: string) => void;
}) {
  const { t } = useI18n();
  const setup = reservation.draftSetup!;
  const [expandedCourseId, setExpandedCourseId] = React.useState<string | null>(null);
  const [draftGuestPick, setDraftGuestPick] = React.useState<GuestId>("A");
  const [draftSubText, setDraftSubText] = React.useState("");
  const [showResNotes, setShowResNotes] = React.useState(false);
  const guests = guestsForPax(reservation.pax || 1);
  const seatLabel = React.useCallback(
    (seat: number) => {
      const g = guests[seat - 1];
      return g ? `${t("Guest", "Guest")} ${g}` : `${t("Seat", "Seat")} ${seat}`;
    },
    [guests]
  );
  const menus = React.useMemo(() => loadSettings().menus || [], []);
  const currentMenuId = reservation.draftMenuId || setup.menuId;

  React.useEffect(() => {
    if (!guests.includes(draftGuestPick)) setDraftGuestPick(guests[0]);
  }, [draftGuestPick, guests]);

  return (
    <div className="mt-2 space-y-4">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            {reservation.name}
          </span>
          <span className="px-3 py-1 rounded border border-zinc-700 bg-zinc-950 text-sm font-black text-zinc-200">
            {reservation.pax} {t("PAX", "PAX")}
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-zinc-400">{t("MENU", "MENU")}</span>
            <select
              value={currentMenuId}
              onChange={(e) => {
                if (reservation.draftGuestSubs && reservation.draftGuestSubs.length > 0) {
                  const ok = window.confirm(
                    t(
                      "Changing menu may clear guest substitutions if courses don't match. Continue?",
                      "Changing menu may clear guest substitutions if courses don't match. Continue?"
                    )
                  );
                  if (!ok) return;
                }
                onSetDraftMenu(e.target.value);
              }}
              className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm"
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 rounded-xl border border-zinc-800 bg-black/40 overflow-hidden">
          <button
            onClick={() => setShowResNotes((v) => !v)}
            className="w-full px-3 py-2 flex items-center justify-between text-left"
          >
            <div className="text-[10px] font-black text-zinc-300">{t("RESERVATION NOTES", "RESERVATION NOTES")}</div>
            <div className="text-[10px] font-black text-amber-300">
              {showResNotes ? t("HIDE", "HIDE") : t("SHOW", "SHOW")}
            </div>
          </button>
          {showResNotes ? (
            <div className="px-3 pb-3">
              <textarea
                value={reservation.reservationNote || ""}
                onChange={(e) => onUpdateReservationNote(e.target.value)}
                onBlur={(e) => onUpdateReservationNote(e.target.value)}
                placeholder={t("Add reservation notes…", "Add reservation notes…")}
                className="w-full min-h-[80px] rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950">
          <div className="text-sm font-black text-white">{t("GUEST MENU (DRAFT)", "GUEST MENU (DRAFT)")}</div>
          <div className="text-xs text-zinc-500 mt-1">
            {t(
              "Choose menu per guest. Seat assignment happens in Room when they arrive.",
              "Choose menu per guest. Seat assignment happens in Room when they arrive."
            )}
          </div>
        </div>

        <div className="p-4 space-y-3">
          {guestsForPax(reservation.pax).map((g) => {
            const val =
              reservation.draftGuestMenuMap?.[g] ||
              reservation.draftGuestMenuId?.[g] ||
              reservation.draftMenuId ||
              menus[0]?.id;

            return (
              <div key={g} className="rounded-2xl border border-zinc-800 bg-black/40 p-4">
                <div className="flex items-center justify-between">
                  <div className="text-white font-black">{t("Guest", "Guest")} {g}</div>
                  <div className="text-[10px] font-black text-zinc-500">{t("Draft", "Draft")}</div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <div className="text-xs font-black text-zinc-300">{t("MENU", "MENU")}</div>
                  <select
                    value={val}
                  onChange={(e) => onSetDraftGuestMenu(g, e.target.value)}
                    className="w-[220px] rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">{t("SUBSTITUTIONS PER GUEST", "SUBSTITUTIONS PER GUEST")}</div>
          <div className="text-xs text-zinc-500">
            {t("Tap a course → add guest substitutions", "Tap a course → add guest substitutions")}
          </div>
        </div>

        <div className="divide-y divide-zinc-800">
          {setup.courseLines.map((c) => {
            const subs = (reservation.draftGuestSubs || []).filter((s) => s.courseId === c.id);
            return (
              <div key={c.id} className="p-4">
                <button
                  onClick={() => setExpandedCourseId((prev) => (prev === c.id ? null : c.id))}
                  className="w-full text-left flex items-start justify-between gap-3"
                >
                  <div>
                    {(() => {
                      const bd = courseSeatBreakdown(c, reservation.pax);
                      return (
                        <>
                          <div className="text-white font-black">
                            <span className="text-zinc-400 font-mono text-xs">#{c.idx}</span> {bd.baseCount}x {bd.baseDish}
                          </div>
                          {bd.exceptions.length > 0 ? (
                            <div className="mt-1 text-xs text-zinc-400 space-y-1">
                              {bd.exceptions.map((e) => (
                                <div key={e.seat}>
                                  <span className="font-black text-zinc-300">{seatLabel(e.seat)} →</span> {e.dish}
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </>
                      );
                    })()}
                    <div className="text-xs text-zinc-500 mt-1">
                      {subs.length > 0
                        ? t("Guest substitutions set", "Guest substitutions set")
                        : t("No guest substitutions", "No guest substitutions")}
                    </div>
                  </div>

                  <div className="text-xs font-black text-zinc-300">
                    {expandedCourseId === c.id ? t("CLOSE", "CLOSE") : t("EDIT", "EDIT")}
                  </div>
                </button>

                {expandedCourseId === c.id && (
                  <div>
                    <div className="mt-4 rounded-2xl border border-zinc-800 bg-black/30 p-3">
                      <div className="text-xs font-black text-zinc-300">
                        {t("SUBSTITUTIONS PER GUEST (DRAFT)", "SUBSTITUTIONS PER GUEST (DRAFT)")}
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <select
                          value={draftGuestPick}
                          onChange={(e) => setDraftGuestPick(e.target.value as GuestId)}
                          className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm font-black"
                        >
                          {guests.map((g) => (
                            <option key={g} value={g}>
                              {t("Guest", "Guest")} {g}
                            </option>
                          ))}
                        </select>

                        <input
                          value={draftSubText}
                          onChange={(e) => setDraftSubText(e.target.value)}
                          placeholder={t("Type substitute (e.g. feijoa)", "Type substitute (e.g. feijoa)")}
                          className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm"
                        />
                      </div>

                      <button
                        onClick={() => {
                          if (!draftSubText.trim()) return;
                          onAddGuestSub(c.id, draftGuestPick, draftSubText);
                          setDraftSubText("");
                        }}
                        className="mt-2 w-full rounded-xl bg-amber-500 text-black font-black py-2 text-sm"
                      >
                        {t("ADD SUBSTITUTION", "ADD SUBSTITUTION")}
                      </button>

                      <div className="mt-3 space-y-2">
                        {subs.length === 0 ? (
                          <div className="text-xs text-zinc-500">{t("No guest substitutions yet.", "No guest substitutions yet.")}</div>
                        ) : (
                          subs.map((s) => (
                            <div
                              key={s.id}
                              className="flex items-center justify-between rounded-xl border border-zinc-800 bg-black/40 px-3 py-2"
                            >
                              <div className="text-sm text-white">
                                <span className="font-black">{t("Guest", "Guest")} {s.guest}</span>
                                <span className="text-zinc-400"> — </span>
                                <span className="font-semibold">{s.text}</span>
                              </div>
                              <button
                                onClick={() => onRemoveGuestSub(s.id)}
                                className="rounded-lg border border-zinc-700 bg-black/40 px-2 py-1 text-xs font-black text-zinc-200"
                              >
                                {t("REMOVE", "REMOVE")}
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] font-black text-zinc-300">
                          {t("EXTRA DISHES (THIS COURSE)", "EXTRA DISHES (THIS COURSE)")}
                        </div>
                        <select
                          defaultValue=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            if (v === "__custom__") {
                              const custom = prompt(t("Extra dish name?", "Extra dish name?"))?.trim() || "";
                              if (custom) onAddExtraDish(c.id, custom);
                              e.currentTarget.value = "";
                              return;
                            }
                            onAddExtraDish(c.id, v);
                            e.currentTarget.value = "";
                          }}
                          className="rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                        >
                          <option value="">{t("+ Add dish…", "+ Add dish…")}</option>
                          {dishPresets.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                          <option value="__custom__">{t("Custom…", "Custom…")}</option>
                        </select>
                      </div>

                      <div className="mt-2 space-y-2">
                        {(setup.extrasByCourseId?.[c.id] || []).map((x, i) => (
                          <div
                            key={`${x}_${i}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2"
                          >
                            <div className="text-sm text-white font-black truncate">{x}</div>
                            <button
                              onClick={() => onRemoveExtraDish(c.id, i)}
                              className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-black/40 text-xs font-black text-zinc-200 hover:bg-zinc-900/40"
                            >
                              {t("DELETE", "DELETE")}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                        onClick={() => {
                          const name = prompt(t("Course name?", "Course name?"))?.trim() || "";
                          if (name) onInsertCourseLine(c.id, "BEFORE", name);
                        }}
                      >
                        {t("+ ADD BEFORE", "+ ADD BEFORE")}
                      </button>

                      <button
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                        onClick={() => {
                          const name = prompt(t("Course name?", "Course name?"))?.trim() || "";
                          if (name) onInsertCourseLine(c.id, "AFTER", name);
                        }}
                      >
                        {t("+ ADD AFTER", "+ ADD AFTER")}
                      </button>

                      <button
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                        onClick={() => onMoveCourseLine(c.id, -1)}
                      >
                        {t("↑ MOVE", "↑ MOVE")}
                      </button>

                      <button
                        className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                        onClick={() => onMoveCourseLine(c.id, 1)}
                      >
                        {t("↓ MOVE", "↓ MOVE")}
                      </button>

                      <button
                        className="px-3 py-2 rounded-xl text-xs font-black border border-red-700 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                        onClick={() => onDeleteCourseLine(c.id)}
                      >
                        {t("DELETE COURSE", "DELETE COURSE")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-black text-zinc-300 mb-2">{label}</div>
      {children}
    </div>
  );
}

const inp =
  "w-full rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80";
