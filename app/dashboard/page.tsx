"use client";

import React from "react";
import { useAppState, type Table, attentionScore, getTableAlerts } from "../app-state";
import { getMenuById } from "../settings/settings-store";
import { useI18n } from "../i18n";

type Filter = "ALL" | "ATTN" | "PAUSED" | "APPROVAL";

function currentCourse(setup: Table["setup"]) {
  if (!setup?.courseLines?.length) return null;
  const fired = setup.courseLines.find((c) => c.status === "FIRED");
  if (fired) return fired;
  const next = setup.courseLines.find((c) => c.status === "PENDING");
  return next || null;
}

function progressNumbers(setup: Table["setup"]) {
  const lines = setup?.courseLines || [];
  const total = lines.length || 0;
  const done = lines.filter((c) => c.status === "DONE").length;
  const fired = lines.filter((c) => c.status === "FIRED").length;
  const pending = lines.filter((c) => c.status === "PENDING").length;
  return { total, done, fired, pending };
}

export default function DashboardPage() {
  const { t } = useI18n();
  const { tables, hasAllergyFlag } = useAppState();

  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<Filter>("ALL");
  const [tab, setTab] = React.useState<"ATTENTION" | "PROGRESS">("ATTENTION");

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const seated = React.useMemo(() => tables.filter((t) => t.reservationStatus === "SEATED"), [tables]);

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
      return (t.name || "").toLowerCase().includes(q) || (t.reservationName || "").toLowerCase().includes(q);
    });

    const sorted = [...filtered].sort((a, b) => attentionScore(b, now) - attentionScore(a, now));

    return sorted.filter((t) => {
      const setup = t.setup;
      if (filter === "ALL") return true;
      if (filter === "PAUSED") return !!setup?.paused;
      if (filter === "APPROVAL") return !!setup && setup.approval !== "APPROVED";
      if (filter === "ATTN") return getTableAlerts(t, now).length > 0;
      return true;
    });
  }, [seated, search, filter, now]);

  return (
    <div className="h-full w-full bg-[#0f0f12] p-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-2xl font-black text-white">{t("Dashboard", "Dashboard")}</div>
          <div className="text-sm text-zinc-400 mt-1">
            {t("Real-time insights (UI-only).", "Real-time insights (UI-only).")}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-zinc-400">{t("FILTER", "FILTER")}</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="rounded-xl bg-black/60 border border-zinc-800 text-white px-3 py-2 text-xs font-black outline-none"
          >
            <option value="ALL">{t("ALL", "ALL")}</option>
            <option value="ATTN">{t("NEEDS ATTENTION", "NEEDS ATTENTION")}</option>
            <option value="PAUSED">{t("PAUSED", "PAUSED")}</option>
            <option value="APPROVAL">{t("WAITING APPROVAL", "WAITING APPROVAL")}</option>
          </select>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setTab("ATTENTION")}
          className={[
            "px-4 py-2 rounded-xl text-xs font-black border transition",
            tab === "ATTENTION"
              ? "bg-amber-500 text-black border-amber-400"
              : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
          ].join(" ")}
        >
          {t("ATTENTION", "ATTENTION")}
        </button>

        <button
          onClick={() => setTab("PROGRESS")}
          className={[
            "px-4 py-2 rounded-xl text-xs font-black border transition",
            tab === "PROGRESS"
              ? "bg-amber-500 text-black border-amber-400"
              : "bg-zinc-950 text-zinc-200 border-zinc-800 hover:bg-zinc-900",
          ].join(" ")}
        >
          {t("PROGRESS BOARD", "PROGRESS BOARD")}
        </button>
      </div>

      {tab === "ATTENTION" ? (
        <>
          {/* Stats */}
          <div className="mt-5 grid grid-cols-6 gap-3">
            <Stat label={t("SEATED", "SEATED")} value={stats.seated} />
            <Stat label={t("APPROVED", "APPROVED")} value={stats.approved} />
            <Stat label={t("PENDING", "PENDING")} value={stats.pending} />
            <Stat label={t("PAUSED", "PAUSED")} value={stats.paused} />
            <Stat label={t("PAIRING", "PAIRING")} value={stats.pairing} />
            <Stat label={t("ALLERGY", "ALLERGY")} value={stats.allergy} />
          </div>

          {/* Search */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[240px]">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search table or reservation…", "Search table or reservation…")}
                className="w-full rounded-xl bg-black border border-zinc-800 text-white px-4 py-3 text-sm outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Body */}
          <div className="mt-6 grid grid-cols-4 gap-4">
            {list.length === 0 ? (
              <div className="col-span-4 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6 text-zinc-500">
                {t("No seated tables.", "No seated tables.")}
              </div>
            ) : (
              list.map((t) => <ProgressCard key={t.id} table={t} now={now} />)
            )}
          </div>
        </>
      ) : (
        <ProgressBoard tables={tables} now={now} filter={filter} />
      )}
    </div>
  );

  function Stat({ label, value }: { label: string; value: number }) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4">
        <div className="text-[11px] font-black tracking-widest text-zinc-400">{label}</div>
        <div className="text-2xl font-black text-white mt-1">{value}</div>
      </div>
    );
  }
}

