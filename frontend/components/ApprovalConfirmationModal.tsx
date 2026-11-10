"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { CandidateWithContext } from "@/types/candidate";
import { updateCandidateApproval } from "@/lib/api";
import { getAdminToken } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";

interface ApprovalConfirmationModalProps {
  candidate: CandidateWithContext | null;
  targetStatus: "approved" | "rejected" | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ApprovalConfirmationModal({
  candidate,
  targetStatus,
  onClose,
  onSuccess,
}: ApprovalConfirmationModalProps) {
  const { user, token: ctxToken, isAdmin, login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fallback inline admin credentials
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  const handleClose = useCallback(() => {
    setError(null);
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    if (candidate) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [candidate, handleClose]);

  if (!candidate || !targetStatus) return null;

  const isElectionDraft = candidate.election_status.toLowerCase() === "draft";
  const isApproving = targetStatus === "approved";

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isElectionDraft) {
      setError(
        `Backend Rule: Candidates can only be reviewed before the election starts. The election "${candidate.election_title}" is currently in "${candidate.election_status}" status.`
      );
      return;
    }

    setSubmitting(true);

    try {
      let token = ctxToken;

      // If no valid session token exists, authenticate first
      if (!token || !isAdmin) {
        if (!adminEmail.trim() || !adminPassword) {
          setError("Administrator email and password are required to authorize this action.");
          setSubmitting(false);
          return;
        }

        await login(adminEmail.trim(), adminPassword);
        token = getAdminToken();
        if (!token) {
          throw new Error("Could not acquire administrator token.");
        }
      }

      await updateCandidateApproval(candidate.id, targetStatus, token);
      onSuccess();
      handleClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred while updating candidate approval."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
          <div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-indigo-600 uppercase">
              Administrative Review Action
            </span>
            <h2 id="confirm-modal-title" className="text-lg font-bold text-[#171b35]">
              {isApproving ? "Approve Candidate Nomination" : "Reject Candidate Nomination"}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleConfirm} className="p-6 space-y-4">
          {error && (
            <div
              role="alert"
              className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2 leading-relaxed"
            >
              <span className="font-bold text-rose-500">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Candidate Details Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Candidate Reference:</span>
              <strong className="font-mono text-slate-800 font-bold">
                Candidate ID #{candidate.id}
              </strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Student Record ID:</span>
              <span className="font-mono text-slate-700 font-semibold">
                Student ID #{candidate.student_id}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Position:</span>
              <span className="text-slate-800 font-semibold">{candidate.position_title}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Election:</span>
              <span className="text-slate-800 font-semibold">{candidate.election_title}</span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-200">
              <span className="text-slate-500 font-medium">Election Status:</span>
              <span
                className={`font-semibold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded ${
                  isElectionDraft
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                ● {candidate.election_status}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-slate-500 font-medium">New Approval Status:</span>
              <span
                className={`font-bold uppercase text-[11px] ${
                  isApproving ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                → {targetStatus}
              </span>
            </div>
          </div>

          {/* Election status rule notice */}
          {!isElectionDraft && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl leading-relaxed">
              <strong>Backend Policy Restriction:</strong> Candidates can only be reviewed while the election is in <strong>Draft</strong> status. Because this election is currently <strong>{candidate.election_status}</strong>, status modifications are locked by the backend API contract.
            </div>
          )}

          {/* Authentication requirement */}
          <div className="pt-2">
            {isAdmin && user ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Authorized Admin: <strong>{user.full_name || user.email}</strong> ({user.email})
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-slate-700">
                    Administrator Authorization Required
                  </p>
                  <Link
                    href="/login"
                    className="text-purple-700 font-semibold hover:underline"
                  >
                    Login Portal →
                  </Link>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="Admin Email"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6857e8]"
                  />
                  <input
                    type="password"
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Admin Password"
                    className="px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6857e8]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !isElectionDraft}
              className={`px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed ${
                isApproving
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {submitting && (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>
                {submitting
                  ? "Updating..."
                  : isApproving
                  ? "Confirm Approval"
                  : "Confirm Rejection"}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
