"use client";

import React, { useEffect } from "react";
import { Election } from "@/types/election";
import { formatKolkataDateTime, getStatusMetadata } from "@/lib/utils";
import StatusBadge from "./StatusBadge";

interface ElectionDetailModalProps {
  election: Election | null;
  onClose: () => void;
}

export default function ElectionDetailModal({
  election,
  onClose,
}: ElectionDetailModalProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (election) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [election, onClose]);

  if (!election) return null;

  const metadata = getStatusMetadata(election.status);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[11px] font-mono font-bold tracking-wider text-slate-500 uppercase">
                Election Record #{election.id}
              </span>
              <StatusBadge status={election.status} />
            </div>
            <h2 id="modal-title" className="text-xl font-bold text-[#171b35]">
              {election.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Description */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Description
            </h3>
            <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              {election.description || "No official description provided for this election."}
            </p>
          </div>

          {/* Schedule in Asia/Kolkata */}
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Voting Schedule (Asia/Kolkata)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  Start Date & Time
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {formatKolkataDateTime(election.starts_at, true)}
                </span>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                  End Date & Time
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {formatKolkataDateTime(election.ends_at, true)}
                </span>
              </div>
            </div>
          </div>

          {/* Administrative Status Overview */}
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50">
            <h3 className="text-xs font-bold text-indigo-900 uppercase tracking-wider mb-1.5">
              Current Lifecycle Phase
            </h3>
            <p className="text-xs text-indigo-800 leading-relaxed">
              {metadata.description}
            </p>
          </div>

          {/* Security & Audit Parameters */}
          <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
            <div className="flex justify-between">
              <span>Security Hash Verification:</span>
              <span className="font-mono text-emerald-600 font-semibold">Enabled</span>
            </div>
            <div className="flex justify-between">
              <span>Database Backend:</span>
              <span className="font-mono text-slate-700">PostgreSQL (smartvote_db)</span>
            </div>
            <div className="flex justify-between">
              <span>API Source:</span>
              <span className="font-mono text-slate-700">GET /elections/{election.id}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-slate-100 bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
}