function ProgressCard({ table, now }: { table: Table; now: number }) {
  const { t } = useI18n();
  const setup = table.setup;
  const alerts = getTableAlerts(table, now);
  const fired = setup?.courseLines?.find((c) => c.status === "FIRED") || null;

  const seatedFor = table.seatedAt ? now - table.seatedAt : 0;
  const min = Math.floor(seatedFor / 60000);
  const sec = Math.floor((seatedFor % 60000) / 1000);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="text-white font-black">
          {table.name} <span className="text-zinc-400">{table.reservationName || ""}</span>
        </div>
        <div className="text-xs font-black text-zinc-300">
          {min}:{String(sec).padStart(2, "0")}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {table.tableLanguage ? <Chip>{table.tableLanguage}</Chip> : null}
        {setup?.paused ? <Chip tone="red">{t("PAUSED", "PAUSED")}</Chip> : null}
        {setup?.pairing ? <Chip tone="indigo">{t("SLOW PACE", "SLOW PACE")}</Chip> : null}
        {setup && setup.approval !== "APPROVED" ? (
          <Chip tone="amber">{t("WAITING APPROVAL", "WAITING APPROVAL")}</Chip>
        ) : null}
      </div>

      <div className="mt-3 text-sm text-zinc-200">
        {fired ? (
          <>
            <span className="text-zinc-400 font-mono text-xs">{t("NOW", "NOW")}</span>{" "}
            <span className="font-black">#{fired.idx}</span> {fired.name}
          </>
        ) : (
          <span className="text-zinc-500">{t("Nothing fired", "Nothing fired")}</span>
        )}
      </div>

      {alerts.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {alerts.map((a) => (
            <Chip key={a} tone="amber">
              {t(a.replaceAll("_", " "), a.replaceAll("_", " "))}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "red" | "indigo" | "amber" }) {
  const cls =
    tone === "red"
      ? "border-red-700 bg-red-900/20 text-red-200"
      : tone === "indigo"
      ? "border-indigo-700 bg-indigo-900/20 text-indigo-200"
      : tone === "amber"
      ? "border-amber-500/50 bg-amber-500/10 text-amber-200"
      : "border-zinc-800 bg-black/40 text-zinc-200";

  return <div className={`px-2 py-1 rounded-lg border text-[10px] font-black ${cls}`}>{children}</div>;
}

function ProgressBoard({ tables, now, filter }: { tables: Table[]; now: number; filter: Filter }) {
  const { t } = useI18n();
  const seated = tables.filter((t) => t.reservationStatus === "SEATED");
  const sorted = [...seated].sort((a, b) => {
    const ai = currentCourse(a.setup)?.idx ?? 9999;
    const bi = currentCourse(b.setup)?.idx ?? 9999;
    if (ai !== bi) return ai - bi;
    const at = a.seatedAt ? now - a.seatedAt : 0;
    const bt = b.seatedAt ? now - b.seatedAt : 0;
    return bt - at;
  });
  const filtered = sorted.filter((t) => {
    const setup = t.setup;
    if (filter === "ALL") return true;
    if (filter === "PAUSED") return !!setup?.paused;
    if (filter === "APPROVAL") return !!setup && setup.approval !== "APPROVED";
    if (filter === "ATTN") return getTableAlerts(t, now).length > 0;
    return true;
  });

  return (
    <div className="mt-5 grid grid-cols-3 gap-4">
      {filtered.map((table) => {
        const setup = table.setup;
        const cur = currentCourse(setup);
        const p = progressNumbers(setup);

        const seatedFor = table.seatedAt ? now - table.seatedAt : 0;
        const min = Math.floor(seatedFor / 60000);
        const sec = Math.floor((seatedFor % 60000) / 1000);

        return (
          <div key={table.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-white font-black">
                {table.name} <span className="text-zinc-400">{table.reservationName || ""}</span>
              </div>
              <div className="text-xs font-black text-zinc-300">
                {min}:{String(sec).padStart(2, "0")}
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {table.tableLanguage ? <Chip>{table.tableLanguage}</Chip> : null}
              {setup?.paused ? <Chip tone="red">{t("PAUSED", "PAUSED")}</Chip> : null}
              {setup?.pairing ? <Chip tone="indigo">{t("SLOW PACE", "SLOW PACE")}</Chip> : null}
              {setup && setup.approval !== "APPROVED" ? (
                <Chip tone="amber">{t("WAITING APPROVAL", "WAITING APPROVAL")}</Chip>
              ) : null}
            </div>

            <div className="mt-3 rounded-xl border border-zinc-800 bg-black/30 p-3">
              <div className="text-xs text-zinc-500 font-black">{t("CURRENT", "CURRENT")}</div>
              {cur ? (
                <div className="mt-1 text-sm text-white font-black">
                  #{cur.idx} {cur.name}
                  <span className="ml-2 text-[10px] font-black px-2 py-1 rounded-lg border border-zinc-800 bg-black/40 text-zinc-200">
                    {t(cur.status, cur.status)}
                  </span>
                </div>
              ) : (
                <div className="mt-1 text-sm text-zinc-500">{t("No courses", "No courses")}</div>
              )}
            </div>

            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
                <div className="text-[10px] text-zinc-500 font-black">{t("DONE", "DONE")}</div>
                <div className="text-sm font-black text-white">{p.done}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
                <div className="text-[10px] text-zinc-500 font-black">{t("FIRED", "FIRED")}</div>
                <div className="text-sm font-black text-white">{p.fired}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
                <div className="text-[10px] text-zinc-500 font-black">{t("PEND", "PEND")}</div>
                <div className="text-sm font-black text-white">{p.pending}</div>
              </div>
              <div className="rounded-xl border border-zinc-800 bg-black/30 p-2">
                <div className="text-[10px] text-zinc-500 font-black">{t("TOTAL", "TOTAL")}</div>
                <div className="text-sm font-black text-white">{p.total}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
