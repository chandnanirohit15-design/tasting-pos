"use client";

export type MenuId = string;

export type Wine = {
  id: string;
  name: string;
  type?: string; // red/white/sparkling/etc (optional UI)
};

export type PairingRule = {
  id: string;
  menuId: string;
  wineId: string;
  // Apply to course indices (1..N)
  fromIdx: number;
  toIdx: number;
  note?: string; // optional "slow down here"
};

export type SettingsData = {
  version: number;
  menus: Array<{ id: string; label: string; courses: string[] }>;
  tableLanguages: string[];
  dishPresets: string[];
  subsPresets: string[];
  wines: Wine[];
  pairing: PairingRule[];
};

const KEY = "tastingpos_settings_v1";

const DEFAULTS: SettingsData = {
  version: 1,
  menus: [
    {
      id: "m_a",
      label: "Classic",
      courses: [
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
      ],
    },
    {
      id: "m_b",
      label: "Seasonal",
      courses: [
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
      ],
    },
  ],
  tableLanguages: ["ING", "CAST", "CAT"],
  dishPresets: [
    "Vegetarian extra",
    "Fish alternative",
    "No dairy alternative",
    "Gluten-free bread",
    "Extra sauce",
    "Extra garnish",
    "Chef snack",
  ],
  subsPresets: [
    "Vegetarian Alternative",
    "No Shellfish Alternative",
    "No Dairy Alternative",
    "Gluten-Free Alternative",
    "Chef Special Substitute",
  ],
  wines: [
    { id: "w1", name: "House Sparkling" },
    { id: "w2", name: "White Pairing 1" },
    { id: "w3", name: "Red Pairing 1" },
  ],
  pairing: [
    // example: 1 wine for courses 1-2
    { id: "p1", menuId: "m_a", wineId: "w1", fromIdx: 1, toIdx: 2 },
  ],
};

export function uid(prefix = "id") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(16)}`;
}

export function loadSettings(): SettingsData {
  if (typeof window === "undefined") return DEFAULTS;
  const raw = localStorage.getItem(KEY);
  if (!raw) return DEFAULTS;
  try {
    const parsed = JSON.parse(raw) as SettingsData;
    if (!parsed || typeof parsed !== "object") return DEFAULTS;
    const menus = Array.isArray((parsed as any).menus) ? parsed.menus : DEFAULTS.menus;
    const pairing = Array.isArray((parsed as any).pairing)
      ? parsed.pairing
          .map((r: any) => {
            if (r.menuId) return r;
            if (r.menu === "A") return { ...r, menuId: "m_a" };
            if (r.menu === "B") return { ...r, menuId: "m_b" };
            return null;
          })
          .filter(Boolean)
      : DEFAULTS.pairing;
    return {
      ...DEFAULTS,
      ...parsed,
      menus,
      tableLanguages: parsed.tableLanguages ?? DEFAULTS.tableLanguages,
      dishPresets: parsed.dishPresets ?? DEFAULTS.dishPresets,
      subsPresets: parsed.subsPresets ?? DEFAULTS.subsPresets,
      wines: parsed.wines ?? DEFAULTS.wines,
      pairing,
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(next: SettingsData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(next));
}

// Convenience: pairing wine labels for a menu course
export function getMenuById(menuId: string) {
  const s = loadSettings();
  return s.menus.find((m) => m.id === menuId) || null;
}

export function getPairingWineForCourse(menuId: string, idx: number): { wineName: string; ruleId: string } | null {
  const s = loadSettings();
  const rule = s.pairing.find((r) => r.menuId === menuId && idx >= r.fromIdx && idx <= r.toIdx);
  if (!rule) return null;
  const wine = s.wines.find((w) => w.id === rule.wineId);
  if (!wine) return null;
  return { wineName: wine.name, ruleId: rule.id };
}
