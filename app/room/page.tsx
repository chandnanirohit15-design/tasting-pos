"use client";

import React from "react";
import { useAppState, type Table, type CourseLine, type GuestId, guestsForPax } from "../app-state";
import { MapView } from "../components/map-view";
import { KdsTicket } from "../../components/kds-ticket";
import { getPairingWineForCourse, loadSettings } from "../settings/settings-store";
import { useI18n } from "../i18n";

function courseCounts(course: CourseLine, pax: number) {
  const seatSubs = course.seatSubs || {};

  // Base dish count = pax - how many seats have a substitution
  const substitutedSeats = Object.entries(seatSubs)
    .map(([seat, sub]) => ({ seat: Number(seat), sub: (sub || "").trim() }))
    .filter((x) => x.sub.length > 0)
    .sort((a, b) => a.seat - b.seat);

  const baseCount = Math.max(0, pax - substitutedSeats.length);

  // ✅ Room-only: show each substituted seat as its own line with seat number
  // Example: "S2 No Dairy Alternative 1x"
  const subSeatLines = substitutedSeats.map((x) => ({
    key: `S${x.seat}_${x.sub}`,
    seat: x.seat,
    sub: x.sub,
  }));

  return { baseCount, subSeatLines };
}

export default function RoomPage() {
  const { t } = useI18n();
  const { tables, hasAllergyFlag, getOnCourse } = useAppState();
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const ACTIVE_TABLE_KEY = "tastingpos_room_active_table";
  const [showResNote, setShowResNote] = React.useState(false);
  const [showFohNote, setShowFohNote] = React.useState(true);
  const [showFullMenu, setShowFullMenu] = React.useState(true);
  const [mobilePanelOpen, setMobilePanelOpen] = React.useState(false);
  const isMobile = typeof window !== "undefined" ? window.innerWidth < 768 : false;

  const selectTable = React.useCallback((id: number) => {
    setActiveId(id);
    try {
      localStorage.setItem(ACTIVE_TABLE_KEY, String(id));
    } catch {}
  }, []);

  const active = React.useMemo(() => tables.find((t) => t.id === activeId) || null, [tables, activeId]);
  const activeStatus = active
    ? active.reservationStatus ?? (active.status === "SEATED" ? "SEATED" : "NONE")
    : "NONE";

  const seatedCount = tables.filter((t) => t.status === "SEATED").length;

  React.useEffect(() => {
    try {
      const saved = localStorage.getItem(ACTIVE_TABLE_KEY);
      if (!saved) return;
      const id = Number(saved);
      if (!id) return;
      const t = tables.find((x) => x.id === id);
      if (t && t.status === "SEATED") setActiveId(id);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    setShowResNote(false);
    setShowFohNote(true);
    setShowFullMenu(true);
  }, [activeId]);

  const mapView = (
    <div className="w-full h-full overflow-hidden touch-none">
      <MapView
        mode="service"
        tables={tables}
        storageKey="tastingpos_room_active_map_page"
        onClickTable={(tableId) => selectTable(tableId)}
      />
    </div>
  );

  const panelContent =
    !active || (activeStatus !== "ASSIGNED" && activeStatus !== "SEATED") ? (
        <div className="text-zinc-500">
          <div className="text-white font-black text-lg">{t("Room Control", "Room Control")}</div>
          <div className="mt-2">{t("Select a seated table to manage it.", "Select a seated table to manage it.")}</div>
        </div>
    ) : (
      <RoomControl
        table={active}
        showResNote={showResNote}
        setShowResNote={setShowResNote}
        showFohNote={showFohNote}
        setShowFohNote={setShowFohNote}
        showFullMenu={showFullMenu}
        setShowFullMenu={setShowFullMenu}
      />
    );

  if (isMobile) {
    return (
      <div className="h-[100dvh] w-full relative bg-black">
        <div className="absolute inset-0">{mapView}</div>

        <div className="absolute top-0 left-0 right-0 p-3 flex justify-between items-center bg-black/50 backdrop-blur">
          <div className="text-white font-black text-sm">{t("ROOM", "ROOM")}</div>
          <button
            onClick={() => setMobilePanelOpen(true)}
            className="px-4 py-2 rounded-xl bg-amber-500 text-black font-black text-xs"
          >
            {t("OPEN PANEL", "OPEN PANEL")}
          </button>
        </div>

        {mobilePanelOpen ? (
          <div className="absolute inset-0">
            <button onClick={() => setMobilePanelOpen(false)} className="absolute inset-0 bg-black/50" />
            <div className="absolute bottom-0 left-0 right-0 max-h-[80dvh] rounded-t-3xl border border-zinc-800 bg-[#0f0f12] p-4 overflow-y-auto">
              <div className="flex items-center justify-between">
                <div className="text-white font-black">{t("PANEL", "PANEL")}</div>
                <button
                  onClick={() => setMobilePanelOpen(false)}
                  className="px-3 py-2 rounded-xl border border-zinc-800 bg-black/40 text-zinc-200 font-black text-xs"
                >
                  {t("CLOSE", "CLOSE")}
                </button>
              </div>

              <div className="mt-4">{panelContent}</div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="h-full w-full bg-[#0f0f12] flex">
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black text-white">{t("Room", "Room")}</div>
            <div className="text-zinc-400 text-sm mt-1">
              {t("Tap a table on the map to manage menu + pacing.", "Tap a table on the map to manage menu + pacing.")}
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            {t("Seated", "Seated")}: <span className="text-white font-black">{seatedCount}</span>
          </div>
        </div>

        <div className="mt-6">{mapView}</div>
      </div>

      <aside className="w-[520px] border-l border-zinc-800 bg-black p-6 overflow-y-auto">
        {panelContent}
      </aside>
    </div>
  );
}

function Badge({ kind, t }: { kind: "NONE" | "PENDING" | "APPROVED"; t: (k: string, f?: string) => string }) {
  if (kind === "NONE")
    return (
      <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-zinc-300">
        {t("NOT SENT", "NOT SENT")}
      </span>
    );
  if (kind === "PENDING")
    return (
      <span className="text-[10px] font-black px-2 py-1 rounded border border-amber-600 bg-amber-900/25 text-amber-200">
        {t("PENDING", "PENDING")}
      </span>
    );
  return (
    <span className="text-[10px] font-black px-2 py-1 rounded border border-green-600 bg-green-900/25 text-green-200">
      {t("APPROVED", "APPROVED")}
    </span>
  );
}

function RoomControl({
  table,
  showResNote,
  setShowResNote,
  showFohNote,
  setShowFohNote,
  showFullMenu,
  setShowFullMenu,
}: {
  table: Table;
  showResNote: boolean;
  setShowResNote: React.Dispatch<React.SetStateAction<boolean>>;
  showFohNote: boolean;
  setShowFohNote: React.Dispatch<React.SetStateAction<boolean>>;
  showFullMenu: boolean;
  setShowFullMenu: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const {
    sendForApproval,
    setPaused,
    fireNextOrRefire,
    hasAllergyFlag,
    getOnCourse,
    setMenuForTable,
    setPairing,
    setAllergy,
    setWineOverride,
    setFohNote,
    toggleWineMenuPassed,
    toggleWineOrdered,
    clearReservationFromTable,
    setTableLanguage,
    setSeatMenu,
    getFireCooldownSeconds,
    reservations,
    draftAssignGuestToSeat,
    draftRemoveGuestSub,
    draftSetGuestMenu,
    getEffectiveDraftSetupForTable,
  } = useAppState();
  const { t } = useI18n();

  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const reservationStatus =
    table.reservationStatus ?? (table.status === "SEATED" ? "SEATED" : "NONE");
  const isAssigned = reservationStatus === "ASSIGNED";
  const isSeated = table.status === "SEATED";
  const reservation = React.useMemo(
    () => (table.reservationId ? reservations.find((r) => r.id === table.reservationId) || null : null),
    [reservations, table.reservationId]
  );
  const setup = isSeated ? table.setup : reservation?.draftSetup;
  const effectiveSetupForRoom = React.useMemo(() => {
    if (!reservation) return null;
    const pax = reservation.pax || table.pax;
    return getEffectiveDraftSetupForTable(reservation, pax);
  }, [reservation, table.pax, getEffectiveDraftSetupForTable]);
  const approval = setup?.approval ?? "NONE";
  const settings = React.useMemo(() => loadSettings(), []);
  const menus = settings.menus || [];
  const menuLabel = menus.find((m) => m.id === setup?.menuId)?.label || t("Menu", "Menu");
  const fullMenuRef = React.useRef<HTMLDivElement | null>(null);
  const firedRowRef = React.useRef<HTMLDivElement | null>(null);
  const [showGuestMap, setShowGuestMap] = React.useState(true);
  const guests = guestsForPax(table.pax || reservation?.pax || 1);
  const takenSeats = React.useMemo(() => {
    const map = reservation?.draftGuestSeatMap || {};
    return new Set(Object.values(map).filter((v) => typeof v === "number" && v > 0) as number[]);
  }, [reservation?.draftGuestSeatMap]);
  React.useEffect(() => {
    if (!reservation) return;
    const hasGuestSubs = (reservation.draftGuestSubs || []).length > 0;
    if (hasGuestSubs) setShowGuestMap(true);
  }, [reservation?.id, reservation?.draftUpdatedAt]);
  const draftTable = React.useMemo(() => {
    if (!reservation?.draftSetup) return null;

    const pax = reservation.pax || table.pax;
    const effective = getEffectiveDraftSetupForTable(reservation, pax);

    const t: Table = {
      id: -1,
      name: table.name,
      pax,
      status: "SEATED",
      x: 0,
      y: 0,
      reservationName: reservation.name,
      reservationPax: reservation.pax,
      reservationTime: reservation.time,
      language: reservation.language,
      setup: effective || reservation.draftSetup,
    };
    return t;
  }, [reservation, table.name, table.pax, getEffectiveDraftSetupForTable]);

  const lines = setup?.courseLines || [];
  const nextPending = lines.find((c) => c.status === "PENDING");
  const nowCourse = lines.find((c) => c.status === "FIRED") || null;
  const nextCourses = lines.filter((c) => c.status === "PENDING").slice(0, 3);
  const pairing = !!setup?.pairing;
  const allergy = hasAllergyFlag(table);
  const onCourse = getOnCourse(table);
  const getWineLabelForCourse = React.useCallback(
    (course: CourseLine) => {
      if (!setup?.pairing || !setup.menuId) return null;
      const override = setup.wineOverrideByCourseId?.[course.id];
      const rule = getPairingWineForCourse(setup.menuId, course.idx);
      return override || rule?.wineName || null;
    },
    [setup]
  );

  const statusBadge = isAssigned
    ? { label: t("ASSIGNED", "ASSIGNED"), className: "border-amber-600 bg-amber-900/25 text-amber-200" }
    : setup?.paused
    ? { label: t("PAUSED", "PAUSED"), className: "border-purple-600 bg-purple-900/20 text-purple-200" }
    : approval === "PENDING"
    ? { label: t("APPROVAL PENDING", "APPROVAL PENDING"), className: "border-amber-600 bg-amber-900/25 text-amber-200" }
    : approval === "APPROVED"
    ? { label: t("APPROVED", "APPROVED"), className: "border-green-600 bg-green-900/25 text-green-200" }
    : { label: t("SEATED", "SEATED"), className: "border-zinc-700 bg-zinc-950 text-zinc-300" };

  const canEditSetup = approval === "NONE" && isSeated;

  React.useEffect(() => {
    if (!isSeated || !effectiveSetupForRoom || !setup) return;
    if (approval === "APPROVED") return;
    const seatMenu = effectiveSetupForRoom.seatMenuId || {};
    for (let seat = 1; seat <= table.pax; seat++) {
      const nextMenu = seatMenu[seat];
      if (!nextMenu) continue;
      if (setup.seatMenuId?.[seat] !== nextMenu) {
        setSeatMenu(table.id, seat, nextMenu);
      }
    }
  }, [isSeated, canEditSetup, effectiveSetupForRoom, setup, table.id, table.pax, setSeatMenu]);

  const cooldownSec = getFireCooldownSeconds(table);
  const coolingDown = cooldownSec > 0;

  const canRefireWhilePaused =
    approval === "APPROVED" &&
    !!setup?.paused &&
    !!setup?.pausedAfterLastFire &&
    !!setup?.lastFiredCourseId &&
    !coolingDown;

  const canFireNext = approval === "APPROVED" && !setup?.paused && !!nextPending && !coolingDown;

  const fireEnabled = canFireNext || canRefireWhilePaused;

  const fireLabel = canRefireWhilePaused ? t("REFIRE LAST FIRED", "REFIRE LAST FIRED") : t("FIRE NEXT COURSE", "FIRE NEXT COURSE");
  const fireWhy = !fireEnabled
    ? coolingDown
      ? `${t("Wait", "Wait")} ${cooldownSec}s`
      : approval !== "APPROVED"
      ? t("Waiting approval", "Waiting approval")
      : setup?.paused
      ? t("Table paused", "Table paused")
      : !nextPending
      ? t("Nothing to fire", "Nothing to fire")
      : ""
    : "";
  const controlsLocked = !isSeated;

  React.useEffect(() => {
    if (!setup) return;
    const fired = setup.courseLines?.find((c) => c.status === "FIRED");
    if (!fired) return;

    const t = setTimeout(() => {
      firedRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);

    return () => clearTimeout(t);
  }, [setup?.courseLines]);

  return (
    <div>
      {setup ? (
        <div className="sticky top-0 z-20 rounded-2xl border border-zinc-800 bg-[#0f0f12]/95 backdrop-blur p-3 mb-4">
          <div className="flex items-center gap-2">
            <button
              disabled={!canFireNext || controlsLocked}
              onClick={() => {
                if (controlsLocked) return;
                fireNextOrRefire(table.id);
              }}
              className={[
                "flex-1 px-4 py-3 rounded-2xl font-black border text-sm transition",
                canFireNext && !controlsLocked
                  ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400"
                  : "bg-zinc-950 text-zinc-500 border-zinc-800 cursor-not-allowed",
              ].join(" ")}
            >
              {t("FIRE NEXT", "FIRE NEXT")}
            </button>

            <button
              disabled={controlsLocked}
              onClick={() => {
                if (controlsLocked) return;
                setPaused(table.id, !setup.paused);
              }}
              className={[
                "px-4 py-3 rounded-2xl font-black border text-sm transition",
                setup.paused && !controlsLocked
                  ? "bg-red-500 text-black border-red-400 hover:bg-red-400"
                  : controlsLocked
                  ? "bg-zinc-950 text-zinc-600 border-zinc-800 cursor-not-allowed"
                  : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
              ].join(" ")}
            >
              {setup.paused ? t("RESUME", "RESUME") : t("PAUSE", "PAUSE")}
            </button>

            <button
              onClick={() => setShowResNote((v) => !v)}
              className="px-4 py-3 rounded-2xl font-black border text-sm bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
            >
              {t("RES NOTES", "RES NOTES")}
            </button>

            <button
              onClick={() => setShowFohNote((v) => !v)}
              className="px-4 py-3 rounded-2xl font-black border text-sm bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
            >
              {t("FOH NOTE", "FOH NOTE")}
            </button>

            {reservation ? (
              <button
                onClick={() => setShowGuestMap((v) => !v)}
                className="px-4 py-3 rounded-2xl font-black border text-sm bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900"
              >
                {t("GUEST MAPPING", "GUEST MAPPING")}
              </button>
            ) : null}
          </div>

          {!canFireNext ? (
            !setup.approval || setup.approval !== "APPROVED" ? (
              <div className="mt-2 text-xs font-black text-amber-300">
                {t("Waiting kitchen approval", "Waiting kitchen approval")}
              </div>
            ) : setup.paused ? (
              <div className="mt-2 text-xs font-black text-red-300">{t("Table paused", "Table paused")}</div>
            ) : null
          ) : null}
        </div>
      ) : null}

      {showFohNote && setup ? (
        <div className="mb-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black text-white">{t("FOH NOTES", "FOH NOTES")}</div>
            <div className="text-[10px] text-zinc-500">{t("Kitchen cannot see this", "Kitchen cannot see this")}</div>
          </div>

          <textarea
            value={setup.fohNote || ""}
            onChange={(e) => setFohNote(table.id, e.target.value)}
            placeholder={t("Server notes… (VIP mood, pacing requests, birthdays, who pays, etc.)", "Server notes… (VIP mood, pacing requests, birthdays, who pays, etc.)")}
            className="mt-3 w-full min-h-[70px] rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500/80"
          />

          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-black/40 text-xs font-black text-zinc-200">
              <input
                type="checkbox"
                checked={!!setup.wineMenuPassed}
                onChange={() => toggleWineMenuPassed(table.id)}
              />
              {t("Wine menu passed", "Wine menu passed")}
            </label>

            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-black/40 text-xs font-black text-zinc-200">
              <input type="checkbox" checked={!!setup.wineOrdered} onChange={() => toggleWineOrdered(table.id)} />
              {t("Wine ordered", "Wine ordered")}
            </label>
          </div>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="text-white font-black text-2xl">{table.name}</div>
            {table.tableLanguage ? (
              <div className="ml-2 px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-[10px] font-black text-zinc-200">
                {table.tableLanguage}
              </div>
            ) : null}
            <span className={["text-[10px] font-black px-2 py-1 rounded border", statusBadge.className].join(" ")}>
              {statusBadge.label}
            </span>
          </div>
          <div className="text-zinc-400 text-sm mt-1">
            {table.reservationName} • {table.pax} {t("pax", "pax")} • {table.language}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-zinc-200">
              {t("MENU", "MENU")} {menuLabel}
            </span>
            <Badge kind={approval} t={t} />
            {pairing && (
              <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/20 text-indigo-200">
                {t("PAIRING", "PAIRING")}
              </span>
            )}
            {allergy && (
              <span className="text-[10px] font-black px-2 py-1 rounded border border-red-600 bg-red-900/20 text-red-200">
                {t("ALLERGY", "ALLERGY")}
              </span>
            )}
            {setup?.paused && (
              <span className="text-[10px] font-black px-2 py-1 rounded border border-purple-600 bg-purple-900/20 text-purple-200">
                {t("PAUSED", "PAUSED")}
              </span>
            )}
          </div>

          <div className="mt-3 text-sm text-zinc-300">
            {t("On course", "On course")}:{" "}
            <span className="text-white font-black">{onCourse !== null ? `#${onCourse}` : "—"}</span>
          </div>
        </div>
      </div>

      {table.reservationNote ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
          <button
            onClick={() => setShowResNote((v) => !v)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div className="text-xs font-black text-white">{t("RESERVATION NOTES", "RESERVATION NOTES")}</div>
            <div className="text-xs font-black text-amber-300">
              {showResNote ? t("HIDE", "HIDE") : t("SHOW", "SHOW")}
            </div>
          </button>

          {showResNote ? <div className="px-4 pb-4 text-sm text-zinc-200">{table.reservationNote}</div> : null}
        </div>
      ) : null}

      {isAssigned && !isSeated && draftTable ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-black text-zinc-200">{t("DRAFT TICKET PREVIEW (FOH)", "DRAFT TICKET PREVIEW (FOH)")}</div>
            <div className="text-[10px] font-black text-zinc-500">{t("Reservation draft", "Reservation draft")}</div>
          </div>
          <div className="rounded-2xl border border-zinc-800 bg-black/30 p-2">
            <KdsTicket
              table={draftTable}
              mode="PREVIEW"
              labelMode={
                reservation?.draftGuestSeatMap &&
                guests.every((g) => reservation.draftGuestSeatMap?.[g])
                  ? "approval"
                  : "draft"
              }
              guestSubs={reservation?.draftGuestSubs || []}
              guestSeatMap={reservation?.draftGuestSeatMap || undefined}
            />
          </div>
        </div>
      ) : null}

      {isAssigned && !isSeated && reservation ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-xs font-black text-white">{t("GUEST SUBSTITUTIONS", "GUEST SUBSTITUTIONS")}</div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {t("Draft guest notes (pre-seat)", "Draft guest notes (pre-seat)")}
          </div>

          <div className="mt-3 space-y-2">
            {(reservation.draftGuestSubs || []).length === 0 ? (
              <div className="text-xs text-zinc-500">{t("No guest substitutions yet.", "No guest substitutions yet.")}</div>
            ) : (
              (reservation.draftGuestSubs || []).map((s) => (
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
                    onClick={() => draftRemoveGuestSub(reservation.id, s.id)}
                    className="rounded-lg border border-zinc-700 bg-black/40 px-2 py-1 text-xs font-black text-zinc-200"
                  >
                    {t("REMOVE", "REMOVE")}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {showGuestMap && reservation ? (
        <div className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
          <div className="text-xs font-black text-white">{t("GUEST MAPPING", "GUEST MAPPING")}</div>
          <div className="text-[10px] text-zinc-500 mt-1">
            {t("Assign Guest A/B to seats for approval.", "Assign Guest A/B to seats for approval.")}
          </div>

          <div className="mt-3 space-y-2">
            {guests.map((g) => (
              <div key={g} className="rounded-xl border border-zinc-800 bg-black/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm text-zinc-200 font-black">{t("Guest", "Guest")} {g}</div>
                  <div className="text-[10px] text-zinc-500">
                    {reservation.draftGuestSeatMap?.[g]
                      ? `${t("Seat", "Seat")} ${reservation.draftGuestSeatMap?.[g]}`
                      : t("Unassigned", "Unassigned")}
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <select
                    value={reservation.draftGuestSeatMap?.[g] || ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      draftAssignGuestToSeat(reservation.id, g, v ? Number(v) : 0);
                    }}
                    className="rounded-lg bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm w-[130px]"
                  >
                    <option value="">{t("Seat…", "Seat…")}</option>
                    {Array.from({ length: table.pax || 0 }, (_, i) => i + 1).map((seat) => (
                      <option
                        key={seat}
                        value={seat}
                        disabled={
                          takenSeats.has(seat) && reservation.draftGuestSeatMap?.[g] !== seat
                        }
                      >
                        {t("Seat", "Seat")} {seat}
                      </option>
                    ))}
                  </select>

                  <select
                    value={reservation.draftGuestMenuId?.[g] || reservation.draftMenuId || menus[0]?.id}
                    onChange={(e) => draftSetGuestMenu(reservation.id, g, e.target.value)}
                    className="rounded-lg bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm w-[160px]"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 text-xs text-zinc-400">
            {guests
              .map((g) => {
                const seat = reservation.draftGuestSeatMap?.[g];
                return seat ? `${t("Guest", "Guest")} ${g} → ${t("Seat", "Seat")} ${seat}` : null;
              })
              .filter(Boolean)
              .join(" • ") || t("No guest assignments yet.", "No guest assignments yet.")}
          </div>
        </div>
      ) : null}

      {isAssigned ? (
        <div className="mt-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4">
          <div className="text-sm font-black text-white">{t("TABLE ASSIGNED", "TABLE ASSIGNED")}</div>
          <div className="text-xs text-zinc-300 mt-1">
            {t("Notes visible. Service controls locked until seated.", "Notes visible. Service controls locked until seated.")}
          </div>

          <div className="mt-3 flex gap-2">
            <button
              onClick={() => setTableLanguage(table.id, "ING")}
              disabled={isSeated}
              className={[
                "px-4 py-2 rounded-xl text-xs font-black border transition",
                isSeated
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                  : "border-amber-400 bg-amber-500 text-black hover:bg-amber-400",
              ].join(" ")}
            >
              ING
            </button>
            <button
              onClick={() => setTableLanguage(table.id, "CAST")}
              disabled={isSeated}
              className={[
                "px-4 py-2 rounded-xl text-xs font-black border transition",
                isSeated
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                  : "border-amber-400 bg-amber-500 text-black hover:bg-amber-400",
              ].join(" ")}
            >
              CAST
            </button>
            <button
              onClick={() => setTableLanguage(table.id, "CAT")}
              disabled={isSeated}
              className={[
                "px-4 py-2 rounded-xl text-xs font-black border transition",
                isSeated
                  ? "border-zinc-800 bg-zinc-900/40 text-zinc-600 cursor-not-allowed"
                  : "border-amber-400 bg-amber-500 text-black hover:bg-amber-400",
              ].join(" ")}
            >
              CAT
            </button>
            <button
              onClick={() => clearReservationFromTable(table.id)}
              className="px-4 py-2 rounded-xl text-xs font-black border border-zinc-800 bg-black/35 text-zinc-200 hover:bg-zinc-900/40 transition"
            >
              {t("CLEAR ASSIGNMENT", "CLEAR ASSIGNMENT")}
            </button>
          </div>
        </div>
      ) : null}

      {isSeated && setup ? (
        <>
          {/* SETUP */}
          <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
              <div className="text-sm font-black text-white">{t("SETUP", "SETUP")}</div>
              <div className="text-xs text-zinc-500">
                {canEditSetup
                  ? t("Edit before sending", "Edit before sending")
                  : t("Locked after sending", "Locked after sending")}
              </div>
            </div>

            <div className="p-4 space-y-5">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="text-xs font-black text-white">{t("MENU PER SEAT", "MENU PER SEAT")}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  {t("Select a menu for each seat (before approval).", "Select a menu for each seat (before approval).")}
                </div>

                <div className="mt-3 space-y-2">
                  {Array.from({ length: table.pax }, (_, i) => i + 1).map((seat) => (
                    <div key={seat} className="flex items-center justify-between gap-2">
                    <div className="text-sm font-black text-zinc-200">{t("Seat", "Seat")} {seat}</div>
                      <select
                        disabled={!canEditSetup}
                        value={
                          effectiveSetupForRoom?.seatMenuId?.[seat] ||
                          setup.seatMenuId?.[seat] ||
                          menus[0]?.id
                        }
                      onChange={(e) => setSeatMenu(table.id, seat, e.target.value)}
                      className={[
                          "rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-sm outline-none w-[170px]",
                          !canEditSetup ? "opacity-50 cursor-not-allowed" : "focus:border-amber-500/80",
                        ].join(" ")}
                    >
                        {menus.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black text-zinc-300">{t("WINE PAIRING", "WINE PAIRING")}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {t("Shows “PAIRING” on KDS ticket.", "Shows “PAIRING” on KDS ticket.")}
                  </div>
                </div>
                <button
                  disabled={!canEditSetup}
                  onClick={() => setPairing(table.id, !setup.pairing)}
                  className={[
                    "px-4 py-2 rounded-xl font-black border transition",
                    setup.pairing
                      ? "bg-indigo-600 border-indigo-500 text-white hover:bg-indigo-500"
                      : "bg-zinc-950 border-zinc-800 text-zinc-200 hover:bg-zinc-900",
                    !canEditSetup ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  {setup.pairing ? t("PAIRING ON", "PAIRING ON") : t("NO PAIRING", "NO PAIRING")}
                </button>
              </div>

              <div>
                <div className="text-xs font-black text-zinc-300 mb-2">
                  {t(
                    "SEAT NOTES (ALLERGY / PREF) — visible in Approval + KDS",
                    "SEAT NOTES (ALLERGY / PREF) — visible in Approval + KDS"
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: table.pax }).map((_, idx) => {
                    const seat = idx + 1;
                    const val = setup.allergiesBySeat?.[seat] ?? "";
                    return (
                      <div key={seat} className="rounded-xl border border-zinc-800 bg-black p-3">
                        <div className="text-[11px] font-black text-zinc-300 mb-2">{t("Seat", "Seat")} {seat}</div>
                        <input
                          disabled={!canEditSetup}
                          value={val}
                          onChange={(e) => setAllergy(table.id, seat, e.target.value)}
                          placeholder={t("e.g. no shellfish / vegan / preference…", "e.g. no shellfish / vegan / preference…")}
                          className={[
                            "w-full rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500",
                            !canEditSetup ? "opacity-60 cursor-not-allowed" : "",
                          ].join(" ")}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>


          {/* ACTIONS */}
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              disabled={approval !== "NONE"}
              onClick={() => sendForApproval(table.id)}
              className={[
                "rounded-2xl font-black py-3 text-black transition",
                approval === "NONE"
                  ? "bg-green-600 hover:bg-green-500"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
              ].join(" ")}
            >
              {t("SEND TO KITCHEN", "SEND TO KITCHEN")}
            </button>

            <button
              onClick={() => setPaused(table.id, !setup.paused)}
              className={[
                "rounded-2xl font-black py-3 border transition",
                setup.paused
                  ? "bg-purple-600 border-purple-500 text-white hover:bg-purple-500"
                  : "bg-zinc-950 border-zinc-800 text-zinc-200 hover:bg-zinc-900",
              ].join(" ")}
            >
              {setup.paused ? t("RESUME", "RESUME") : t("PAUSE", "PAUSE")}
            </button>

            <button
              disabled={!fireEnabled}
              onClick={() => fireNextOrRefire(table.id)}
              className={[
                "rounded-2xl font-black py-3 text-black transition col-span-2",
                fireEnabled ? "bg-amber-500 hover:bg-amber-400" : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
              ].join(" ")}
            >
              {fireEnabled ? fireLabel : t("FIRE NEXT", "FIRE NEXT")}
              {fireWhy ? <div className="text-xs font-bold mt-1">{fireWhy}</div> : null}
            </button>

            <div className="col-span-2 text-xs text-zinc-500">
              {t("Rule: can’t fire again for 60s. Refire only while paused.", "Rule: can’t fire again for 60s. Refire only while paused.")}
            </div>
          </div>

          {/* COURSE RAIL */}
          <div className="mt-4 space-y-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="text-xs font-black text-white">{t("NOW", "NOW")}</div>
                {nowCourse ? <div className="text-xs text-zinc-500">#{nowCourse.idx}</div> : null}
              </div>

              <div className="p-4">
                {nowCourse ? (
                  <CourseRowFOH
                    course={nowCourse}
                    pax={table.pax}
                    wineLabel={getWineLabelForCourse(nowCourse)}
                    extras={setup.extrasByCourseId?.[nowCourse.id] || []}
                    onEditPairing={
                      pairing
                        ? () => {
                            const current = getWineLabelForCourse(nowCourse) ?? "";
                            const promptLabel = `${t("Wine for course", "Wine for course")} #${nowCourse.idx} (${nowCourse.name})`;
                            const next =
                              prompt(promptLabel, current) ?? "";
                            setWineOverride(table.id, nowCourse.id, next.trim());
                          }
                        : null
                    }
                  />
                ) : (
                  <div className="text-sm text-zinc-500">{t("Nothing fired yet.", "Nothing fired yet.")}</div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <div className="text-xs font-black text-white">{t("NEXT", "NEXT")}</div>
                <div className="text-xs text-zinc-500">
                  {nextCourses.length} {t("items", "items")}
                </div>
              </div>

              <div className="p-4 space-y-2">
                {nextCourses.map((c) => (
                  <div key={c.id} className="rounded-xl border border-zinc-800 bg-black/40 p-3">
                    <CourseRowFOH
                      course={c}
                      pax={table.pax}
                      wineLabel={getWineLabelForCourse(c)}
                      extras={setup.extrasByCourseId?.[c.id] || []}
                      onEditPairing={
                        pairing
                          ? () => {
                              const current = getWineLabelForCourse(c) ?? "";
                              const promptLabel = `${t("Wine for course", "Wine for course")} #${c.idx} (${c.name})`;
                              const next =
                                prompt(promptLabel, current) ?? "";
                              setWineOverride(table.id, c.id, next.trim());
                            }
                          : null
                      }
                    />
                  </div>
                ))}
                {!nextCourses.length ? (
                  <div className="text-sm text-zinc-500">{t("No pending courses.", "No pending courses.")}</div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 overflow-hidden">
              <button
                onClick={() => setShowFullMenu((v) => !v)}
                className="w-full px-4 py-3 border-b border-zinc-800 flex items-center justify-between text-left"
              >
                <div className="text-xs font-black text-white">{t("FULL MENU", "FULL MENU")}</div>
                <div className="text-xs font-black text-amber-300">
                  {showFullMenu ? t("HIDE", "HIDE") : t("SHOW", "SHOW")}
                </div>
              </button>

              {showFullMenu ? (
                <div ref={fullMenuRef} className="max-h-[420px] overflow-y-auto p-4 space-y-2">
                  {lines.map((c) => (
                    <div
                      key={c.id}
                      ref={c.status === "FIRED" ? firedRowRef : undefined}
                      className={[
                        "rounded-xl border p-3",
                        c.status === "FIRED"
                          ? "border-amber-500/60 bg-amber-500/10"
                          : "border-zinc-800 bg-black/30",
                      ].join(" ")}
                    >
                      <CourseRowFOH
                        course={c}
                        pax={table.pax}
                        wineLabel={getWineLabelForCourse(c)}
                        extras={setup.extrasByCourseId?.[c.id] || []}
                        onEditPairing={
                          pairing
                            ? () => {
                                const current = getWineLabelForCourse(c) ?? "";
                                const promptLabel = `${t("Wine for course", "Wine for course")} #${c.idx} (${c.name})`;
                                const next =
                                  prompt(promptLabel, current) ?? "";
                                setWineOverride(table.id, c.id, next.trim());
                              }
                            : null
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RoomCourseRow({
  pax,
  course,
  now,
  pairingName,
  extras,
  onEditPairing,
}: {
  pax: number;
  course: CourseLine;
  now: number;
  pairingName: string | null;
  extras: string[];
  onEditPairing: (() => void) | null;
}) {
  const { t } = useI18n();
  const status = course.status;
  const done = status === "DONE";

  const firedMins =
    status === "FIRED" && course.firedAt ? Math.max(0, Math.floor((now - course.firedAt) / 60000)) : null;

  const refires = course.refireCount ?? 0;

  const { baseCount, subSeatLines } = courseCounts(course, pax);
  const subSeatSet = new Set(
    Object.entries(course.seatSubs || {})
      .filter(([, v]) => (v || "").trim().length > 0)
      .map(([seat]) => Number(seat))
  );

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center justify-between gap-3">
            <div className={["text-white font-black", done ? "line-through text-zinc-500" : ""].join(" ")}>
              {course.idx}. {course.name}{" "}
              {baseCount > 0 ? <span className="text-zinc-400 font-black">{baseCount}x</span> : null}
            </div>

            {pairingName ? (
              onEditPairing ? (
                <button
                  onClick={onEditPairing}
                  className="text-xs font-black text-indigo-200 px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-900/20 hover:bg-indigo-900/35 transition"
                  title={t("Tap to change wine (FOH only)", "Tap to change wine (FOH only)")}
                >
                  {pairingName}
                </button>
              ) : (
                <div className="text-xs font-black text-indigo-200 px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-900/20">
                  {pairingName}
                </div>
              )
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <div className="text-[11px] text-zinc-500 font-black">{t(status, status)}</div>
            {firedMins !== null && <div className="text-[11px] text-orange-300 font-black">• {firedMins}m</div>}
            {refires > 0 && (
              <div className="text-[11px] text-orange-200 font-black">
                • {t("REFIRE", "REFIRE")} x{refires}
              </div>
            )}
          </div>

          {subSeatLines.length > 0 && (
            <div className="mt-2 text-[11px] text-zinc-300 space-y-0.5">
              {subSeatLines.map((s) => (
                <div key={s.key} className={done ? "line-through text-zinc-500" : ""}>
                  {t("Seat", "Seat")} {s.seat} — {s.sub} 1x
                </div>
              ))}
            </div>
          )}

          {extras.length > 0 && (
            <div className="mt-2 text-[11px] text-zinc-200 space-y-0.5">
              {extras.map((x, i) => (
                <div key={`${x}_${i}`} className={done ? "line-through text-zinc-500" : ""}>
                  <span className="font-black">{t("EXTRA", "EXTRA")}:</span> {x}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CourseRowFOH({
  course,
  pax,
  wineLabel,
  extras,
  onEditPairing,
}: {
  course: CourseLine;
  pax: number;
  wineLabel: string | null;
  extras: string[];
  onEditPairing: (() => void) | null;
}) {
  const { t } = useI18n();
  const base = course.name;
  const seatDish = course.seatDish || {};
  const subSeatSet = new Set(
    Object.entries(course.seatSubs || {})
      .filter(([, v]) => (v || "").trim().length > 0)
      .map(([seat]) => Number(seat))
  );
  const entries = Object.entries(seatDish)
    .map(([s, dish]) => ({ seat: Number(s), dish: (dish as string) || "" }))
    .filter((x) => x.dish);
  const diffs = entries.filter((x) => x.dish !== base && !subSeatSet.has(x.seat));

  const { baseCount, subSeatLines } = courseCounts(course, pax);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="text-white font-black">
          <span className="text-zinc-400 font-mono text-xs">#{course.idx}</span>{" "}
          {base}{" "}
          {baseCount > 0 ? <span className="text-zinc-400 font-black">{baseCount}x</span> : null}
        </div>

        <div className="flex items-center gap-2">
          {wineLabel ? (
            onEditPairing ? (
              <button
                onClick={onEditPairing}
                className="text-xs font-black text-indigo-200 px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-900/20 hover:bg-indigo-900/35 transition"
                title={t("Tap to change wine (FOH only)", "Tap to change wine (FOH only)")}
              >
                {wineLabel}
              </button>
            ) : (
              <div className="text-xs font-black text-indigo-200 px-2 py-1 rounded-lg border border-indigo-700 bg-indigo-900/20">
                {wineLabel}
              </div>
            )
          ) : null}

          <div className="text-xs font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-200">
            {t(course.status, course.status)}
          </div>
        </div>
      </div>

      {diffs.length > 0 ? (
        <div className="mt-2 text-xs text-zinc-300 space-y-1">
          {diffs.map((d) => (
            <div key={d.seat}>
              <span className="font-black text-zinc-200">{t("Seat", "Seat")} {d.seat}:</span> {d.dish}
            </div>
          ))}
        </div>
      ) : null}

      {subSeatLines.length > 0 && (
        <div className="mt-2 text-[11px] text-zinc-300 space-y-0.5">
          {subSeatLines.map((s) => (
            <div key={s.key}>
              {t("Seat", "Seat")} {s.seat} — {s.sub} 1x
            </div>
          ))}
        </div>
      )}

      {extras.length > 0 ? (
        <div className="mt-2 text-[11px] text-zinc-200 space-y-0.5">
          {extras.map((x, i) => (
            <div key={`${x}_${i}`}>
              <span className="font-black">{t("EXTRA", "EXTRA")}:</span> {x}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
