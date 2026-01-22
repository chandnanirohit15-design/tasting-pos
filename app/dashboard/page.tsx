"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useAppState, type Table, type CourseLine } from "../app-state";

type Mode = "PROGRESS" | "MAP";
type Sort = "TABLE" | "COURSE" | "ATTENTION";

function tableNumber(name: string) {
  const n = parseInt((name || "").replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) ? n : 9999;
}

function getLastFired(lines: CourseLine[]) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].status === "FIRED") return lines[i];
  }
  return null;
}

function getNextPending(lines: CourseLine[]) {
  return lines.find((c) => c.status === "PENDING") ?? null;
}

function minutesSince(ts?: number, now?: number) {
  if (!ts || !now) return null;
  return Math.max(0, Math.floor((now - ts) / 60000));
}

function doneCount(lines: CourseLine[]) {
  return lines.filter((c) => c.status === "DONE").length;
}

export default function DashboardPage() {
  const router = useRouter();
  const { tables, hasAllergyFlag, getOnCourse, getFireCooldownSeconds } = useAppState();

  const [mode, setMode] = React.useState<Mode>("PROGRESS");
  const [sort, setSort] = React.useState<Sort>("TABLE");
  const [search, setSearch] = React.useState("");

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seated = React.useMemo(
    () => tables.filter((t) => t.status === "SEATED" && t.setup),
    [tables]
  );

  const stats = React.useMemo(() => {
    const pending = seated.filter((t) => (t.setup?.approval ?? "NONE") === "PENDING").length;
    const approved = seated.filter((t) => (t.setup?.approval ?? "NONE") === "APPROVED").length;
    const paused = seated.filter((t) => !!t.setup?.paused).length;
    const pairing = seated.filter((t) => !!t.setup?.pairing).length;
    const allergy = seated.filter((t) => hasAllergyFlag(t)).length;
    return { seated: seated.length, pending, approved, paused, pairing, allergy };
  }, [seated, hasAllergyFlag]);

  const list = React.useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = seated.filter((t) => {
      if (!q) return true;
      return (
        (t.name || "").toLowerCase().includes(q) ||
        (t.reservationName || "").toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered].sort((a, b) => {
      if (sort === "TABLE") return tableNumber(a.name) - tableNumber(b.name);

      if (sort === "COURSE") {
        const ac = getOnCourse(a) ?? 9999;
        const bc = getOnCourse(b) ?? 9999;
        if (ac !== bc) return ac - bc;
        return tableNumber(a.name) - tableNumber(b.name);
      }

      // ATTENTION: prioritize paused / pending approval / long wait since last fired
      const aLines = a.setup?.courseLines ?? [];
      const bLines = b.setup?.courseLines ?? [];
      const aLast = getLastFired(aLines);
      const bLast = getLastFired(bLines);

      const aPaused = !!a.setup?.paused;
      const bPaused = !!b.setup?.paused;
      if (aPaused !== bPaused) return aPaused ? -1 : 1;

      const aPendingApproval = (a.setup?.approval ?? "NONE") === "PENDING";
      const bPendingApproval = (b.setup?.approval ?? "NONE") === "PENDING";
      if (aPendingApproval !== bPendingApproval) return aPendingApproval ? -1 : 1;

      const aAge = aLast?.firedAt ? now - aLast.firedAt : -1;
      const bAge = bLast?.firedAt ? now - bLast.firedAt : -1;

      const aHas = aAge >= 0;
      const bHas = bAge >= 0;
      if (aHas !== bHas) return aHas ? -1 : 1;
      if (aHas && bHas && aAge !== bAge) return bAge - aAge;

      return tableNumber(a.name) - tableNumber(b.name);
    });

    return sorted;
  }, [seated, search, sort, getOnCourse, now]);

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-black text-white">Dashboard</div>
          <div className="text-sm text-zinc-400 mt-1">
            Phase 3: Progress board + live map for pacing.
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setMode("PROGRESS")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              mode === "PROGRESS"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            PROGRESS
          </button>
          <button
            onClick={() => setMode("MAP")}
            className={[
              "px-4 py-2 rounded-xl text-xs font-black border transition",
              mode === "MAP"
                ? "bg-amber-500 text-black border-amber-400"
                : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
            ].join(" ")}
          >
            MAP
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mt-5 grid grid-cols-6 gap-3">
        <Stat label="SEATED" value={stats.seated} />
        <Stat label="APPROVED" value={stats.approved} />
        <Stat label="PENDING" value={stats.pending} />
        <Stat label="PAUSED" value={stats.paused} />
        <Stat label="PAIRING" value={stats.pairing} />
        <Stat label="ALLERGY" value={stats.allergy} />
      </div>

      {/* Controls */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search table or reservation…"
            className="w-full rounded-xl bg-black border border-zinc-800 text-white px-4 py-3 text-sm outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-2">
          <SortBtn active={sort === "TABLE"} onClick={() => setSort("TABLE")}>
            SORT: TABLE
          </SortBtn>
          <SortBtn active={sort === "COURSE"} onClick={() => setSort("COURSE")}>
            SORT: COURSE
          </SortBtn>
          <SortBtn active={sort === "ATTENTION"} onClick={() => setSort("ATTENTION")}>
            SORT: ATTENTION
          </SortBtn>
        </div>

        <button
          onClick={() => router.push("/room")}
          className="px-4 py-3 rounded-xl text-xs font-black border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
        >
          ROOM
        </button>
        <button
          onClick={() => router.push("/kitchen")}
          className="px-4 py-3 rounded-xl text-xs font-black border border-zinc-800 bg-zinc-950 text-zinc-200 hover:bg-zinc-900"
        >
          KITCHEN
        </button>
      </div>

      {/* Body */}
      {mode === "PROGRESS" ? (
        <div className="mt-6 grid grid-cols-4 gap-4">
          {list.length === 0 ? (
            <div className="col-span-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
              No seated tables.
            </div>
          ) : (
            list.map((t) => <ProgressCard key={t.id} table={t} now={now} />)
          )}
        </div>
      ) : (
        <MapView tables={list} now={now} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
      <div className="text-[11px] font-black tracking-widest text-zinc-400">{label}</div>
      <div className="text-2xl font-black text-white mt-1">{value}</div>
    </div>
  );
}

function SortBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-3 rounded-xl text-xs font-black border transition",
        active
          ? "bg-zinc-800 border-zinc-700 text-white"
          : "bg-zinc-950 border-zinc-800 text-zinc-300 hover:bg-zinc-900",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ProgressCard({ table, now }: { table: Table; now: number }) {
  const setup = table.setup!;
  const lines = setup.courseLines ?? [];

  const lastFired = getLastFired(lines);
  const nextPending = getNextPending(lines);

  const lastAge = minutesSince(lastFired?.firedAt, now);

  const approval = setup.approval ?? "NONE";
  const attention =
    setup.paused ||
    approval === "PENDING" ||
    (lastAge !== null && lastAge >= 12); // heuristic

  return (
    <div
      className={[
        "rounded-2xl border p-4 transition",
        attention ? "border-amber-500/60 bg-amber-900/10" : "border-zinc-800 bg-zinc-900/35",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-white font-black text-lg">{table.name}</div>
          <div className="text-xs text-zinc-400 truncate">
            {table.reservationName || "—"} • {table.pax} pax • {table.language || "—"}
          </div>

          <div className="mt-2 text-sm text-zinc-200">
            On course:{" "}
            <span className="text-white font-black">
              {lastFired?.idx ?? nextPending?.idx ?? "—"}
            </span>
            {nextPending ? <span className="text-zinc-400"> • Next #{nextPending.idx}</span> : null}
          </div>

          <div className="mt-1 text-xs text-zinc-400">
            Last fired:{" "}
            <span className="text-zinc-200 font-black">
              {lastAge !== null ? `${lastAge}m` : "—"}
            </span>
            {lastFired?.name ? <span className="text-zinc-500"> • {lastFired.name}</span> : null}
          </div>

          <div className="mt-2 text-[11px] text-zinc-500">
            Done:{" "}
            <span className="text-zinc-200 font-black">
              {doneCount(lines)}/{lines.length}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-zinc-200">
            MENU {setup.menu}
          </span>

          <ApprovalBadge kind={approval} />

          {setup.pairing && (
            <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/20 text-indigo-200">
              PAIRING
            </span>
          )}

          {Object.values(setup.allergiesBySeat || {}).some((v) => (v || "").trim()) && (
            <span className="text-[10px] font-black px-2 py-1 rounded border border-red-600 bg-red-900/20 text-red-200">
              ALLERGY
            </span>
          )}

          {setup.paused && (
            <span className="text-[10px] font-black px-2 py-1 rounded border border-purple-600 bg-purple-900/20 text-purple-200">
              PAUSED
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function ApprovalBadge({ kind }: { kind: "NONE" | "PENDING" | "APPROVED" }) {
  if (kind === "NONE")
    return (
      <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-zinc-300">
        NOT SENT
      </span>
    );
  if (kind === "PENDING")
    return (
      <span className="text-[10px] font-black px-2 py-1 rounded border border-amber-600 bg-amber-900/25 text-amber-200">
        PENDING
      </span>
    );
  return (
    <span className="text-[10px] font-black px-2 py-1 rounded border border-green-600 bg-green-900/25 text-green-200">
      APPROVED
    </span>
  );
}

function MapView({ tables, now }: { tables: Table[]; now: number }) {
  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-black/40 overflow-hidden">
      <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
        <div className="text-sm font-black text-white">LIVE MAP</div>
        <div className="text-xs text-zinc-500">Uses table.x/table.y</div>
      </div>

      <div className="relative h-[70vh] bg-[#0b0b0d]">
        {tables.map((t) => {
          const setup = t.setup!;
          const lines = setup.courseLines ?? [];
          const last = getLastFired(lines);
          const age = minutesSince(last?.firedAt, now);
          const approval = setup.approval ?? "NONE";

          const attention = setup.paused || approval === "PENDING" || (age !== null && age >= 12);

          return (
            <div
              key={t.id}
              className={[
                "absolute rounded-2xl border p-3 w-[220px] select-none",
                attention ? "border-amber-500/60 bg-amber-900/10" : "border-zinc-800 bg-zinc-950/60",
              ].join(" ")}
              style={{ left: t.x, top: t.y }}
            >
              <div className="flex items-center justify-between">
                <div className="text-white font-black">{t.name}</div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded border border-zinc-700 bg-zinc-900 text-zinc-200">
                  #{last?.idx ?? getNextPending(lines)?.idx ?? "—"}
                </span>
              </div>

              <div className="text-[11px] text-zinc-400 mt-1 truncate">
                {t.reservationName || "—"} • {t.pax} pax
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                {setup.paused && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded border border-purple-600 bg-purple-900/20 text-purple-200">
                    PAUSED
                  </span>
                )}
                {setup.pairing && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded border border-indigo-600 bg-indigo-900/20 text-indigo-200">
                    PAIRING
                  </span>
                )}
                {Object.values(setup.allergiesBySeat || {}).some((v) => (v || "").trim()) && (
                  <span className="text-[10px] font-black px-2 py-0.5 rounded border border-red-600 bg-red-900/20 text-red-200">
                    ALLERGY
                  </span>
                )}
              </div>

              <div className="mt-2 text-[11px] text-zinc-500">
                Last fired: <span className="text-zinc-200 font-black">{age !== null ? `${age}m` : "—"}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
