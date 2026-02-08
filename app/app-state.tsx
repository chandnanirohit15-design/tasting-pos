"use client";

import React from "react";
import { loadSettings } from "./settings/settings-store";
import { createLanClient } from "./lan/lan-client";

export type Language = "EN" | "ES" | "FR";
export type MenuId = string;

export type TableStatus = "EMPTY" | "SEATED";
export type ApprovalStatus = "NONE" | "PENDING" | "APPROVED";

export type CourseStatus = "PENDING" | "FIRED" | "DONE";

export type CourseLine = {
  id: string;
  idx: number; // 1..N
  name: string;
  displayText?: string;
  status: CourseStatus;
  firedAt?: number;
  seatDish?: Record<number, string>;

  // per-seat substitution: seat -> substituted dish name
  seatSubs: Record<number, string>;

  // visible on KDS as "REFIRE xN"
  refireCount?: number;

  // allows exactly one refire (your rule)
  hasRefired?: boolean;
};

export interface Reservation {
  id: string;
  name: string;
  pax: number;
  time?: string;
  phone?: string;
  email?: string;
  channel?: string;
  status?: "BOOKED" | "ARRIVED" | "NO_SHOW" | "CANCELLED";
  tablePref?: string;
  allergies?: string;
  note?: string;
  reservationNote?: string;
  tags?: string[];
  language: Language;
  tableId?: number;
  date?: string;
  service?: "LUNCH" | "DINNER";
  draftStatus?: "NONE" | "DRAFT" | "PREPPED";
  draftSetup?: TableSetup | null;
  draftMenuId?: string;
  draftUpdatedAt?: number;
  draftGuestSubs?: DraftSub[];
  draftGuestSeatMap?: Partial<Record<GuestId, number>>;
  draftGuestMenuMap?: Partial<Record<GuestId, string>>;
  draftGuestMenuId?: Partial<Record<GuestId, string>>;
  sentToApproval?: boolean;
}

export type GuestId = "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H";

export type DraftSub = {
  id: string;
  courseId: string;
  guest: GuestId;
  text: string;
};

export interface TableSetup {
  menuId: MenuId;
  pairing: boolean;
  paused: boolean;

  // Seat notes (allergy / pref). Shown on Approval + KDS always
  allergiesBySeat: Record<number, string>;

  approval: ApprovalStatus;
  approvedAt?: number;

  courseLines: CourseLine[];
  seatMenuId?: Record<number, string>;

  wineOverrideByCourseId?: Record<string, string>;
  fohNote?: string;
  wineMenuPassed?: boolean;
  wineOrdered?: boolean;
  chefNote?: string;
  extrasByCourseId?: Record<string, string[]>;

  // pacing state
  lastFireAt?: number;
  lastFiredAt?: number;
  lastDoneAt?: number;
  pausedAt?: number;
  lastFiredCourseId?: string;

  // refire rule: becomes true only if we PAUSE after firing something
  pausedAfterLastFire?: boolean;
}

export interface Table {
  id: number;
  name: string;
  pax: number;
  status: TableStatus;
  x: number;
  y: number;
  reservationStatus?: "NONE" | "ASSIGNED" | "SEATED";
  reservationId?: string;
  reservationName?: string;
  reservationNote?: string;
  reservationPax?: number;
  reservationTime?: string;
  seatedAt?: number;
  lastActionAt?: number;
  tableLanguage?: string;
  language?: Language;
  setup?: TableSetup;
}

type AppSnapshot = {
  tables: Table[];
  reservations: Reservation[];
};

function makeSnapshot(state: { tables: Table[]; reservations: Reservation[] }): AppSnapshot {
  return { tables: state.tables, reservations: state.reservations };
}

const LAN_MODE_KEY = "tastingpos_lan_mode";
const LAN_HOST_KEY = "tastingpos_lan_host";

export function buildCourseLinesFromSeatMenus(seatMenuId: Record<number, string>, pax: number): CourseLine[] {
  const settings = loadSettings();
  const menusBySeat: Record<number, string[]> = {};
  for (let s = 1; s <= pax; s++) {
    const id = seatMenuId[s];
    const menu = settings.menus.find((m) => m.id === id);
    menusBySeat[s] = menu?.courses || [];
  }

  const maxLen = Math.max(...Object.values(menusBySeat).map((arr) => arr.length), 0);

  const lines: CourseLine[] = [];
  for (let i = 0; i < maxLen; i++) {
    const seatDish: Record<number, string> = {};
    for (let s = 1; s <= pax; s++) {
      seatDish[s] = menusBySeat[s][i] || "";
    }

    const title = seatDish[1] || Object.values(seatDish).find((x) => !!x) || `Course ${i + 1}`;

    const seatSubs: Record<number, string> = {};
    for (let s = 1; s <= pax; s++) seatSubs[s] = "";

    lines.push({
      id: `c_${i + 1}_${Date.now().toString(16)}_${Math.random().toString(36).slice(2)}`,
      idx: i + 1,
      name: title,
      seatDish,
      status: "PENDING",
      seatSubs,
      refireCount: 0,
      hasRefired: false,
    });
  }

  return lines;
}

function reindexCourseLines(lines: CourseLine[]): CourseLine[] {
  return lines.map((c, i) => ({ ...c, idx: i + 1 }));
}

export function guestsForPax(pax: number): GuestId[] {
  const all: GuestId[] = ["A", "B", "C", "D", "E", "F", "G", "H"];
  return all.slice(0, Math.max(1, Math.min(8, pax || 1)));
}

export function defaultSetup(pax: number): TableSetup {
  const allergiesBySeat: Record<number, string> = {};
  for (let i = 1; i <= pax; i++) allergiesBySeat[i] = "";
  const settings = loadSettings();
  const defaultMenuId = settings.menus[0]?.id || "m_a";
  const seatMenuId: Record<number, string> = Object.fromEntries(
    Array.from({ length: pax }, (_, i) => [i + 1, defaultMenuId])
  );

  return {
    menuId: defaultMenuId,
    pairing: false,
    paused: false,
    allergiesBySeat,
    approval: "NONE",
    approvedAt: undefined,
    seatMenuId,
    courseLines: buildCourseLinesFromSeatMenus(seatMenuId, pax),
    wineOverrideByCourseId: {},
    fohNote: "",
    wineMenuPassed: false,
    wineOrdered: false,
    chefNote: "",
    extrasByCourseId: {},
    lastFireAt: undefined,
    lastFiredAt: undefined,
    lastDoneAt: undefined,
    pausedAt: undefined,
    lastFiredCourseId: undefined,
    pausedAfterLastFire: false,
  };
}

export function buildSetupFromMenu(menuId: string, pax: number): TableSetup {
  const allergiesBySeat: Record<number, string> = {};
  for (let i = 1; i <= pax; i++) allergiesBySeat[i] = "";
  const safeMenuId = menuId || loadSettings().menus[0]?.id || "m_a";
  const seatMenuId: Record<number, string> = Object.fromEntries(
    Array.from({ length: pax }, (_, i) => [i + 1, safeMenuId])
  );

  return {
    menuId: safeMenuId,
    pairing: false,
    paused: false,
    allergiesBySeat,
    approval: "NONE",
    approvedAt: undefined,
    seatMenuId,
    courseLines: buildCourseLinesFromSeatMenus(seatMenuId, pax),
    wineOverrideByCourseId: {},
    fohNote: "",
    wineMenuPassed: false,
    wineOrdered: false,
    chefNote: "",
    extrasByCourseId: {},
  };
}

/** ===== INITIAL DATA ===== */
const today = new Date().toISOString().slice(0, 10);
const initialReservations: Reservation[] = [
  {
    id: "r1",
    name: "Tanaka",
    pax: 4,
    time: "20:00",
    note: "Shellfish allergy (Seat 3)",
    reservationNote: "Shellfish allergy (Seat 3)",
    language: "EN",
    date: today,
    service: "DINNER",
    status: "BOOKED",
    channel: "online",
    tags: ["VIP"],
    draftStatus: "NONE",
    draftSetup: null,
    draftMenuId: "m_a",
    draftGuestMenuId: {},
    draftGuestMenuMap: {},
    sentToApproval: false,
  },
  {
    id: "r2",
    name: "Jenkins",
    pax: 2,
    time: "20:15",
    note: "Anniversary",
    reservationNote: "Anniversary",
    language: "ES",
    date: today,
    service: "DINNER",
    status: "BOOKED",
    channel: "phone",
    draftStatus: "NONE",
    draftSetup: null,
    draftMenuId: "m_a",
    draftGuestMenuId: {},
    draftGuestMenuMap: {},
    sentToApproval: false,
  },
  {
    id: "r3",
    name: "Roquefort",
    pax: 6,
    time: "20:30",
    note: "Quiet table",
    reservationNote: "Quiet table",
    language: "FR",
    date: today,
    service: "DINNER",
    status: "BOOKED",
    channel: "covermanager",
    tags: ["VIP"],
    draftStatus: "NONE",
    draftSetup: null,
    draftMenuId: "m_a",
    draftGuestMenuId: {},
    draftGuestMenuMap: {},
    sentToApproval: false,
  },
];

