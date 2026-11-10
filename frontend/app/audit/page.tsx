"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { useAuth } from "@/context/AuthContext";
import {
  fetchAuditLogs,
  triggerClockTick,
  fetchClockStatus,
  verifyBallotReceipt,
  AuditLogItem,
  ClockStatus,
  VerifiedReceipt,
  API_URL,
} from "@/lib/api";
import { getAdminToken } from "@/lib/auth";
import { formatKolkataDateTime } from "@/lib/utils";

export default function AuditPage() {
  const { user, isAuthenticated, isAdmin, isLoading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Audit Logs State
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [logError, setLogError] = useState<string | null>(null);
  const [selectedAction, setSelectedAction] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Clock State
  const [clockStatus, setClockStatus] = useState<ClockStatus | null>(null);
  const [clockTicking, setClockTicking] = useState(false);
  const [clockFeedback, setClockFeedback] = useState<string | null>(null);

  // Receipt Verifier State
  const [receiptInput, setReceiptInput] = useState<string>("");
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerifiedReceipt | null>(null);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Selected Log Details Modal
  const [activeLogDetails, setActiveLogDetails] = useState<AuditLogItem | null>(null);

  const loadData = useCallback(async () => {
    const token = getAdminToken();
    if (!token) return;

    setLoadingLogs(true);
    setLogError(null);

    try {
      const [fetchedLogs, fetchedClock] = await Promise.all([
        fetchAuditLogs(token),
        fetchClockStatus(token).catch(() => null),
      ]);
      setLogs(fetchedLogs);
      if (fetchedClock) setClockStatus(fetchedClock);
    } catch (err: unknown) {
      setLogError(err instanceof Error ? err.message : "Failed to load audit trail");
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      loadData();
    }
  }, [isAuthenticated, isAdmin, loadData]);

  // Handle Manual Clock Tick
  const handleTriggerClock = async () => {
    const token = getAdminToken();
    if (!token) return;

    setClockTicking(true);
    setClockFeedback(null);

    try {
      const res = await triggerClockTick(token);
      setClockFeedback(res.message);
      // Reload logs to show any new auto-transitions
      await loadData();
    } catch (err: unknown) {
      setClockFeedback(err instanceof Error ? err.message : "Clock evaluation failed");
    } finally {
      setClockTicking(false);
    }
  };

  // Handle Live Receipt Verification
  const handleVerifyReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptInput.trim()) return;

    setVerifying(true);
    setVerificationResult(null);
    setVerificationError(null);

    try {
      const res = await verifyBallotReceipt(receiptInput.trim());
      setVerificationResult(res);
    } catch (err: unknown) {
      setVerificationError(
        err instanceof Error ? err.message : "Ballot receipt could not be verified in ledger."
      );
    } finally {
      setVerifying(false);
    }
  };

  // CSV Export Download
  const handleDownloadCsv = () => {
    const token = getAdminToken();
    if (!token) return;
    const downloadUrl = `${API_URL}/audit-logs/export`;
    window.open(downloadUrl, "_blank");
  };

  // Filtered Logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesAction =
        selectedAction === "ALL" || log.action.toUpperCase() === selectedAction.toUpperCase();
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        log.action.toLowerCase().includes(query) ||
        log.admin_email.toLowerCase().includes(query) ||
        log.target_type.toLowerCase().includes(query) ||
        (log.target_id && log.target_id.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query));

      return matchesAction && matchesSearch;
    });
  }, [logs, selectedAction, searchQuery]);

  // Unique Actions for Filter Dropdown
  const uniqueActions = useMemo(() => {
    const actions = new Set(logs.map((l) => l.action));
    return ["ALL", ...Array.from(actions)];
  }, [logs]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center gap-2">
          <span className="animate-spin text-purple-600 font-bold">↻</span>
          Loading audit ledger security context...
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-xl font-bold mb-3">
              🛡️
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              Administrator Access Required
            </h1>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              The immutable audit ledger and election clock controls are restricted exclusively to authorized election administrators.
            </p>
            <div className="mt-6 space-y-3">
              <Link
                href="/login?returnUrl=/audit"
                className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs transition-colors"
              >
                Sign In as Administrator →
              </Link>
              <div>
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-block"
                >
                  ← Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <Sidebar
        activeSection="Audit"
        electionCount={0}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="main-content">
        <Topbar
          activeSection="Audit"
          isApiConnected={!logError}
          onRefresh={loadData}
          isRefreshing={loadingLogs}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <div className="content-container">
          {/* Header */}
          <div className="page-header flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-2xl" aria-hidden="true">
                  🛡️
                </span>
                <h1 className="page-title text-xl font-bold text-slate-900">
                  Immutable Audit Ledger & Automated Clock
                </h1>
              </div>
              <p className="page-subtitle text-xs text-slate-500 mt-1">
                Cryptographic ballot verification, immutable administrative mutation records, and APScheduler lifecycle automation.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={loadData}
                disabled={loadingLogs}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-xs font-semibold hover:bg-slate-50 shadow-xs cursor-pointer"
              >
                <span className={loadingLogs ? "animate-spin" : ""}>↻</span>
                Refresh Ledger
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer"
              >
                <span>📥</span>
                Download Official CSV
              </button>
            </div>
          </div>

          {/* Grid: APScheduler Clock + Live Receipt Verifier */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* 1. Automated Election Clock Card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">⏱️</span>
                  <h2 className="text-sm font-bold text-slate-900">
                    APScheduler Automated Clock Engine
                  </h2>
                </div>
                <span
                  className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
                    clockStatus?.status === "running"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  ● {clockStatus?.status === "running" ? "Clock Running" : "Standby"}
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                The automated scheduler evaluates election schedules every 30 seconds. It automatically transitions draft elections to <strong>open</strong> and concludes active voting to <strong>closed</strong> when scheduled time windows expire.
              </p>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-xs space-y-1.5 mb-4">
                <div className="flex justify-between text-slate-600">
                  <span>Polling Frequency:</span>
                  <strong className="text-slate-800">Every 30 seconds</strong>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Active Scheduler Job:</span>
                  <code className="text-purple-700 font-mono text-[11px]">election_clock_job</code>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Server UTC Reference:</span>
                  <strong className="text-slate-800 font-mono text-[11px]">
                    {clockStatus?.current_time_utc ? new Date(clockStatus.current_time_utc).toUTCString() : "Live"}
                  </strong>
                </div>
              </div>

              {clockFeedback && (
                <div className="mb-3 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-center justify-between">
                  <span>⚡ {clockFeedback}</span>
                  <button
                    type="button"
                    onClick={() => setClockFeedback(null)}
                    className="text-purple-600 hover:text-purple-800 font-bold ml-2"
                  >
                    ✕
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={handleTriggerClock}
                disabled={clockTicking}
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {clockTicking ? (
                  <>
                    <span className="animate-spin text-sm">↻</span>
                    Evaluating Election Time Windows...
                  </>
                ) : (
                  <>
                    <span>⚡</span>
                    Trigger Immediate Clock Evaluation
                  </>
                )}
              </button>
            </div>

            {/* 2. Cryptographic Ballot Receipt Verifier */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔐</span>
                  <h2 className="text-sm font-bold text-slate-900">
                    Cryptographic Ballot Receipt Verifier
                  </h2>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                  SHA-256 Ledger
                </span>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed mb-3">
                Enter any student ballot verification hash to confirm that their secret ballot is recorded in the immutable voter participation ledger.
              </p>

              <form onSubmit={handleVerifyReceipt} className="space-y-3 mb-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={receiptInput}
                    onChange={(e) => setReceiptInput(e.target.value)}
                    placeholder="Paste 64-character SHA-256 receipt hash..."
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                  <button
                    type="submit"
                    disabled={verifying || !receiptInput.trim()}
                    className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-semibold disabled:opacity-50 cursor-pointer"
                  >
                    {verifying ? "Checking..." : "Verify Hash"}
                  </button>
                </div>
              </form>

              {/* Verification Result */}
              {verificationResult && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-emerald-800">
                    <span className="text-base">✓</span>
                    <span>Ballot Verified in PostgreSQL Ledger</span>
                  </div>
                  <div className="text-[11px] text-emerald-900">
                    Election: <strong>{verificationResult.election_title}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-900">
                    Office / Position: <strong>{verificationResult.position_title}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-700">
                    Cast At: {formatKolkataDateTime(verificationResult.recorded_at)}
                  </div>
                  <div className="text-[10px] text-emerald-600 italic pt-1 border-t border-emerald-200">
                    🛡️ {verificationResult.secrecy_note}
                  </div>
                </div>
              )}

              {verificationError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                  ✕ {verificationError}
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Immutable Audit Log Table */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Administrative Mutation Audit Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Append-only record of all governance operations. Records cannot be altered or removed.
                </p>
              </div>

              {/* Controls */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Search */}
                <input
                  type="text"
                  placeholder="Filter by keyword or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
                />

                {/* Action Filter */}
                <select
                  value={selectedAction}
                  onChange={(e) => setSelectedAction(e.target.value)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  {uniqueActions.map((action) => (
                    <option key={action} value={action}>
                      {action === "ALL" ? "All Actions" : action}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {logError && (
              <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                ⚠ {logError}
              </div>
            )}

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                    <th className="py-2.5 px-3 font-semibold">ID</th>
                    <th className="py-2.5 px-3 font-semibold">Timestamp</th>
                    <th className="py-2.5 px-3 font-semibold">Actor</th>
                    <th className="py-2.5 px-3 font-semibold">Action</th>
                    <th className="py-2.5 px-3 font-semibold">Target</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingLogs ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <span className="animate-spin inline-block mr-2">↻</span>
                        Loading immutable audit trail...
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        No audit records found matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const isSystem = log.admin_email.includes("SYSTEM");
                      const isActionOpen = log.action.includes("OPEN");
                      const isActionClose = log.action.includes("CLOSE");
                      const isApprove = log.action.includes("APPROVE");
                      const isReject = log.action.includes("REJECT");

                      let badgeColor = "bg-slate-100 text-slate-700";
                      if (isActionOpen || isApprove) badgeColor = "bg-emerald-100 text-emerald-800";
                      else if (isActionClose || isReject) badgeColor = "bg-rose-100 text-rose-800";
                      else if (isSystem) badgeColor = "bg-purple-100 text-purple-800";

                      return (
                        <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                            #{log.id}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                            {formatKolkataDateTime(log.created_at)}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 block">
                              {log.admin_email}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {log.admin_id ? `User ID #${log.admin_id}` : "System Daemon"}
                            </span>
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full uppercase ${badgeColor}`}
                            >
                              {log.action}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 capitalize">
                            {log.target_type} {log.target_id ? `(#${log.target_id})` : ""}
                          </td>
                          <td className="py-2.5 px-3 text-right">
                            {log.details ? (
                              <button
                                type="button"
                                onClick={() => setActiveLogDetails(log)}
                                className="text-purple-700 hover:text-purple-900 font-semibold text-[11px] underline"
                              >
                                View Payload
                              </button>
                            ) : (
                              <span className="text-slate-400 text-[11px]">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Payload Modal */}
      {activeLogDetails && (
        <div
          role="presentation"
          onClick={() => setActiveLogDetails(null)}
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-modal-title"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="audit-modal-title" className="text-sm font-bold text-slate-900">
                Audit Record Payload #{activeLogDetails.id}
              </h3>
              <button
                type="button"
                onClick={() => setActiveLogDetails(null)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs space-y-2 text-slate-700">
              <div>
                <span className="font-semibold text-slate-500">Operation:</span>{" "}
                <span className="font-mono">{activeLogDetails.action}</span>
              </div>
              <div>
                <span className="font-semibold text-slate-500">Actor:</span>{" "}
                {activeLogDetails.admin_email}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Timestamp:</span>{" "}
                {formatKolkataDateTime(activeLogDetails.created_at)}
              </div>
              <div>
                <span className="font-semibold text-slate-500">Raw Mutation Payload:</span>
                <pre className="mt-1 p-3 bg-slate-900 text-slate-100 rounded-xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(activeLogDetails.details || "{}"), null, 2);
                    } catch {
                      return activeLogDetails.details || "{}";
                    }
                  })()}
                </pre>
              </div>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => setActiveLogDetails(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
