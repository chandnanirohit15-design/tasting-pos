"use client";

import React from "react";
import { type MenuId, type TableSetup } from "../app/app-state";
import { courseSeatBreakdown, seatNotesList } from "./kds-ticket";
import { useI18n } from "../app/i18n";

export function TicketEditor({
  pax,
  setup,
  presets,
  dishPresets,
  menus,
  onSetSeatMenu,
  onSetSeatSub,
  onAddExtraDish,
  onRemoveExtraDish,
  onSetChefNote,
  onInsertCourseLine,
  onDeleteCourseLine,
  onMoveCourseLine,
}: {
  pax: number;
  setup: TableSetup;
  presets: string[];
  dishPresets: string[];
  menus?: Array<{ id: MenuId; label: string }>;
  onSetSeatMenu?: (seat: number, menuId: MenuId) => void;
  onSetSeatSub: (courseId: string, seat: number, sub: string) => void;
  onAddExtraDish: (courseId: string, dishName: string) => void;
  onRemoveExtraDish: (courseId: string, index: number) => void;
  onSetChefNote: (note: string) => void;
  onInsertCourseLine: (anchorCourseId: string, where: "BEFORE" | "AFTER", name: string) => void;
  onDeleteCourseLine: (courseId: string) => void;
  onMoveCourseLine: (courseId: string, dir: -1 | 1) => void;
}) {
  const { t } = useI18n();
  const [expandedCourseId, setExpandedCourseId] = React.useState<string | null>(null);
  const notes = seatNotesList(setup.allergiesBySeat);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <div className="text-xs font-black text-zinc-200 mb-2">
          {t("SEAT NOTES (ALLERGY / PREF)", "SEAT NOTES (ALLERGY / PREF)")}
        </div>
        {notes.length === 0 ? (
          <div className="text-sm text-zinc-500">—</div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: pax }).map((_, idx) => {
              const seat = idx + 1;
              const val = (setup.allergiesBySeat?.[seat] ?? "").trim();
              return (
                <div key={seat} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="text-[11px] font-black text-zinc-300 mb-1">
                    {t("Seat", "Seat")} {seat}
                  </div>
                  <div className={val ? "text-sm text-white font-black" : "text-sm text-zinc-500"}>
                    {val || "—"}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-black p-4">
        <div className="text-xs font-black text-zinc-200 mb-2">
          {t("CHEF NOTE (VISIBLE TO FOH + KITCHEN)", "CHEF NOTE (VISIBLE TO FOH + KITCHEN)")}
        </div>
        <textarea
          value={setup.chefNote || ""}
          onChange={(e) => onSetChefNote(e.target.value)}
          placeholder={t("Pacing / VIP / hold after course 6 / etc…", "Pacing / VIP / hold after course 6 / etc…")}
          className="w-full min-h-[70px] rounded-xl bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
        />
      </div>

      {menus && menus.length > 0 && onSetSeatMenu ? (
        <div className="rounded-xl border border-zinc-800 bg-black p-4">
          <div className="text-xs font-black text-zinc-200 mb-2">{t("MENU PER SEAT", "MENU PER SEAT")}</div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: pax }).map((_, idx) => {
              const seat = idx + 1;
              const current = setup.seatMenuId?.[seat] || menus[0]?.id;
              return (
                <div key={seat} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                  <div className="text-[11px] font-black text-zinc-300 mb-2">
                    {t("Seat", "Seat")} {seat}
                  </div>
                  <select
                    value={current}
                    onChange={(e) => onSetSeatMenu(seat, e.target.value as MenuId)}
                    className="w-full rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                  >
                    {menus.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between">
          <div className="text-sm font-black text-white">{t("SUBSTITUTIONS PER SEAT", "SUBSTITUTIONS PER SEAT")}</div>
          <div className="text-xs text-zinc-500">
            {t("Tap a course → choose substitute per seat", "Tap a course → choose substitute per seat")}
          </div>
        </div>

        <div className="divide-y divide-zinc-800">
          {setup.courseLines.map((c) => (
            <div key={c.id} className="p-4">
              <button
                onClick={() => setExpandedCourseId((prev) => (prev === c.id ? null : c.id))}
                className="w-full text-left flex items-start justify-between gap-3"
              >
                <div>
                  {(() => {
                    const bd = courseSeatBreakdown(c, pax);
                    return (
                      <>
                          <div className="text-white font-black">
                            <span className="text-zinc-400 font-mono text-xs">#{c.idx}</span> {bd.baseCount}x {bd.baseDish}
                          </div>
                        {bd.exceptions.length > 0 ? (
                          <div className="mt-1 text-xs text-zinc-400 space-y-1">
                            {bd.exceptions.map((e) => (
                              <div key={e.seat}>
                                  <span className="font-black text-zinc-300">
                                    {t("Seat", "Seat")} {e.seat} →
                                  </span>{" "}
                                  {e.dish}
                                </div>
                              ))}
                          </div>
                        ) : null}
                      </>
                    );
                  })()}
                  <div className="text-xs text-zinc-500 mt-1">
                    {Object.values(c.seatSubs || {}).some((v) => (v || "").trim().length > 0)
                      ? t("Substitutions set", "Substitutions set")
                      : t("No substitutions", "No substitutions")}
                  </div>
                </div>

                <div className="text-xs font-black text-zinc-300">
                  {expandedCourseId === c.id ? t("CLOSE", "CLOSE") : t("EDIT", "EDIT")}
                </div>
              </button>

              {expandedCourseId === c.id && (
                <div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {Array.from({ length: pax }).map((_, idx) => {
                      const seat = idx + 1;
                      const current = c.seatSubs?.[seat] ?? "";
                      return (
                        <div key={seat} className="rounded-xl border border-zinc-800 bg-black p-3">
                          <div className="text-[11px] font-black text-zinc-300 mb-2">
                            {t("Seat", "Seat")} {seat}
                          </div>
                          <select
                            value={current}
                            onChange={(e) => onSetSeatSub(c.id, seat, e.target.value)}
                            className="w-full rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                          >
                            <option value="">{t("— No substitution —", "— No substitution —")}</option>
                            {presets.map((p) => (
                              <option key={p} value={p}>
                                {p}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 rounded-xl border border-zinc-800 bg-black p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[11px] font-black text-zinc-300">
                        {t("EXTRA DISHES (THIS COURSE)", "EXTRA DISHES (THIS COURSE)")}
                      </div>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (!v) return;
                          if (v === "__custom__") {
                            const custom = prompt("Extra dish name?")?.trim() || "";
                            if (custom) onAddExtraDish(c.id, custom);
                            e.currentTarget.value = "";
                            return;
                          }
                          onAddExtraDish(c.id, v);
                          e.currentTarget.value = "";
                        }}
                        className="rounded-lg bg-zinc-950 border border-zinc-800 text-white px-3 py-2 text-sm outline-none focus:border-amber-500"
                      >
                        <option value="">{t("+ Add dish…", "+ Add dish…")}</option>
                        {dishPresets.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                        <option value="__custom__">{t("Custom…", "Custom…")}</option>
                      </select>
                    </div>

                    <div className="mt-2 space-y-2">
                      {(setup.extrasByCourseId?.[c.id] || []).map((x, i) => (
                        <div
                          key={`${x}_${i}`}
                          className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-950 p-2"
                        >
                          <div className="text-sm text-white font-black truncate">{x}</div>
                          <button
                            onClick={() => onRemoveExtraDish(c.id, i)}
                            className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-black/40 text-xs font-black text-zinc-200 hover:bg-zinc-900/40"
                          >
                            {t("DELETE", "DELETE")}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      onClick={() => {
                        const name = prompt("Course name?")?.trim() || "";
                        if (name) onInsertCourseLine(c.id, "BEFORE", name);
                      }}
                    >
                      {t("+ ADD BEFORE", "+ ADD BEFORE")}
                    </button>

                    <button
                      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      onClick={() => {
                        const name = prompt("Course name?")?.trim() || "";
                        if (name) onInsertCourseLine(c.id, "AFTER", name);
                      }}
                    >
                      {t("+ ADD AFTER", "+ ADD AFTER")}
                    </button>

                    <button
                      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      onClick={() => onMoveCourseLine(c.id, -1)}
                    >
                      {t("↑ MOVE", "↑ MOVE")}
                    </button>

                    <button
                      className="px-3 py-2 rounded-xl text-xs font-black border border-zinc-700 bg-black/40 text-zinc-200 hover:bg-zinc-900/40"
                      onClick={() => onMoveCourseLine(c.id, 1)}
                    >
                      {t("↓ MOVE", "↓ MOVE")}
                    </button>

                    <button
                      className="px-3 py-2 rounded-xl text-xs font-black border border-red-700 bg-red-900/20 text-red-200 hover:bg-red-900/30"
                      onClick={() => onDeleteCourseLine(c.id)}
                    >
                      {t("DELETE COURSE", "DELETE COURSE")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
