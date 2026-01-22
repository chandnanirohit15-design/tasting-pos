"use client";

import React from "react";

export type Language = "EN" | "ES" | "FR";
export type MenuType = "A" | "B";

export type TableStatus = "EMPTY" | "SEATED";
export type ApprovalStatus = "NONE" | "PENDING" | "APPROVED";

export type CourseStatus = "PENDING" | "FIRED" | "DONE";

export type CourseLine = {
  id: string;
  idx: number; // 1..N
  name: string;
  status: CourseStatus;
  firedAt?: number;

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
  time: string;
  notes?: string;
  language: Language;
}

export interface TableSetup {
  menu: MenuType;
  pairing: boolean;
  paused: boolean;

  // Seat notes (allergy / pref). Shown on Approval + KDS always
  allergiesBySeat: Record<number, string>;

  approval: ApprovalStatus;

  courseLines: CourseLine[];

  // pacing state
  lastFireAt?: number;
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
  reservationId?: string;
  reservationName?: string;
  language?: Language;
  setup?: TableSetup;
}

/** ===== MENU DATA ===== */
const MENU_A: string[] = [
  "Amuse",
  "Oyster",
  "Tomato Water",
  "Scallop",
  "Caviar",
  "Langoustine",
  "Turbot",
  "Pigeon",
  "Pre-dessert",
  "Chocolate",
  "Mignardises",
];

const MENU_B: string[] = [
  "Amuse",
  "Gazpacho",
  "Citrus",
  "Foie Gras",
  "Truffle Pasta",
  "Lobster",
  "Wagyu",
  "Cheese",
  "Pre-dessert",
  "Apple",
  "Mignardises",
];

const COURSE_PRESET_SUBS: string[] = [
  "Vegetarian Alternative",
  "No Shellfish Alternative",
  "No Dairy Alternative",
  "Gluten-Free Alternative",
  "Chef Special Substitute",
];

export function buildCourseLines(menu: MenuType, pax: number): CourseLine[] {
  const base = menu === "A" ? MENU_A : MENU_B;
  return base.map((name, i) => {
    const seatSubs: Record<number, string> = {};
    for (let s = 1; s <= pax; s++) seatSubs[s] = "";
    return {
      id: `c_${menu}_${i + 1}`,
      idx: i + 1,
      name,
      status: "PENDING",
      seatSubs,
      refireCount: 0,
      hasRefired: false,
    };
  });
}

export function defaultSetup(pax: number): TableSetup {
  const allergiesBySeat: Record<number, string> = {};
  for (let i = 1; i <= pax; i++) allergiesBySeat[i] = "";

  return {
    menu: "A",
    pairing: false,
    paused: false,
    allergiesBySeat,
    approval: "NONE",
    courseLines: buildCourseLines("A", pax),
    lastFireAt: undefined,
    lastFiredCourseId: undefined,
    pausedAfterLastFire: false,
  };
}

/** ===== INITIAL DATA ===== */
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

type AppState = {
  reservations: Reservation[];
  tables: Table[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;

  coursePresetSubs: string[];

  // Room controls (Phase 2)
  setMenu: (tableId: number, menu: MenuType) => void;
  setPairing: (tableId: number, pairing: boolean) => void;
  setPaused: (tableId: number, paused: boolean) => void;
  setAllergy: (tableId: number, seat: number, text: string) => void;

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

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [reservations, setReservations] = React.useState<Reservation[]>(initialReservations);
  const [tables, setTables] = React.useState<Table[]>(initialTables);

  const patchSetup = React.useCallback((tableId: number, patch: Partial<TableSetup>) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        return { ...t, setup: { ...current, ...patch } };
      })
    );
  }, []);

  const setMenu = React.useCallback((tableId: number, menu: MenuType) => {
    setTables((prev) =>
      prev.map((t) => {
        if (t.id !== tableId) return t;
        const current = t.setup ?? defaultSetup(t.pax || 0);
        return {
          ...t,
          setup: {
            ...current,
            menu,
            // rebuilding menu resets pacing intentionally
            courseLines: buildCourseLines(menu, t.pax || 0),
            lastFireAt: undefined,
            lastFiredCourseId: undefined,
            pausedAfterLastFire: false,
          },
        };
      })
    );
  }, []);

  const setPairing = React.useCallback(
    (tableId: number, pairing: boolean) => {
      patchSetup(tableId, { pairing });
    },
    [patchSetup]
  );

  const setPaused = React.useCallback(
    (tableId: number, paused: boolean) => {
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
              pausedAfterLastFire,
            },
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

  const sendForApproval = React.useCallback(
    (tableId: number) => {
      patchSetup(tableId, { approval: "PENDING" });
    },
    [patchSetup]
  );

  const approveTable = React.useCallback(
    (tableId: number) => {
      patchSetup(tableId, { approval: "APPROVED" });
    },
    [patchSetup]
  );

  const setSeatSub = React.useCallback(
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
  const fireNextOrRefire = React.useCallback(
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

            const updatedLines = setup.courseLines.map((c) => {
              if (c.id !== id) return c;
              return {
                ...c,
                status: "FIRED",
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
                pausedAfterLastFire: false,
              },
            };
          }

          // --- NORMAL FIRE path (only when NOT paused) ---
          const nextIdx = setup.courseLines.findIndex((c) => c.status === "PENDING");
          if (nextIdx === -1) return t;

          const nextCourse = setup.courseLines[nextIdx];

          const updated = setup.courseLines.map((c, i) =>
            i === nextIdx ? { ...c, status: "FIRED", firedAt: now } : c
          );

          return {
            ...t,
            setup: {
              ...setup,
              courseLines: updated,
              lastFireAt: now,
              lastFiredCourseId: nextCourse.id,
              pausedAfterLastFire: false,
            },
          };
        })
      );
    },
    [setTables]
  );

  const markDone = React.useCallback(
    (tableId: number, courseId: string) => {
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
            },
          };
        })
      );
    },
    [setTables]
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
    coursePresetSubs: COURSE_PRESET_SUBS,

    setMenu,
    setPairing,
    setPaused,
    setAllergy,

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
