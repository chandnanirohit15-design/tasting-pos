"use client";

import React from "react";

export type Role = "ROOM" | "KITCHEN";

type RoleCtx = {
  role: Role;
  setRole: (r: Role) => void;
  kitchenAuthed: boolean;
  setKitchenAuthed: (v: boolean) => void;
};

const RoleContext = React.createContext<RoleCtx | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<Role>("ROOM");
  const [kitchenAuthed, setKitchenAuthed] = React.useState(false);

  return (
    <RoleContext.Provider value={{ role, setRole, kitchenAuthed, setKitchenAuthed }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
