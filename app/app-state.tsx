"use client";

import React from "react";

export type TableStatus = "EMPTY" | "SEATED";
export type ApprovalStatus = "NONE" | "PENDING" | "APPROVED";
export type Language = "EN" | "ES" | "FR";
export type MenuType = "A" | "B";

export type SeatNumber = number;

export interface Reservation {
  id: string;
  name: string;
  pax: number;
  time: string;
  notes?: string;
  language: Language;
}

export interface SeatSubstitution {
  seat: SeatNumber;
  dish: string;
}

export interface CourseLine {
  courseId: string;
  baseDish: string;
  subsBySeat: SeatSubstitution[];
}

export interface TableSetup {
  menu: MenuType;
  pairing: boolean;
  allergiesBySeat: Record<number, string>;
  approval: ApprovalStatus;
  courseLines: CourseLine[];
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

// --- MENU DEFINITIONS ---
export const MENU_A = [
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

export const MENU_B = [
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

export const SUB_DISHES = [
  "",
  "No Shellfish Alternative",
  "Gluten-Free Alternative",
  "No Dairy Alternative",
  "Vegetarian Alternative",
  "Chef Surprise (Allergy Safe)",
  "Extra garnish removed",
];

// --- INITIAL DATA ---
export const initialReservations: Reservation[] = [
  { id: "r1", name: "Tanaka", pax: 4, time: "20:00", notes: "Shellfish allergy (Seat 3)", language: "EN" },
  { id: "r2", name: "Jenkins", pax: 2, time: "20:15", notes: "Anniversary", language: "ES" },
  { id: "r3", name: "Roquefort", pax: 6, time: "20:30", notes: "VIP • Quiet table", language: "FR" },
];

export const initialTables: Table[] = [
  { id: 1, name: "T1", pax: 0, status: "EMPTY", x: 80,  y: 80 },
  { id: 2, name: "T2", pax: 0, status: "EMPTY", x: 360, y: 80 },
  { id: 3, name: "T3", pax: 0, status: "EMPTY", x: 640, y: 80 },
  { id: 4, name: "T4", pax: 0, status: "EMPTY", x: 80,  y: 300 },
  { id: 5, name: "T5", pax: 0, status: "EMPTY", x: 360, y: 300 },
];

export function buildCourseLines(menu: MenuType): CourseLine[] {
  const src = menu === "A" ? MENU_A : MENU_B;
  const prefix = menu === "A" ? "a" : "b";
  return src.map((dish, idx) => ({
    courseId: `${prefix}${idx + 1}`,
    baseDish: dish,
    subsBySeat: [],
  }));
}

export function defaultSetup(pax: number): TableSetup {
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

// backfill in case older state exists later
export function normalizeTables(prev: Table[]): Table[] {
  return prev.map((t) => {
    if (!t.setup) return t;
    const menu: MenuType = t.setup.menu ?? "A";
    const hasLines = Array.isArray((t.setup as any).courseLines);
    if (hasLines) return t;
    return { ...t, setup: { ...t.setup, menu, courseLines: buildCourseLines(menu) } };
  });
}

type AppState = {
  reservations: Reservation[];
  tables: Table[];
  setReservations: React.Dispatch<React.SetStateAction<Reservation[]>>;
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
};

const Ctx = React.createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [reservations, setReservations] = React.useState<Reservation[]>(initialReservations);
  const [tables, setTables] = React.useState<Table[]>(() => normalizeTables(initialTables));

  React.useEffect(() => {
    setTables((p) => normalizeTables(p));
  }, []);

  return <Ctx.Provider value={{ reservations, tables, setReservations, setTables }}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = React.useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
