"use client";

import React from "react";

export type Role = "SERVER" | "KITCHEN";

type RoleStore = {
  role: Role;
  setRole: (r: Role) => void;
};

const RoleContext = React.createContext<RoleStore | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = React.useState<Role>("SERVER");

  return (
    <RoleContext.Provider value={{ role, setRole }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used inside RoleProvider");
  return ctx;
}
