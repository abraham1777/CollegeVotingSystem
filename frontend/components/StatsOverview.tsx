"use client";

import React from "react";
import { ElectionStats } from "@/types/election";

interface StatsOverviewProps {
  stats: ElectionStats;
  loading: boolean;
}

export default function StatsOverview({ stats, loading }: StatsOverviewProps) {
  const formatNumber = (num: number) => {
    if (loading) return "—";
    return num.toString().padStart(2, "0");
  };

  return (
    <section aria-label="Election Statistics" className="mb-8">
      <div className="stats-grid">
        {/* Total Elections */}
        <article className="stat-card" aria-labelledby="stat-total-title">
          <div className="stat-heading" id="stat-total-title">
            <span>Total Elections</span>
            <span className="stat-icon purple" aria-hidden="true">
              ▦
            </span>
          </div>
          <div className="stat-number">{formatNumber(stats.total)}</div>
          <div className="stat-foot">
            <span>●</span> All records in database
          </div>
        </article>

        {/* Open Elections */}
        <article className="stat-card" aria-labelledby="stat-open-title">
          <div className="stat-heading" id="stat-open-title">
            <span>Open Elections</span>
            <span className="stat-icon green" aria-hidden="true">
              ◉
            </span>
          </div>
          <div className="stat-number">{formatNumber(stats.open)}</div>
          <div className="stat-foot">
            <span className="text-emerald-600 font-semibold">Live</span> — Eligible students can vote
          </div>
        </article>

        {/* Draft Elections */}
        <article className="stat-card" aria-labelledby="stat-draft-title">
          <div className="stat-heading" id="stat-draft-title">
            <span>Draft Elections</span>
            <span className="stat-icon blue" aria-hidden="true">
              ♙
            </span>
          </div>
          <div className="stat-number">{formatNumber(stats.draft)}</div>
          <div className="stat-foot">
            Pending candidate setup & launch
          </div>
        </article>

        {/* Closed Elections */}
        <article className="stat-card" aria-labelledby="stat-closed-title">
          <div className="stat-heading" id="stat-closed-title">
            <span>Closed Elections</span>
            <span className="stat-icon orange" aria-hidden="true">
              ✓
            </span>
          </div>
          <div className="stat-number">{formatNumber(stats.closed)}</div>
          <div className="stat-foot">
            Concluded voting sessions
          </div>
        </article>
      </div>

      {/* Audit & Compliance Notice (Requirement 9: Do not fabricate turnout data) */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <span className="text-slate-400">ℹ</span>
          <span>
            <strong>Voter Turnout & Participation:</strong> Not reported by the election catalog endpoint. Tallied securely upon ballot verification.
          </span>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          IST (UTC+05:30)
        </span>
      </div>
    </section>
  );
}

