"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useRole } from "../../role-store";

const KITCHEN_PIN = "2468"; // Change to your desired PIN

export default function KitchenLoginPage() {
  const router = useRouter();
  const { setRole, setKitchenAuthed } = useRole();
  const [pin, setPin] = React.useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() !== KITCHEN_PIN) {
      alert("Wrong PIN");
      return;
    }
    setRole("KITCHEN");
    setKitchenAuthed(true);
    router.push("/kitchen");
  };

  return (
    <div className="h-full w-full flex items-center justify-center bg-black p-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-950 p-6">
        <div className="text-xl font-black text-white">Kitchen Login</div>
        <div className="text-xs text-zinc-400 mt-1">Enter the kitchen PIN.</div>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            inputMode="numeric"
            placeholder="PIN"
            className="w-full rounded-xl bg-black border border-zinc-800 px-4 py-3 text-white text-lg"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black py-3"
          >
            ENTER
          </button>
        </form>

        <div className="mt-3 text-[10px] text-zinc-500">
          Demo PIN: <span className="font-mono text-zinc-300">{KITCHEN_PIN}</span>
        </div>
      </div>
    </div>
  );
}