const initialTables: Table[] = [
  { id: 1, name: "T1", pax: 0, status: "EMPTY", x: 80, y: 80 },
  { id: 2, name: "T2", pax: 0, status: "EMPTY", x: 280, y: 80 },
  { id: 3, name: "T3", pax: 0, status: "EMPTY", x: 480, y: 80 },
  { id: 4, name: "T4", pax: 0, status: "EMPTY", x: 80, y: 260 },
  { id: 5, name: "T5", pax: 0, status: "EMPTY", x: 280, y: 260 },
];

type AppState = {
  reservations: Reservation[];
  tables: Table[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  getReservationById: (id: string) => Reservation | null;
  getDraftForReservation: (id: string) => {
    setup?: TableSetup | null;
    subs: DraftSub[];
    map: Partial<Record<GuestId, number>>;
    menuId?: string;
  } | null;

  coursePresetSubs: string[];
  lanStatus?: "DISCONNECTED" | "CONNECTING" | "CONNECTED";
  lanMode?: "OFF" | "HOST" | "CLIENT";

  // Room controls (Phase 2)
  setMenuForTable: (tableId: number, menuId: MenuId) => void;
  setSeatMenu: (tableId: number, seat: number, menuId: string) => void;
  setPairing: (tableId: number, pairing: boolean) => void;
  setPaused: (tableId: number, paused: boolean) => void;
  setAllergy: (tableId: number, seat: number, text: string) => void;
  setWineOverride: (tableId: number, courseId: string, wineName: string) => void;
  setFohNote: (tableId: number, note: string) => void;
  toggleWineMenuPassed: (tableId: number) => void;
  toggleWineOrdered: (tableId: number) => void;
  assignReservationToTable: (reservation: Reservation, tableId: number) => void;
  seatAssignedTable: (tableId: number) => void;
  clearReservationFromTable: (tableId: number) => void;
  updateReservation: (id: string, patch: Partial<Reservation>) => void;
  updateReservationNote: (id: string, note: string) => void;
  addReservation: (r: Reservation) => void;
  deleteReservation: (id: string) => void;
  createDraftForReservation: (resId: string | number) => void;
  markDraftPrepared: (resId: string | number) => void;
  clearDraft: (resId: string | number) => void;
  draftInsertCourse: (
    resId: string | number,
    anchorCourseId: string,
    where: "BEFORE" | "AFTER",
    name: string
  ) => void;
  draftDeleteCourse: (resId: string | number, courseId: string) => void;
  draftMoveCourse: (resId: string | number, courseId: string, dir: -1 | 1) => void;
  draftSetSeatSub: (resId: string | number, courseId: string, seat: number, sub: string) => void;
  draftAddExtraDish: (resId: string | number, courseId: string, dishName: string) => void;
  draftRemoveExtraDish: (resId: string | number, courseId: string, index: number) => void;
  draftSetChefNote: (resId: string | number, note: string) => void;
  draftAddGuestSub: (resId: string | number, courseId: string, guest: GuestId, text: string) => void;
  draftRemoveGuestSub: (resId: string | number, subId: string) => void;
  draftAssignGuestToSeat: (resId: string | number, guest: GuestId, seat: number) => void;
  draftSetGuestMenu: (resId: string | number, guest: GuestId, menuId: string) => void;
  getEffectiveDraftSetupForTable: (reservation: Reservation, pax: number) => TableSetup | null;
  draftEditCourseText: (resId: string | number, courseId: string, text: string) => void;
  draftAddCourse: (resId: string | number, anchorCourseId?: string, text?: string) => void;
  setDraftMenu: (resId: string | number, menuId: string) => void;
  setDraftGuestMenu: (resId: string, guest: GuestId, menuId: string) => void;
  setTableLanguage: (tableId: number, lang: string) => void;
  dishPresets: string[];
  setChefNote: (tableId: number, note: string) => void;
  addExtraDish: (tableId: number, courseId: string, dishName: string) => void;
  removeExtraDish: (tableId: number, courseId: string, index: number) => void;
  insertCourseLine: (
    tableId: number,
    anchorCourseId: string,
    where: "BEFORE" | "AFTER",
    name: string
  ) => void;
  deleteCourseLine: (tableId: number, courseId: string) => void;
  moveCourseLine: (tableId: number, courseId: string, dir: -1 | 1) => void;
  kitchenEditCourseText: (tableId: number, courseId: string, text: string) => void;
  kitchenMoveCourse: (tableId: number, courseId: string, dir: -1 | 1) => void;
  kitchenDeleteCourse: (tableId: number, courseId: string) => void;
  kitchenAddCourse: (tableId: number, anchorCourseId?: string, text?: string) => void;

  sendForApproval: (tableId: number) => void;
  approveTable: (tableId: number) => void;

  setSeatSub: (tableId: number, courseId: string, seat: number, sub: string) => void;

  // SAME button does both:
  // - if paused + eligible refire => refire last fired course
  // - else => fire next pending
  fireNextOrRefire: (tableId: number) => void;

  // kitchen only
  markDone: (tableId: number, courseId: string) => void;

  // UI helpers
  hasAllergyFlag: (t: Table) => boolean;
  getOnCourse: (t: Table) => number | null;
  getFireCooldownSeconds: (t: Table) => number; // 0 when ready
};

const Context = React.createContext<AppState | null>(null);

const FIRE_COOLDOWN_MS = 60_000;

function isInCooldown(lastFireAt?: number) {
  if (!lastFireAt) return false;
  return Date.now() - lastFireAt < FIRE_COOLDOWN_MS;
}

function cloneSetup(setup: TableSetup): TableSetup {
  if (typeof structuredClone === "function") return structuredClone(setup);
  return JSON.parse(JSON.stringify(setup)) as TableSetup;
}

function courseNameFromText(text: string, fallback: string) {
  const first = (text || "").split("\n")[0]?.trim();
  return first && first.length > 0 ? first : fallback;
}

export function applyDraftGuestToSeatSubs(
  setup: TableSetup,
  guestSubs: DraftSub[] = [],
  guestSeatMap: Partial<Record<GuestId, number>> = {}
): TableSetup {
  if (guestSubs.length === 0) return setup;

  const nextLines = setup.courseLines.map((c) => {
    const related = guestSubs.filter((s) => s.courseId === c.id);
    if (related.length === 0) return c;
    const seatSubs = { ...(c.seatSubs || {}) };
    for (const s of related) {
      const seat = guestSeatMap[s.guest];
      if (!seat) continue;
      seatSubs[seat] = s.text;
    }
    return { ...c, seatSubs };
  });

  return { ...setup, courseLines: nextLines };
}

export function applyDraftGuestMenusToSeatMenus(
  setup: TableSetup,
  pax: number,
  guestSeatMap: Partial<Record<GuestId, number>> = {},
  guestMenuId: Partial<Record<GuestId, string>> = {},
  fallbackMenuId: string
): TableSetup {
  const nextSeatMenu: Record<number, string> = { ...(setup.seatMenuId || {}) };

  // Ensure every seat has something
  for (let s = 1; s <= pax; s++) {
    if (!nextSeatMenu[s]) nextSeatMenu[s] = fallbackMenuId;
  }

  // Apply guest menu to mapped seat
  (Object.keys(guestMenuId) as GuestId[]).forEach((g) => {
    const seat = guestSeatMap[g];
    const menu = guestMenuId[g];
    if (!seat || !menu) return;
    nextSeatMenu[seat] = menu;
  });

  const nextLines = buildCourseLinesFromSeatMenus(nextSeatMenu, pax);

  // Preserve existing per-course state if possible (status/refires/subs)
  for (const nl of nextLines) {
    const old = setup.courseLines.find((c) => c.idx === nl.idx);
    if (old) {
      nl.status = old.status;
      nl.refireCount = old.refireCount;
      nl.hasRefired = old.hasRefired;
      nl.seatSubs = old.seatSubs;
      nl.firedAt = old.firedAt;
    }
  }

  return {
    ...setup,
    menuId: nextSeatMenu[1] || fallbackMenuId,
    seatMenuId: nextSeatMenu,
    courseLines: nextLines,
  };
}

export function buildSetupFromReservation(reservation: Reservation): TableSetup {
  const pax = reservation.pax || 0;
  const settings = loadSettings();
  const defaultMenuId = settings.menus[0]?.id || "m_a";

  const baseMenuId = reservation.draftMenuId || defaultMenuId;

  // Guests A/B/C/... for pax
  const guests = guestsForPax(pax);

  // If Room already mapped Guest->Seat, use that.
  // Otherwise, draft preview uses A->Seat1, B->Seat2, etc.
  const guestSeatMap = reservation.draftGuestSeatMap || {};

  // Build inverse: seat -> guest
  const seatToGuest: Record<number, GuestId> = {};
  for (let seat = 1; seat <= pax; seat++) {
    seatToGuest[seat] = guests[seat - 1];
  }
  for (const [g, seat] of Object.entries(guestSeatMap) as Array<[GuestId, number]>) {
    if (seat && seat >= 1 && seat <= pax) seatToGuest[seat] = g;
  }

  // NEW: seatMenuId comes from Guest menus
  const seatMenuId: Record<number, string> = {};
  for (let seat = 1; seat <= pax; seat++) {
    const g = seatToGuest[seat];
    const guestMenu = reservation.draftGuestMenuId?.[g];
    seatMenuId[seat] = guestMenu || baseMenuId || defaultMenuId;
  }

  const allergiesBySeat: Record<number, string> = {};
  for (let i = 1; i <= pax; i++) allergiesBySeat[i] = "";

  const allergyNote = (reservation.allergies || "").trim();

  // Build a setup based on seat menus (this is what makes mixed menus show everywhere)
  const setup: TableSetup = {
    menuId: seatMenuId[1] || baseMenuId || defaultMenuId,
    pairing: false,
    paused: false,
    allergiesBySeat,
    approval: "NONE",
    approvedAt: undefined,
    seatMenuId,
    courseLines: buildCourseLinesFromSeatMenus(seatMenuId, pax),
    wineOverrideByCourseId: {},
    fohNote: allergyNote ? `Allergies: ${allergyNote}` : "",
    wineMenuPassed: false,
    wineOrdered: false,
    chefNote: "",
    extrasByCourseId: {},
  };

  // Apply draft guest substitutions
  return applyDraftGuestToSeatSubs(
    setup,
    reservation.draftGuestSubs || [],
    reservation.draftGuestSeatMap || {}
  );
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [reservations, setReservations] = React.useState<Reservation[]>(initialReservations);
  const [tables, setTables] = React.useState<Table[]>(initialTables);
  const settings = loadSettings();
  const presets = settings.subsPresets;
  const dishPresets = settings.dishPresets;
  const [lanStatus, setLanStatus] = React.useState<"DISCONNECTED" | "CONNECTING" | "CONNECTED">("DISCONNECTED");
  const [lanMode, setLanMode] = React.useState<"OFF" | "HOST" | "CLIENT">("OFF");
  const lanRef = React.useRef<ReturnType<typeof createLanClient> | null>(null);
  const lanModeRef = React.useRef<"OFF" | "HOST" | "CLIENT">("OFF");
  const tablesRef = React.useRef<Table[]>([]);
  const reservationsRef = React.useRef<Reservation[]>([]);
  const snapTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    tablesRef.current = tables;
  }, [tables]);

  React.useEffect(() => {
    reservationsRef.current = reservations;
  }, [reservations]);

  const getTables = React.useCallback(() => tablesRef.current, []);
  const getReservations = React.useCallback(() => reservationsRef.current, []);
  const getReservationById = React.useCallback((id: string) => {
    return reservationsRef.current.find((r) => r.id === id) || null;
  }, []);
  const getDraftForReservation = React.useCallback((id: string) => {
    const r = reservationsRef.current.find((x) => x.id === id);
    if (!r) return null;
    return {
      setup: r.draftSetup,
      subs: r.draftGuestSubs || [],
      map: r.draftGuestSeatMap || {},
      menuId: r.draftMenuId,
    };
  }, []);

  function cloneDeepSetup(setup: TableSetup): TableSetup {
    return JSON.parse(JSON.stringify(setup));
  }

  function applyGuestMenusToSeatDish(
    base: TableSetup,
    pax: number,
    guestSeatMap: Partial<Record<GuestId, number>>,
    guestMenuMap: Partial<Record<GuestId, string>>
  ): TableSetup {
    const out = cloneDeepSetup(base);
    const baseMenuId = out.menuId;

    const guests = guestsForPax(pax);
    const settings = loadSettings();
    const menus = settings.menus || [];

    const menuCache = new Map<string, TableSetup>();
    const getSetupForMenu = (menuId: string) => {
      if (menuCache.has(menuId)) return menuCache.get(menuId)!;
      const s = buildSetupFromMenu(menuId, pax);
      menuCache.set(menuId, s);
      return s;
    };

    for (const g of guests) {
      const seat = guestSeatMap?.[g];
      if (!seat || seat < 1) continue;

      const menuId = guestMenuMap?.[g] || baseMenuId;
      if (!menuId || menuId === baseMenuId) continue;

      // Align by course idx (1..n)
      const other = getSetupForMenu(menuId);

      for (const c of out.courseLines) {
        const match = other.courseLines.find((x) => x.idx === c.idx);
        if (!match) continue;
        if (!c.seatDish) c.seatDish = {};
        c.seatDish[seat] = match.name;
      }
    }

    return out;
  }

  function applyDraftGuestSubsToSeatSubs(
    setup: TableSetup,
    pax: number,
    guestSeatMap: Partial<Record<GuestId, number>>,
    guestSubs: DraftSub[],
    sourceSetup?: TableSetup | null
  ): TableSetup {
    const out = cloneDeepSetup(setup);
    if (!guestSubs || guestSubs.length === 0) return out;
    const idToIdx: Record<string, number> = {};
    if (sourceSetup?.courseLines) {
      sourceSetup.courseLines.forEach((c) => {
        if (c.id) idToIdx[c.id] = c.idx;
      });
    }

    for (const s of guestSubs) {
      const seat = guestSeatMap?.[s.guest];
      if (!seat || seat < 1) continue;

      let course = out.courseLines.find((c) => c.id === s.courseId);
      if (!course && idToIdx[s.courseId]) {
        const idx = idToIdx[s.courseId];
        course = out.courseLines.find((c) => c.idx === idx);
      }
      if (!course) continue;

      if (!course.seatSubs) course.seatSubs = {};
      course.seatSubs[seat] = s.text;
    }

    return out;
  }

  const getEffectiveDraftSetupForTable = React.useCallback(
    (reservation: Reservation, pax: number) => {
      if (!reservation?.draftSetup) return null;

      const base = cloneSetup(reservation.draftSetup as TableSetup) as TableSetup;
      const baseMenuId =
        reservation.draftMenuId || base.menuId || loadSettings().menus[0]?.id || "m_a";
      const guests = guestsForPax(pax);
      const seatToGuest: Record<number, GuestId> = {};
      for (let seat = 1; seat <= pax; seat++) {
        seatToGuest[seat] = guests[seat - 1];
      }
      for (const [g, seat] of Object.entries(reservation.draftGuestSeatMap || {}) as Array<
        [GuestId, number]
      >) {
        if (seat && seat >= 1 && seat <= pax) seatToGuest[seat] = g;
      }
      const seatMenuId: Record<number, string> = {};
      const guestMenuMap = {
        ...(reservation.draftGuestMenuMap || {}),
        ...(reservation.draftGuestMenuId || {}),
      };
      for (let seat = 1; seat <= pax; seat++) {
        const g = seatToGuest[seat];
        seatMenuId[seat] = guestMenuMap[g] || baseMenuId;
      }

      // 1) Apply guest menus (Guest A/B/C/D → menu)
      const withMenus = applyGuestMenusToSeatDish(
        base,
        pax,
        reservation.draftGuestSeatMap || {},
        guestMenuMap
      );

      // 2) Apply guest subs (Guest C "no mariscos" etc) onto seatSubs
      const withSubs = applyDraftGuestSubsToSeatSubs(
        withMenus,
        pax,
        reservation.draftGuestSeatMap || {},
        reservation.draftGuestSubs || [],
        reservation.draftSetup as TableSetup
      );

      return {
        ...withSubs,
        seatMenuId,
        menuId: seatMenuId[1] || withSubs.menuId,
      };
    },
    []
  );

  const replaceFromSnapshot = React.useCallback((snap: AppSnapshot) => {
    setTables(snap.tables || []);
    setReservations(snap.reservations || []);
  }, []);

  const queueHostSnapshotSend = React.useCallback(() => {
    if (lanModeRef.current !== "HOST") return;
    if (!lanRef.current) return;

    if (snapTimerRef.current) clearTimeout(snapTimerRef.current);
    snapTimerRef.current = setTimeout(() => {
      const snap = makeSnapshot({ tables: getTables(), reservations: getReservations() });
      lanRef.current?.send({ type: "SNAPSHOT", payload: snap });
    }, 60);
  }, [getReservations, getTables]);

  React.useEffect(() => {
    queueHostSnapshotSend();
  }, [reservations, queueHostSnapshotSend]);


  const patchSetup = React.useCallback((tableId: number, patch: Partial<TableSetup>) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        return { ...t, setup: { ...current, ...patch } };
      })
    );
  }, []);

  const setMenuForTable = React.useCallback((tableId: number, menuId: MenuId) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        const pax = t.pax || 0;
        const seatMenuId: Record<number, string> = Object.fromEntries(
          Array.from({ length: pax }, (_, i) => [i + 1, menuId])
        );
        return {
          ...t,
          setup: {
            ...current,
            menuId,
            seatMenuId,
            // rebuilding menu resets pacing intentionally
            courseLines: buildCourseLinesFromSeatMenus(seatMenuId, pax),
            lastFireAt: undefined,
            lastFiredCourseId: undefined,
            pausedAfterLastFire: false,
          },
        };
      })
    );
  }, []);

  const setSeatMenuLocal = React.useCallback(
    (tableId: number, seat: number, menuId: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const pax = t.pax || 0;
          const nextSeatMenu = { ...(t.setup.seatMenuId || {}) };
          nextSeatMenu[seat] = menuId;

          const nextLines = buildCourseLinesFromSeatMenus(nextSeatMenu, pax);

          for (const nl of nextLines) {
            const old = t.setup.courseLines.find((c) => c.idx === nl.idx);
            if (old) {
              nl.status = old.status;
              nl.refireCount = old.refireCount;
              nl.hasRefired = old.hasRefired;
              nl.seatSubs = old.seatSubs;
            }
          }

          return {
            ...t,
            setup: {
              ...t.setup,
              menuId: seat === 1 ? menuId : t.setup.menuId,
              seatMenuId: nextSeatMenu,
              courseLines: nextLines,
            },
          };
        })
      );
    },
    [setTables]
  );

  const setPairing = React.useCallback(
    (tableId: number, pairing: boolean) => {
      patchSetup(tableId, { pairing });
    },
    [patchSetup]
  );

  const assignReservationToTableLocal = React.useCallback(
    (reservation: Reservation, tableId: number) => {
      const hasDraft = !!reservation.draftSetup;
      const draftSetup = hasDraft ? cloneSetup(reservation.draftSetup as TableSetup) : null;
      if (draftSetup) {
        draftSetup.approval = "NONE";
        draftSetup.approvedAt = undefined;
      }
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          return {
            ...t,
            reservationStatus: "ASSIGNED",
            reservationId: reservation.id,
            reservationName: reservation.name,
            reservationNote: reservation.reservationNote || reservation.note || "",
            reservationPax: reservation.pax,
            reservationTime: reservation.time,
            setup: draftSetup || t.setup,
          };
        })
      );
    },
    [setTables]
  );

  const seatAssignedTableLocal = React.useCallback(
    (tableId: number) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (t.reservationStatus !== "ASSIGNED") return t;
          const pax = t.reservationPax ?? t.pax ?? 0;
          const res = reservationsRef.current.find((r) => r.id === t.reservationId);
          const draftSetup = res?.draftSetup ? cloneSetup(res.draftSetup as TableSetup) : null;
          if (draftSetup) {
            draftSetup.approval = "NONE";
            draftSetup.approvedAt = undefined;
          }
          return {
            ...t,
            reservationStatus: "SEATED",
            status: "SEATED",
            pax,
            seatedAt: t.seatedAt ?? now,
            lastActionAt: now,
            setup: t.setup ?? draftSetup ?? defaultSetup(pax),
          };
        })
      );
    },
    [setTables]
  );

  const clearReservationFromTableLocal = React.useCallback(
    (tableId: number) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          return {
            ...t,
            reservationStatus: "NONE",
            reservationId: undefined,
            reservationName: undefined,
            reservationNote: undefined,
            reservationPax: undefined,
            reservationTime: undefined,
            status: "EMPTY",
            setup: undefined,
          };
        })
      );
    },
    [setTables]
  );

  const updateReservation = React.useCallback((id: string, patch: Partial<Reservation>) => {
    setReservations((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const updateReservationNote = React.useCallback((id: string, note: string) => {
    setReservations((prev) =>
      prev.map((r) => (r.id === id ? { ...r, reservationNote: note } : r))
    );
  }, []);

  const addReservation = React.useCallback((r: Reservation) => {
    const next: Reservation = {
      ...r,
      draftStatus: r.draftStatus ?? "NONE",
      draftSetup: r.draftSetup ?? null,
      draftMenuId: r.draftMenuId ?? loadSettings().menus[0]?.id ?? "m_a",
      draftGuestSubs: r.draftGuestSubs ?? [],
      draftGuestSeatMap: r.draftGuestSeatMap ?? {},
      draftGuestMenuId: r.draftGuestMenuId ?? {},
      draftGuestMenuMap: r.draftGuestMenuMap ?? {},
      reservationNote: r.reservationNote ?? r.note ?? "",
      sentToApproval: r.sentToApproval ?? false,
    };
    setReservations((prev) => [next, ...prev]);
  }, []);

  const deleteReservation = React.useCallback((id: string) => {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const updateReservationDraft = React.useCallback(
    (resId: string | number, updater: (r: Reservation) => Reservation) => {
      const key = String(resId);
      setReservations((prev) => prev.map((r) => (r.id === key ? updater(r) : r)));
    },
    []
  );

  const createDraftForReservation = React.useCallback(
    (resId: string | number) => {
      updateReservationDraft(resId, (r) => {
        const setup = buildSetupFromReservation(r);
        const menuId = r.draftMenuId || setup.menuId;
        return {
          ...r,
          draftStatus: "DRAFT",
          draftSetup: setup,
          draftMenuId: menuId,
          draftGuestSubs: r.draftGuestSubs ?? [],
          draftGuestSeatMap: r.draftGuestSeatMap ?? {},
          draftGuestMenuId: r.draftGuestMenuId ?? {},
          draftGuestMenuMap: r.draftGuestMenuMap ?? {},
          sentToApproval: r.sentToApproval ?? false,
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const markDraftPrepared = React.useCallback(
    (resId: string | number) => {
      updateReservationDraft(resId, (r) => ({
        ...r,
        draftStatus: "PREPPED",
        draftUpdatedAt: Date.now(),
      }));
    },
    [updateReservationDraft]
  );

  const clearDraft = React.useCallback(
    (resId: string | number) => {
      updateReservationDraft(resId, (r) => ({
        ...r,
        draftStatus: "NONE",
        draftSetup: null,
        draftGuestSubs: [],
        draftGuestSeatMap: {},
        draftGuestMenuId: {},
        draftGuestMenuMap: {},
        sentToApproval: false,
        draftUpdatedAt: Date.now(),
      }));
    },
    [updateReservationDraft]
  );

  const draftInsertCourse = React.useCallback(
    (resId: string | number, anchorCourseId: string, where: "BEFORE" | "AFTER", name: string) => {
      const dish = (name || "").trim();
      if (!dish) return;
      updateReservationDraft(resId, (r) => {
        const setup = (r.draftSetup ?? buildSetupFromReservation(r)) as TableSetup;
        const lines = [...setup.courseLines];
        const idx = lines.findIndex((c) => c.id === anchorCourseId);
        if (idx < 0) return r;

        const inserted: CourseLine = {
          id: `c_ins_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`,
          idx: 0,
          name: dish,
          status: "PENDING",
          seatDish: Object.fromEntries(
            Array.from({ length: r.pax || 0 }, (_, i) => [i + 1, dish])
          ),
          seatSubs: { ...(lines[0]?.seatSubs || {}) },
          refireCount: 0,
          hasRefired: false,
        };

        const insertAt = where === "BEFORE" ? idx : idx + 1;
        lines.splice(insertAt, 0, inserted);

        const nextSetup = { ...setup, courseLines: reindexCourseLines(lines) };
        return {
          ...r,
          draftStatus: r.draftStatus && r.draftStatus !== "NONE" ? r.draftStatus : "DRAFT",
          draftSetup: nextSetup,
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const draftDeleteCourse = React.useCallback(
    (resId: string | number, courseId: string) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const lines = r.draftSetup.courseLines.filter((c) => c.id !== courseId);
        const nextSetup = { ...r.draftSetup, courseLines: reindexCourseLines(lines) };
        return { ...r, draftSetup: nextSetup, draftUpdatedAt: Date.now() };
      });
    },
    [updateReservationDraft]
  );

  const draftMoveCourse = React.useCallback(
    (resId: string | number, courseId: string, dir: -1 | 1) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const lines = [...r.draftSetup.courseLines];
        const i = lines.findIndex((c) => c.id === courseId);
        if (i < 0) return r;
        const j = i + dir;
        if (j < 0 || j >= lines.length) return r;
        [lines[i], lines[j]] = [lines[j], lines[i]];
        const nextSetup = { ...r.draftSetup, courseLines: reindexCourseLines(lines) };
        return { ...r, draftSetup: nextSetup, draftUpdatedAt: Date.now() };
      });
    },
    [updateReservationDraft]
  );

  const draftSetSeatSub = React.useCallback(
    (resId: string | number, courseId: string, seat: number, sub: string) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const current = r.draftSetup;
        return {
          ...r,
          draftSetup: {
            ...current,
            courseLines: current.courseLines.map((c) =>
              c.id !== courseId ? c : { ...c, seatSubs: { ...c.seatSubs, [seat]: sub } }
            ),
          },
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const draftAddExtraDish = React.useCallback(
    (resId: string | number, courseId: string, dishName: string) => {
      const name = (dishName || "").trim();
      if (!name) return;
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const map = { ...(r.draftSetup.extrasByCourseId || {}) };
        const list = [...(map[courseId] || [])];
        list.push(name);
        map[courseId] = list;
        return {
          ...r,
          draftSetup: { ...r.draftSetup, extrasByCourseId: map },
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const draftRemoveExtraDish = React.useCallback(
    (resId: string | number, courseId: string, index: number) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const map = { ...(r.draftSetup.extrasByCourseId || {}) };
        const list = [...(map[courseId] || [])];
        if (index < 0 || index >= list.length) return r;
        list.splice(index, 1);
        map[courseId] = list;
        return {
          ...r,
          draftSetup: { ...r.draftSetup, extrasByCourseId: map },
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const draftSetChefNote = React.useCallback(
    (resId: string | number, note: string) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        return { ...r, draftSetup: { ...r.draftSetup, chefNote: note }, draftUpdatedAt: Date.now() };
      });
    },
    [updateReservationDraft]
  );

  const kitchenEditCourseText = React.useCallback(
    (tableId: number, courseId: string, text: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          const nextLines = t.setup.courseLines.map((c) =>
            c.id !== courseId
              ? c
              : {
                  ...c,
                  displayText: text,
                  name: courseNameFromText(text, c.name || `Course ${c.idx}`),
                }
          );
          return { ...t, setup: { ...t.setup, courseLines: nextLines } };
        })
      );
    },
    [setTables]
  );

  const kitchenMoveCourse = React.useCallback(
    (tableId: number, courseId: string, dir: -1 | 1) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          const lines = [...t.setup.courseLines];
          const i = lines.findIndex((c) => c.id === courseId);
          if (i < 0) return t;
          const j = i + dir;
          if (j < 0 || j >= lines.length) return t;
          [lines[i], lines[j]] = [lines[j], lines[i]];
          return { ...t, setup: { ...t.setup, courseLines: reindexCourseLines(lines) } };
        })
      );
    },
    [setTables]
  );

  const kitchenDeleteCourse = React.useCallback(
    (tableId: number, courseId: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          const lines = t.setup.courseLines.filter((c) => c.id !== courseId);
          return { ...t, setup: { ...t.setup, courseLines: reindexCourseLines(lines) } };
        })
      );
    },
    [setTables]
  );

  const kitchenAddCourse = React.useCallback(
    (tableId: number, anchorCourseId?: string, text?: string) => {
      const clean = (text || "").trim() || "New course";
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          const lines = [...t.setup.courseLines];
          const inserted: CourseLine = {
            id: `c_k_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`,
            idx: 0,
            name: courseNameFromText(clean, "New course"),
            displayText: clean,
            status: "PENDING",
            seatDish: Object.fromEntries(
              Array.from({ length: t.pax || 0 }, (_, i) => [i + 1, courseNameFromText(clean, "New course")])
            ),
            seatSubs: { ...(lines[0]?.seatSubs || {}) },
            refireCount: 0,
            hasRefired: false,
          };
          if (!anchorCourseId) {
            lines.push(inserted);
          } else {
            const idx = lines.findIndex((c) => c.id === anchorCourseId);
            if (idx < 0) lines.push(inserted);
            else lines.splice(idx + 1, 0, inserted);
          }
          return { ...t, setup: { ...t.setup, courseLines: reindexCourseLines(lines) } };
        })
      );
    },
    [setTables]
  );

  const draftAddGuestSub = React.useCallback(
    (resId: string | number, courseId: string, guest: GuestId, text: string) => {
      const clean = (text || "").trim();
      if (!clean) return;
      updateReservationDraft(resId, (r) => {
        const next = { ...r };
        const arr = Array.isArray(next.draftGuestSubs) ? [...next.draftGuestSubs] : [];
        const id =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `dsub_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`;
        arr.push({
          id,
          courseId,
          guest,
          text: clean,
        });
        next.draftGuestSubs = arr;
        next.draftUpdatedAt = Date.now();
        return next;
      });
    },
    [updateReservationDraft]
  );

  const draftRemoveGuestSub = React.useCallback(
    (resId: string | number, subId: string) => {
      updateReservationDraft(resId, (r) => {
        const next = { ...r };
        next.draftGuestSubs = (next.draftGuestSubs || []).filter((s) => s.id !== subId);
        next.draftUpdatedAt = Date.now();
        return next;
      });
    },
    [updateReservationDraft]
  );

  const draftAssignGuestToSeat = React.useCallback(
    (resId: string | number, guest: GuestId, seat: number) => {
      updateReservationDraft(resId, (r) => {
        const next = { ...r };
        const map = { ...(next.draftGuestSeatMap || {}) };
        if (!seat || seat < 1) delete map[guest];
        else map[guest] = seat;
        next.draftGuestSeatMap = map;
        next.draftUpdatedAt = Date.now();
        return next;
      });
    },
    [updateReservationDraft]
  );

  const draftSetGuestMenu = React.useCallback(
    (resId: string | number, guest: GuestId, menuId: string) => {
      updateReservationDraft(resId, (r) => {
        const next = { ...r };
        const map = { ...(next.draftGuestMenuMap || {}) };
        const idMap = { ...(next.draftGuestMenuId || {}) };
        if (!menuId) {
          delete map[guest];
          delete idMap[guest];
        } else {
          map[guest] = menuId;
          idMap[guest] = menuId;
        }
        next.draftGuestMenuMap = map;
        next.draftGuestMenuId = idMap;
        next.draftUpdatedAt = Date.now();
        return next;
      });
    },
    [updateReservationDraft]
  );

  const setDraftGuestMenu = React.useCallback((resId: string, guest: GuestId, menuId: string) => {
    setReservations((prev) =>
      prev.map((r) => {
        if (r.id !== resId) return r;

        const nextDraftGuestMenuId = { ...(r.draftGuestMenuId || {}) };
        nextDraftGuestMenuId[guest] = menuId;

        const next: Reservation = {
          ...r,
          draftGuestMenuId: nextDraftGuestMenuId,
        };

        const nextSetup = buildSetupFromReservation(next);

        return {
          ...next,
          draftSetup: nextSetup,
        };
      })
    );
  }, []);

  const draftEditCourseText = React.useCallback(
    (resId: string | number, courseId: string, text: string) => {
      updateReservationDraft(resId, (r) => {
        if (!r.draftSetup) return r;
        const nextLines = r.draftSetup.courseLines.map((c) =>
          c.id !== courseId
            ? c
            : {
                ...c,
                displayText: text,
                name: courseNameFromText(text, c.name || `Course ${c.idx}`),
              }
        );
        return { ...r, draftSetup: { ...r.draftSetup, courseLines: nextLines }, draftUpdatedAt: Date.now() };
      });
    },
    [updateReservationDraft]
  );

  const draftAddCourse = React.useCallback(
    (resId: string | number, anchorCourseId?: string, text?: string) => {
      const clean = (text || "").trim() || "New course";
      updateReservationDraft(resId, (r) => {
        const setup = (r.draftSetup ?? buildSetupFromReservation(r)) as TableSetup;
        const lines = [...setup.courseLines];
        const baseName = courseNameFromText(clean, "New course");
        const inserted: CourseLine = {
          id: `c_d_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`,
          idx: 0,
          name: baseName,
          displayText: clean,
          status: "PENDING",
          seatDish: Object.fromEntries(
            Array.from({ length: r.pax || 0 }, (_, i) => [i + 1, baseName])
          ),
          seatSubs: { ...(lines[0]?.seatSubs || {}) },
          refireCount: 0,
          hasRefired: false,
        };

        if (!anchorCourseId) {
          lines.push(inserted);
        } else {
          const idx = lines.findIndex((c) => c.id === anchorCourseId);
          if (idx < 0) lines.push(inserted);
          else lines.splice(idx + 1, 0, inserted);
        }

        const nextSetup = { ...setup, courseLines: reindexCourseLines(lines) };
        return {
          ...r,
          draftStatus: r.draftStatus && r.draftStatus !== "NONE" ? r.draftStatus : "DRAFT",
          draftSetup: nextSetup,
          draftUpdatedAt: Date.now(),
        };
      });
    },
    [updateReservationDraft]
  );

  const setDraftMenu = React.useCallback(
    (resId: string | number, menuId: string) => {
      setReservations((prev) =>
        prev.map((r) => {
          if (r.id !== resId) return r;
          const next: Reservation = { ...r, draftMenuId: menuId };
          const nextSetup = buildSetupFromReservation(next);
          return { ...next, draftSetup: nextSetup };
        })
      );
    },
    []
  );

  const setTableLanguage = React.useCallback(
    (tableId: number, lang: string) => {
      const allowed = ["ING", "CAST", "CAT"];
      if (!allowed.includes(lang)) return;
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const res = t.reservationId
            ? reservationsRef.current.find((r) => r.id === t.reservationId)
            : null;
          const pax = t.reservationPax ?? t.pax ?? 0;
          const draftSetup = res?.draftSetup ? cloneSetup(res.draftSetup as TableSetup) : null;
          if (draftSetup) {
            draftSetup.approval = "NONE";
            draftSetup.approvedAt = undefined;
          }
          const nextSetup = t.setup ?? draftSetup ?? defaultSetup(pax);
          const shouldSeat = t.reservationStatus === "ASSIGNED";
          return {
            ...t,
            tableLanguage: lang,
            language: lang as Language,
            reservationStatus: shouldSeat ? "SEATED" : t.reservationStatus,
            status: shouldSeat ? "SEATED" : t.status,
            pax: shouldSeat ? pax : t.pax,
            seatedAt: shouldSeat ? t.seatedAt ?? now : t.seatedAt,
            lastActionAt: now,
            setup: shouldSeat ? nextSetup : t.setup,
          };
        })
      );
    },
    [setTables]
  );

  const setChefNoteLocal = React.useCallback(
    (tableId: number, note: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          return { ...t, setup: { ...t.setup, chefNote: note } };
        })
      );
    },
    [setTables]
  );

  const addExtraDishLocal = React.useCallback(
    (tableId: number, courseId: string, dishName: string) => {
      const name = (dishName || "").trim();
      if (!name) return;

      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const map = { ...(t.setup.extrasByCourseId || {}) };
          const list = [...(map[courseId] || [])];
          list.push(name);
          map[courseId] = list;

          return { ...t, setup: { ...t.setup, extrasByCourseId: map } };
        })
      );
    },
    [setTables]
  );

  const removeExtraDishLocal = React.useCallback(
    (tableId: number, courseId: string, index: number) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const map = { ...(t.setup.extrasByCourseId || {}) };
          const list = [...(map[courseId] || [])];
          if (index < 0 || index >= list.length) return t;
          list.splice(index, 1);
          map[courseId] = list;

          return { ...t, setup: { ...t.setup, extrasByCourseId: map } };
        })
      );
    },
    [setTables]
  );

  const insertCourseLineLocal = React.useCallback(
    (tableId: number, anchorCourseId: string, where: "BEFORE" | "AFTER", name: string) => {
      const dish = (name || "").trim();
      if (!dish) return;

      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const lines = [...t.setup.courseLines];
          const idx = lines.findIndex((c) => c.id === anchorCourseId);
          if (idx < 0) return t;

          const inserted: CourseLine = {
            id: `c_ins_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`,
            idx: 0,
            name: dish,
            status: "PENDING",
            seatDish: Object.fromEntries(
              Array.from({ length: t.pax || 0 }, (_, i) => [i + 1, dish])
            ),
            seatSubs: { ...(lines[0]?.seatSubs || {}) },
            refireCount: 0,
            hasRefired: false,
          };

          const insertAt = where === "BEFORE" ? idx : idx + 1;
          lines.splice(insertAt, 0, inserted);

          const nextSetup = { ...t.setup, courseLines: reindexCourseLines(lines) };
          return { ...t, setup: nextSetup };
        })
      );
    },
    [setTables]
  );

  const deleteCourseLineLocal = React.useCallback(
    (tableId: number, courseId: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const lines = t.setup.courseLines.filter((c) => c.id !== courseId);
          const nextSetup = { ...t.setup, courseLines: reindexCourseLines(lines) };
          return { ...t, setup: nextSetup };
        })
      );
    },
    [setTables]
  );

  const moveCourseLineLocal = React.useCallback(
    (tableId: number, courseId: string, dir: -1 | 1) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;

          const lines = [...t.setup.courseLines];
          const i = lines.findIndex((c) => c.id === courseId);
          if (i < 0) return t;
          const j = i + dir;
          if (j < 0 || j >= lines.length) return t;

          [lines[i], lines[j]] = [lines[j], lines[i]];

          const nextSetup = { ...t.setup, courseLines: reindexCourseLines(lines) };
          return { ...t, setup: nextSetup };
        })
      );
    },
    [setTables]
  );

  const setPausedLocal = React.useCallback(
    (tableId: number, paused: boolean) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const setup = t.setup ?? defaultSetup(t.pax || 0);

          // Only set pausedAfterLastFire when we are ENTERING pause (false -> true)
          // and only if something was fired.
          const enteringPause = !setup.paused && paused;
          const pausedAfterLastFire = enteringPause
            ? !!setup.lastFiredCourseId
            : setup.pausedAfterLastFire ?? false;

          return {
            ...t,
            setup: {
              ...setup,
              paused,
              pausedAt: paused ? now : undefined,
              pausedAfterLastFire,
            },
            lastActionAt: now,
          };
        })
      );
    },
    [setTables]
  );

  const setAllergy = React.useCallback(
    (tableId: number, seat: number, text: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const current = t.setup ?? defaultSetup(t.pax || 0);
          return {
            ...t,
            setup: {
              ...current,
              allergiesBySeat: { ...current.allergiesBySeat, [seat]: text },
            },
          };
        })
      );
    },
    [setTables]
  );

  const sendForApproval = React.useCallback((tableId: number) => {
    const resId = tablesRef.current.find((t) => t.id === tableId)?.reservationId;
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        if (!t.setup) return t;
        const res =
          t.reservationId ? reservationsRef.current.find((r) => r.id === t.reservationId) : null;
        const pax = t.reservationPax ?? t.pax ?? 0;
        let nextSetup = cloneSetup(t.setup ?? defaultSetup(pax));
        if (res) {
          // 1) Apply guest -> seat substitutions
          nextSetup = applyDraftGuestToSeatSubs(
            nextSetup,
            res.draftGuestSubs || [],
            res.draftGuestSeatMap || {}
          );
          // 2) Apply guest -> seat menus (mixed menus)
          const fallbackMenuId =
            res.draftMenuId || nextSetup.menuId || loadSettings().menus[0]?.id || "m_a";
          nextSetup = applyDraftGuestMenusToSeatMenus(
            nextSetup,
            pax,
            res.draftGuestSeatMap || {},
            {
              ...(res.draftGuestMenuMap || {}),
              ...(res.draftGuestMenuId || {}),
            },
            fallbackMenuId
          );
          // 3) Ensure guest subs apply even if course ids were regenerated
          nextSetup = applyDraftGuestSubsToSeatSubs(
            nextSetup,
            pax,
            res.draftGuestSeatMap || {},
            res.draftGuestSubs || [],
            res.draftSetup as TableSetup
          );
          // 4) Carry over draft extras by course idx (ids may change)
          if (res.draftSetup?.extrasByCourseId) {
            const nextExtras: Record<string, string[]> = {};
            const idToIdx: Record<string, number> = {};
            res.draftSetup.courseLines?.forEach((c) => {
              if (c.id) idToIdx[c.id] = c.idx;
            });
            for (const [courseId, extras] of Object.entries(res.draftSetup.extrasByCourseId || {})) {
              const idx = idToIdx[courseId];
              if (!idx) continue;
              const target = nextSetup.courseLines.find((c) => c.idx === idx);
              if (!target) continue;
              nextExtras[target.id] = [...extras];
            }
            nextSetup = { ...nextSetup, extrasByCourseId: nextExtras };
          }
        }
        return { ...t, setup: { ...nextSetup, approval: "PENDING" } };
      })
    );
    if (resId) {
      setReservations((prev) => prev.map((r) => (r.id === resId ? { ...r, sentToApproval: true } : r)));
    }
  }, []);

  const approveTableLocal = React.useCallback(
    (tableId: number) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const setup = t.setup;
          if (!setup) return t;
          return {
            ...t,
            setup: {
              ...setup,
              approval: "APPROVED",
              approvedAt: now,
            },
            lastActionAt: now,
          };
        })
      );
    },
    [setTables]
  );

  const setSeatSubLocal = React.useCallback(
    (tableId: number, courseId: string, seat: number, sub: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const current = t.setup ?? defaultSetup(t.pax || 0);
          return {
            ...t,
            setup: {
              ...current,
              courseLines: current.courseLines.map((c) =>
                c.id !== courseId ? c : { ...c, seatSubs: { ...c.seatSubs, [seat]: sub } }
              ),
            },
          };
        })
      );
    },
    [setTables]
  );

  const setWineOverride = React.useCallback(
    (tableId: number, courseId: string, wineName: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const setup = t.setup;
          if (!setup) return t;

          const next = {
            ...setup,
            wineOverrideByCourseId: {
              ...(setup.wineOverrideByCourseId || {}),
              [courseId]: wineName,
            },
          };

          return { ...t, setup: next };
        })
      );
    },
    [setTables]
  );

  const setFohNote = React.useCallback(
    (tableId: number, note: string) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          return { ...t, setup: { ...t.setup, fohNote: note } };
        })
      );
    },
    [setTables]
  );

  const toggleWineMenuPassed = React.useCallback(
    (tableId: number) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          return { ...t, setup: { ...t.setup, wineMenuPassed: !t.setup.wineMenuPassed } };
        })
      );
    },
    [setTables]
  );

  const toggleWineOrdered = React.useCallback(
    (tableId: number) => {
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          if (!t.setup) return t;
          return { ...t, setup: { ...t.setup, wineOrdered: !t.setup.wineOrdered } };
        })
      );
    },
    [setTables]
  );

  /**
   * SINGLE BUTTON: FIRE NEXT OR REFIRE
   *
   * Rules:
   * - Needs APPROVED
   * - Cooldown 60s applies to BOTH fire & refire
   * - Normal fire happens ONLY when NOT paused
   * - Refire happens ONLY when:
   *    fired course exists + table was paused AFTER that fire (pausedAfterLastFire=true)
   *    and you press the fire button while still paused
   * - Refire only ONCE per course
   */
  const fireNextOrRefireLocal = React.useCallback(
    (tableId: number) => {
      const now = Date.now();

      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const setup = t.setup;
          if (!setup) return t;
          if (setup.approval !== "APPROVED") return t;

          // cooldown gate for everything
          if (isInCooldown(setup.lastFireAt)) return t;

          // --- REFIRE path (only while paused) ---
          if (setup.paused) {
            if (!setup.pausedAfterLastFire) return t;
            if (!setup.lastFiredCourseId) return t;

            const id = setup.lastFiredCourseId;
            const target = setup.courseLines.find((c) => c.id === id);
            if (!target) return t;

            // must be FIRED and not already refired
            if (target.status !== "FIRED") return t;
            if (target.hasRefired) return t;

          const updatedLines: CourseLine[] = setup.courseLines.map((c) => {
            if (c.id !== id) return c;
            return {
              ...c,
              status: "FIRED" as CourseStatus,
              firedAt: now,
              refireCount: (c.refireCount ?? 0) + 1,
              hasRefired: true,
            };
          });

            // after refire: consume the "pausedAfterLastFire" flag (so no second refire)
            return {
              ...t,
              setup: {
                ...setup,
                courseLines: updatedLines,
                lastFireAt: now,
                lastFiredAt: now,
                pausedAfterLastFire: false,
              },
              lastActionAt: now,
            };
          }

          // --- NORMAL FIRE path (only when NOT paused) ---
          const nextIdx = setup.courseLines.findIndex((c) => c.status === "PENDING");
          if (nextIdx === -1) return t;

          const nextCourse = setup.courseLines[nextIdx];

          const updated: CourseLine[] = setup.courseLines.map((c, i) =>
            i === nextIdx ? { ...c, status: "FIRED" as CourseStatus, firedAt: now } : c
          );

          return {
            ...t,
            setup: {
              ...setup,
              courseLines: updated,
              lastFireAt: now,
              lastFiredAt: now,
              lastFiredCourseId: nextCourse.id,
              pausedAfterLastFire: false,
            },
            lastActionAt: now,
          };
        })
      );
    },
    [setTables]
  );

  const markDoneLocal = React.useCallback(
    (tableId: number, courseId: string) => {
      const now = Date.now();
      setTables((prev) =>
        prev.map((t) => {
          if (t.id !== tableId) return t;
          const setup = t.setup;
          if (!setup) return t;

          const target = setup.courseLines.find((c) => c.id === courseId);
          if (!target) return t;

          // enforce kitchen rule: can only mark DONE if currently FIRED
          if (target.status !== "FIRED") return t;

          return {
            ...t,
            setup: {
              ...setup,
              courseLines: setup.courseLines.map((c) => (c.id === courseId ? { ...c, status: "DONE" } : c)),
              lastDoneAt: now,
            },
            lastActionAt: now,
          };
        })
      );
    },
    [setTables]
  );

  const applyLanEvent = React.useCallback(
    (evt: any) => {
      switch (evt.type) {
        case "APPROVE_TABLE":
          approveTableLocal(evt.tableId);
          break;
        case "SET_SEAT_SUB":
          setSeatSubLocal(evt.tableId, evt.courseId, evt.seat, evt.sub);
          break;
        case "FIRE_NEXT":
          fireNextOrRefireLocal(evt.tableId);
          break;
        case "MARK_DONE":
          markDoneLocal(evt.tableId, evt.courseId);
          break;
        case "TOGGLE_PAUSE": {
          const t = tablesRef.current.find((x) => x.id === evt.tableId);
          const nextPaused = t?.setup ? !t.setup.paused : true;
          setPausedLocal(evt.tableId, nextPaused);
          break;
        }
        case "ASSIGN_RES":
          assignReservationToTableLocal(evt.reservation, evt.tableId);
          break;
        case "SEAT_ASSIGNED":
          seatAssignedTableLocal(evt.tableId);
          break;
        case "CLEAR_TABLE":
          clearReservationFromTableLocal(evt.tableId);
          break;
        case "INSERT_COURSE":
          insertCourseLineLocal(evt.tableId, evt.anchorCourseId, evt.where, evt.name);
          break;
        case "MOVE_COURSE":
          moveCourseLineLocal(evt.tableId, evt.courseId, evt.dir);
          break;
        case "DELETE_COURSE":
          deleteCourseLineLocal(evt.tableId, evt.courseId);
          break;
        case "SET_SEAT_MENU":
          setSeatMenuLocal(evt.tableId, evt.seat, evt.menuId);
          break;
        case "SET_CHEF_NOTE":
          setChefNoteLocal(evt.tableId, evt.note);
          break;
        case "ADD_EXTRA_DISH":
          addExtraDishLocal(evt.tableId, evt.courseId, evt.dishName);
          break;
        case "REMOVE_EXTRA_DISH":
          removeExtraDishLocal(evt.tableId, evt.courseId, evt.index);
          break;
        default:
          break;
      }

      queueHostSnapshotSend();
    },
    [
      approveTableLocal,
      assignReservationToTableLocal,
      clearReservationFromTableLocal,
      fireNextOrRefireLocal,
      insertCourseLineLocal,
      markDoneLocal,
      moveCourseLineLocal,
      queueHostSnapshotSend,
      seatAssignedTableLocal,
      setPausedLocal,
      setSeatSubLocal,
      setSeatMenuLocal,
      setChefNoteLocal,
      addExtraDishLocal,
      removeExtraDishLocal,
      deleteCourseLineLocal,
    ]
  );

  React.useEffect(() => {
    let mode: "OFF" | "HOST" | "CLIENT" = "OFF";
    let host = "";
    try {
      mode = (localStorage.getItem(LAN_MODE_KEY) as typeof mode) || "OFF";
      host = localStorage.getItem(LAN_HOST_KEY) || "";
    } catch {}

    lanModeRef.current = mode;
    setLanMode(mode);

    if (mode === "OFF" || !host) return;

    const client = createLanClient(host, {
      onStatus: setLanStatus,
      onSnapshot: (snap: AppSnapshot) => {
        if (lanModeRef.current === "CLIENT") replaceFromSnapshot(snap);
      },
      onEvent: (evt: any) => {
        if (lanModeRef.current === "HOST") applyLanEvent(evt);
      },
    });

    lanRef.current = client;
    client.connect();

    return () => client.disconnect();
  }, [applyLanEvent, replaceFromSnapshot]);

  const approveTable = React.useCallback(
    (tableId: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "APPROVE_TABLE", tableId } });
        return;
      }
      approveTableLocal(tableId);
      queueHostSnapshotSend();
    },
    [approveTableLocal, queueHostSnapshotSend]
  );

  const setSeatSub = React.useCallback(
    (tableId: number, courseId: string, seat: number, sub: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({
          type: "EVENT",
          payload: { type: "SET_SEAT_SUB", tableId, courseId, seat, sub },
        });
        return;
      }
      setSeatSubLocal(tableId, courseId, seat, sub);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, setSeatSubLocal]
  );

  const setSeatMenu = React.useCallback(
    (tableId: number, seat: number, menuId: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({
          type: "EVENT",
          payload: { type: "SET_SEAT_MENU", tableId, seat, menuId },
        });
        return;
      }
      setSeatMenuLocal(tableId, seat, menuId);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, setSeatMenuLocal]
  );

  const setChefNote = React.useCallback(
    (tableId: number, note: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({
          type: "EVENT",
          payload: { type: "SET_CHEF_NOTE", tableId, note },
        });
        return;
      }
      setChefNoteLocal(tableId, note);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, setChefNoteLocal]
  );

  const addExtraDish = React.useCallback(
    (tableId: number, courseId: string, dishName: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({
          type: "EVENT",
          payload: { type: "ADD_EXTRA_DISH", tableId, courseId, dishName },
        });
        return;
      }
      addExtraDishLocal(tableId, courseId, dishName);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, addExtraDishLocal]
  );

  const removeExtraDish = React.useCallback(
    (tableId: number, courseId: string, index: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({
          type: "EVENT",
          payload: { type: "REMOVE_EXTRA_DISH", tableId, courseId, index },
        });
        return;
      }
      removeExtraDishLocal(tableId, courseId, index);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, removeExtraDishLocal]
  );

  const fireNextOrRefire = React.useCallback(
    (tableId: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "FIRE_NEXT", tableId } });
        return;
      }
      fireNextOrRefireLocal(tableId);
      queueHostSnapshotSend();
    },
    [fireNextOrRefireLocal, queueHostSnapshotSend]
  );

  const markDone = React.useCallback(
    (tableId: number, courseId: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "MARK_DONE", tableId, courseId } });
        return;
      }
      markDoneLocal(tableId, courseId);
      queueHostSnapshotSend();
    },
    [markDoneLocal, queueHostSnapshotSend]
  );

  const setPaused = React.useCallback(
    (tableId: number, paused: boolean) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "TOGGLE_PAUSE", tableId, paused } });
        return;
      }
      setPausedLocal(tableId, paused);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, setPausedLocal]
  );

  const assignReservationToTable = React.useCallback(
    (reservation: Reservation, tableId: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "ASSIGN_RES", reservation, tableId } });
        return;
      }
      assignReservationToTableLocal(reservation, tableId);
      queueHostSnapshotSend();
    },
    [assignReservationToTableLocal, queueHostSnapshotSend]
  );

  const seatAssignedTable = React.useCallback(
    (tableId: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "SEAT_ASSIGNED", tableId } });
        return;
      }
      seatAssignedTableLocal(tableId);
      queueHostSnapshotSend();
    },
    [queueHostSnapshotSend, seatAssignedTableLocal]
  );

  const clearReservationFromTable = React.useCallback(
    (tableId: number) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "CLEAR_TABLE", tableId } });
        return;
      }
      clearReservationFromTableLocal(tableId);
      queueHostSnapshotSend();
    },
    [clearReservationFromTableLocal, queueHostSnapshotSend]
  );

  const insertCourseLine = React.useCallback(
    (tableId: number, anchorCourseId: string, where: "BEFORE" | "AFTER", name: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "INSERT_COURSE", tableId, anchorCourseId, where, name } });
        return;
      }
      insertCourseLineLocal(tableId, anchorCourseId, where, name);
      queueHostSnapshotSend();
    },
    [insertCourseLineLocal, queueHostSnapshotSend]
  );

  const moveCourseLine = React.useCallback(
    (tableId: number, courseId: string, dir: -1 | 1) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "MOVE_COURSE", tableId, courseId, dir } });
        return;
      }
      moveCourseLineLocal(tableId, courseId, dir);
      queueHostSnapshotSend();
    },
    [moveCourseLineLocal, queueHostSnapshotSend]
  );

  const deleteCourseLine = React.useCallback(
    (tableId: number, courseId: string) => {
      if (lanModeRef.current === "CLIENT") {
        lanRef.current?.send({ type: "EVENT", payload: { type: "DELETE_COURSE", tableId, courseId } });
        return;
      }
      deleteCourseLineLocal(tableId, courseId);
      queueHostSnapshotSend();
    },
    [deleteCourseLineLocal, queueHostSnapshotSend]
  );

  // ===== UI helpers =====
  const hasAllergyFlag = React.useCallback((t: Table) => {
    const notes = t.setup?.allergiesBySeat;
    if (!notes) return false;
    return Object.values(notes).some((v) => (v || "").trim().length > 0);
  }, []);

  const getOnCourse = React.useCallback((t: Table) => {
    const lines = t.setup?.courseLines;
    if (!lines || lines.length === 0) return null;

    // If something is FIRED, that's the "on course"
    const lastFired = [...lines].reverse().find((c) => c.status === "FIRED");
    if (lastFired) return lastFired.idx;

    // else the next pending
    const nextPending = lines.find((c) => c.status === "PENDING");
    return nextPending ? nextPending.idx : null;
  }, []);

  const getFireCooldownSeconds = React.useCallback((t: Table) => {
    const last = t.setup?.lastFireAt;
    if (!last) return 0;
    const diff = Date.now() - last;
    const remain = Math.ceil((FIRE_COOLDOWN_MS - diff) / 1000);
    return remain > 0 ? remain : 0;
  }, []);

  const value: AppState = {
    reservations,
    tables,
    setReservations,
    setTables,
    getReservationById,
    getDraftForReservation,
    getEffectiveDraftSetupForTable,
    coursePresetSubs: presets,
    lanStatus,
    lanMode,

    setMenuForTable,
    setPairing,
    setPaused,
    setAllergy,
    setWineOverride,
    setFohNote,
    toggleWineMenuPassed,
    toggleWineOrdered,
    assignReservationToTable,
    seatAssignedTable,
    clearReservationFromTable,
    updateReservation,
    updateReservationNote,
    addReservation,
    deleteReservation,
    createDraftForReservation,
    markDraftPrepared,
    clearDraft,
    draftInsertCourse,
    draftDeleteCourse,
    draftMoveCourse,
    draftSetSeatSub,
    draftAddExtraDish,
    draftRemoveExtraDish,
    draftSetChefNote,
    draftAddGuestSub,
    draftRemoveGuestSub,
    draftAssignGuestToSeat,
    draftSetGuestMenu,
    draftEditCourseText,
    draftAddCourse,
    setDraftMenu,
    setDraftGuestMenu,
    setTableLanguage,
    setSeatMenu,
    dishPresets,
    setChefNote,
    addExtraDish,
    removeExtraDish,
    insertCourseLine,
    deleteCourseLine,
    moveCourseLine,
    kitchenEditCourseText,
    kitchenMoveCourse,
    kitchenDeleteCourse,
    kitchenAddCourse,

    sendForApproval,
    approveTable,

    setSeatSub,

    fireNextOrRefire,
    markDone,

    hasAllergyFlag,
    getOnCourse,
    getFireCooldownSeconds,
  };

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppState() {
  const ctx = React.useContext(Context);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}

