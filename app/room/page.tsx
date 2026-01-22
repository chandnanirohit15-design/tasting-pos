"use client";

import React from "react";
import { useAppState, type Table, type CourseLine, type MenuType } from "../app-state";

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
    text: `S${x.seat} ${x.sub} 1x`,
  }));

  return { baseCount, subSeatLines };
}

export default function RoomPage() {
  const { tables, hasAllergyFlag, getOnCourse } = useAppState();
  const [activeId, setActiveId] = React.useState<number | null>(null);

  const active = React.useMemo(() => tables.find((t) => t.id === activeId) || null, [tables, activeId]);

  const seatedCount = tables.filter((t) => t.status === "SEATED").length;

  return (
    <div className="h-full w-full bg-[#0f0f12] flex">
      {/* LEFT */}
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-2xl font-black text-white">Room</div>
            <div className="text-zinc-400 text-sm mt-1">
              Set menu + pairing + seat notes → send to kitchen → pause/fire/refire.
            </div>
          </div>
          <div className="text-xs text-zinc-500">
            Seated: <span className="text-white font-black">{seatedCount}</span>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-6">
          {tables.map((t) => {
            const seated = t.status === "SEATED";
            const approval = t.setup?.approval ?? "NONE";
            const isActive = t.id === activeId;

            const pairing = !!t.setup?.pairing;
            const paused = !!t.setup?.paused;
            const allergy = hasAllergyFlag(t);
            const onCourse = seated ? getOnCourse(t) : null;

            return (
              <button
                key={t.id}
                onClick={() => setActiveId(t.id)}
                disabled={!seated}
                className={[
                  "rounded-2xl border-2 p-4 text-left transition select-none min-h-[185px]",
                  seated
                    ? "bg-zinc-900/60 border-zinc-700 hover:border-amber-500/60"
                    : "bg-zinc-950 border-zinc-900",
                  isActive ? "border-amber-500" : "",
                  !seated ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                ].join(" ")}
              >
                <div className="flex items-center justify-between">
                  <div className="text-white font-black">{t.name}</div>
                  {seated && t.language && (
                    <span className="text-[10px] px-2 py-0.5 rounded border border-blue-700 bg-blue-900 text-blue-100 font-black">
                      {t.language}
                    </span>
                  )}
                </div>

                {seated ? (
                  <>
                    <div className="mt-1 text-xs text-zinc-300">
                      <span className="font-black">{t.reservationName}</span>
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5">{t.pax} pax</div>

                    <div className="mt-3 flex gap-2 flex-wrap">
                      <Badge kind={approval} />
                      {t.setup?.menu && (
                        <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-700 bg-zinc-950 text-zinc-200">
                          MENU {t.setup.menu}
                        </span>
                      )}
                      {pairing && (
                        <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/20 text-indigo-200">
                          PAIRING
                        </span>
                      )}
                      {allergy && (
                        <span className="text-[10px] font-black px-2 py-1 rounded border border-red-600 bg-red-900/20 text-red-200">
                          ALLERGY
                        </span>
                      )}
                      {paused && (
                        <span className="text-[10px] font-black px-2 py-1 rounded border border-purple-600 bg-purple-900/20 text-purple-200">
                          PAUSED
                        </span>
                      )}
                    </div>

                    <div className="mt-3 text-xs text-zinc-400">
                      On course: <span className="text-white font-black">{onCourse !== null ? `#${onCourse}` : "—"}</span>
                    </div>

                    <CoursePreview t={t} />
                  </>
                ) : (
                  <div className="text-sm text-zinc-600 mt-12 text-center">EMPTY</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* RIGHT */}
      <aside className="w-[520px] border-l border-zinc-800 bg-black p-6 overflow-y-auto">
        {!active || active.status !== "SEATED" || !active.setup ? (
          <div className="text-zinc-500">
            <div className="text-white font-black text-lg">Room Control</div>
            <div className="mt-2">Select a seated table to manage it.</div>
          </div>
        ) : (
          <RoomControl table={active} />
        )}
      </aside>
    </div>
  );
}

function Badge({ kind }: { kind: "NONE" | "PENDING" | "APPROVED" }) {
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

function CoursePreview({ t }: { t: Table }) {
  const lines = t.setup?.courseLines ?? [];
  const preview = lines.slice(0, 3);
  return (
    <div className="mt-3 text-[10px] text-zinc-400 space-y-1">
      {preview.map((c) => (
        <div key={c.id} className="truncate">
          {c.idx}. {c.name}
        </div>
      ))}
      {lines.length > 3 && <div className="text-zinc-600">+ {lines.length - 3} more…</div>}
    </div>
  );
}

function RoomControl({ table }: { table: Table }) {
  const {
    sendForApproval,
    setPaused,
    fireNextOrRefire,
    hasAllergyFlag,
    getOnCourse,
    setMenu,
    setPairing,
    setAllergy,
    getFireCooldownSeconds,
  } = useAppState();

  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const setup = table.setup!;
  const approval = setup.approval;

  const nextPending = setup.courseLines.find((c) => c.status === "PENDING");
  const pairing = !!setup.pairing;
  const allergy = hasAllergyFlag(table);
  const onCourse = getOnCourse(table);

  const canEditSetup = approval === "NONE";

  const cooldownSec = getFireCooldownSeconds(table);
  const coolingDown = cooldownSec > 0;

  const canRefireWhilePaused =
    approval === "APPROVED" &&
    setup.paused &&
    !!setup.pausedAfterLastFire &&
    !!setup.lastFiredCourseId &&
    !coolingDown;

  const canFireNext = approval === "APPROVED" && !setup.paused && !!nextPending && !coolingDown;

  const fireEnabled = canFireNext || canRefireWhilePaused;

  const fireLabel = coolingDown ? `WAIT ${cooldownSec}s` : canRefireWhilePaused ? "REFIRE LAST FIRED" : "FIRE NEXT COURSE";

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-white font-black text-2xl">{table.name}</div>
          <div className="text-zinc-400 text-sm mt-1">
            {table.reservationName} • {table.pax} pax • {table.language}
          </div>

          <div className="mt-3 flex flex-wrap gap-2 items-center">
            <span className="text-[10px] font-black px-2 py-1 rounded border border-zinc-800 bg-zinc-950 text-zinc-200">
              MENU {setup.menu}
            </span>
            <Badge kind={approval} />
            {pairing && (
              <span className="text-[10px] font-black px-2 py-1 rounded border border-indigo-600 bg-indigo-900/20 text-indigo-200">
                PAIRING
              </span>
            )}
            {allergy && (
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

          <div className="mt-3 text-sm text-zinc-300">
            On course: <span className="text-white font-black">{onCourse !== null ? `#${onCourse}` : "—"}</span>
          </div>
        </div>
      </div>

      {/* SETUP */}
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">SETUP</div>
          <div className="text-xs text-zinc-500">{canEditSetup ? "Edit before sending" : "Locked after sending"}</div>
        </div>

        <div className="p-4 space-y-5">
          <div>
            <div className="text-xs font-black text-zinc-300 mb-2">MENU</div>
            <div className="flex gap-2">
              {(["A", "B"] as MenuType[]).map((m) => (
                <button
                  key={m}
                  disabled={!canEditSetup}
                  onClick={() => setMenu(table.id, m)}
                  className={[
                    "px-4 py-2 rounded-xl font-black border transition",
                    setup.menu === m
                      ? "bg-amber-500 text-black border-amber-400"
                      : "bg-zinc-950 border-zinc-800 text-zinc-200 hover:bg-zinc-900",
                    !canEditSetup ? "opacity-50 cursor-not-allowed" : "",
                  ].join(" ")}
                >
                  MENU {m}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-black text-zinc-300">WINE PAIRING</div>
              <div className="text-xs text-zinc-500 mt-1">Shows “PAIRING” on KDS ticket.</div>
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
              {setup.pairing ? "PAIRING ON" : "NO PAIRING"}
            </button>
          </div>

          <div>
            <div className="text-xs font-black text-zinc-300 mb-2">
              SEAT NOTES (ALLERGY / PREF) — visible in Approval + KDS
            </div>

            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: table.pax }).map((_, idx) => {
                const seat = idx + 1;
                const val = setup.allergiesBySeat?.[seat] ?? "";
                return (
                  <div key={seat} className="rounded-xl border border-zinc-800 bg-black p-3">
                    <div className="text-[11px] font-black text-zinc-300 mb-2">Seat {seat}</div>
                    <input
                      disabled={!canEditSetup}
                      value={val}
                      onChange={(e) => setAllergy(table.id, seat, e.target.value)}
                      placeholder="e.g. no shellfish / vegan / preference…"
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
            approval === "NONE" ? "bg-green-600 hover:bg-green-500" : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
          ].join(" ")}
        >
          SEND TO KITCHEN
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
          {setup.paused ? "RESUME" : "PAUSE"}
        </button>

        <button
          disabled={!fireEnabled}
          onClick={() => fireNextOrRefire(table.id)}
          className={[
            "rounded-2xl font-black py-3 text-black transition col-span-2",
            fireEnabled ? "bg-amber-500 hover:bg-amber-400" : "bg-zinc-800 text-zinc-500 cursor-not-allowed",
          ].join(" ")}
        >
          {fireLabel}
        </button>

        <div className="col-span-2 text-xs text-zinc-500">Rule: can’t fire again for 60s. Refire only while paused.</div>
      </div>

      {/* COURSE RAIL */}
      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">COURSE RAIL</div>
          <div className="text-xs text-zinc-500">Room cannot mark DONE (kitchen only).</div>
        </div>

        <div className="divide-y divide-zinc-800 max-h-[60vh] overflow-y-auto">
          {setup.courseLines.map((c) => (
            <RoomCourseRow key={c.id} pax={table.pax} course={c} now={now} />
          ))}
        </div>
      </div>
    </div>
  );
}

function RoomCourseRow({ pax, course, now }: { pax: number; course: CourseLine; now: number }) {
  const status = course.status;
  const done = status === "DONE";

  const firedMins =
    status === "FIRED" && course.firedAt ? Math.max(0, Math.floor((now - course.firedAt) / 60000)) : null;

  const refires = course.refireCount ?? 0;

  const { baseCount, subSeatLines } = courseCounts(course, pax);

  return (
    <div className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={["text-white font-black", done ? "line-through text-zinc-500" : ""].join(" ")}>
            {course.idx}. {course.name} {baseCount > 0 ? `${baseCount}x` : ""}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <div className="text-[11px] text-zinc-500 font-black">{status}</div>
            {firedMins !== null && <div className="text-[11px] text-orange-300 font-black">• {firedMins}m</div>}
            {refires > 0 && <div className="text-[11px] text-orange-200 font-black">• REFIRE x{refires}</div>}
          </div>

          {subSeatLines.length > 0 && (
            <div className="mt-2 text-[11px] text-zinc-300 space-y-0.5">
              {subSeatLines.map((s) => (
                <div key={s.key} className={done ? "line-through text-zinc-500" : ""}>
                  {s.text}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