export type TableAlert =
  | "NEEDS_APPROVAL"
  | "PAUSED_TOO_LONG"
  | "SEATED_TOO_LONG_NO_FIRE"
  | "FIRED_TOO_LONG_NO_DONE"
  | "STUCK";

export function getTableAlerts(table: Table, now: number): TableAlert[] {
  const alerts: TableAlert[] = [];
  const setup = table.setup;

  if (table.reservationStatus === "SEATED") {
    const seatedFor = table.seatedAt ? now - table.seatedAt : 0;

    if (setup && setup.approval !== "APPROVED") alerts.push("NEEDS_APPROVAL");

    if (setup?.paused && setup.pausedAt && now - setup.pausedAt > 10 * 60 * 1000) {
      alerts.push("PAUSED_TOO_LONG");
    }

    if (!setup?.lastFiredAt && seatedFor > 15 * 60 * 1000) {
      alerts.push("SEATED_TOO_LONG_NO_FIRE");
    }

    if (
      setup?.lastFiredAt &&
      (!setup?.lastDoneAt || setup.lastDoneAt < setup.lastFiredAt) &&
      now - setup.lastFiredAt > 12 * 60 * 1000
    ) {
      alerts.push("FIRED_TOO_LONG_NO_DONE");
    }
  }

  return alerts;
}

export function attentionScore(table: Table, now: number): number {
  const alerts = getTableAlerts(table, now);
  let score = 0;

  for (const x of alerts) {
    if (x === "NEEDS_APPROVAL") score += 80;
    if (x === "PAUSED_TOO_LONG") score += 70;
    if (x === "SEATED_TOO_LONG_NO_FIRE") score += 60;
    if (x === "FIRED_TOO_LONG_NO_DONE") score += 55;
  }

  if (table.seatedAt) score += Math.min(40, Math.floor((now - table.seatedAt) / (5 * 60 * 1000)));

  return score;
}
