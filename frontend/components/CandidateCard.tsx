"use client";

import React, { useState } from "react";
import { CandidateWithContext } from "@/types/candidate";

interface CandidateCardProps {
  candidate: CandidateWithContext;
  onUpdateApproval: (
    candidate: CandidateWithContext,
    targetStatus: "approved" | "rejected"
  ) => void;
  isAdmin?: boolean;
}

export default function CandidateCard({
  candidate,
  onUpdateApproval,
  isAdmin = false,
}: CandidateCardProps) {
  const [isManifestoExpanded, setIsManifestoExpanded] = useState(false);

  const isDraft = candidate.election_status.toLowerCase() === "draft";
  const isApproved = candidate.approval_status.toLowerCase() === "approved";
  const isRejected = candidate.approval_status.toLowerCase() === "rejected";

  const getStatusBadge = () => {
    if (isApproved) {
      return (
        <span className="status status-voting-open text-[10px] font-semibold">
          ● Approved
        </span>
      );
    }
    if (isRejected) {
      return (
        <span className="status bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-semibold">
          ✕ Rejected
        </span>
      );
    }
    return (
      <span className="status status-upcoming text-[10px] font-semibold">
        ⏳ Pending Review
      </span>
    );
  };

  return (
    <article
      className="p-5 bg-white border border-[#eaecf2] rounded-xl shadow-xs hover:border-indigo-100 hover:shadow-sm transition-all"
      aria-labelledby={`candidate-${candidate.id}-heading`}
    >
      {/* Top Meta: IDs & Status */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {candidate.image_url ? (
            <img
              src={candidate.image_url}
              alt={`Candidate #${candidate.id}`}
              className="w-12 h-12 rounded-xl object-cover border border-purple-200 shadow-2xs shrink-0"
              onError={(e) => {
                // Fallback if image fails to load
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-12 h-12 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center font-bold text-purple-700 font-mono text-sm shrink-0">
              #{candidate.id}
            </div>
          )}
          <div>
            <h3
              id={`candidate-${candidate.id}-heading`}
              className="text-sm font-bold text-[#171b35] leading-tight"
            >
              {candidate.student_name || `Candidate Record #${candidate.id}`}
            </h3>
            <span className="text-[11px] font-medium text-slate-500 block">
              {candidate.student_number ? (
                <span className="font-semibold text-purple-700">Roll #{candidate.student_number} • </span>
              ) : null}
              Student ID:{" "}
              <strong className="text-slate-700 font-mono">
                #{candidate.student_id}
              </strong>
            </span>
            {candidate.department_name && (
              <span className="text-[10px] text-slate-500 font-medium block">
                {candidate.department_name}
              </span>
            )}
          </div>
        </div>

        <div>{getStatusBadge()}</div>
      </div>

      {/* Association Details: Election & Position */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-slate-50 border border-slate-100 rounded-lg text-xs mb-3.5">
        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Position Contested
          </span>
          <span className="font-semibold text-slate-800 text-xs">
            {candidate.position_title}
          </span>
          <span className="text-[10px] text-slate-400 block font-mono">
            Position ID #{candidate.position_id}
          </span>
        </div>

        <div>
          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
            Associated Election
          </span>
          <span className="font-semibold text-slate-800 text-xs line-clamp-1" title={candidate.election_title}>
            {candidate.election_title}
          </span>
          <span className="text-[10px] text-slate-500 flex items-center gap-1 font-mono">
            <span>#{candidate.election_id}</span>
            <span>·</span>
            <span
              className={`font-semibold capitalize ${
                isDraft ? "text-amber-600" : "text-emerald-600"
              }`}
            >
              {candidate.election_status}
            </span>
          </span>
        </div>
      </div>

      {/* Candidate Manifesto */}
      <div className="mb-4 text-xs">
        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider mb-1">
          Manifesto / Platform
        </span>
        {candidate.manifesto ? (
          <div>
            <p
              className={`text-slate-600 italic bg-slate-50/60 p-2.5 rounded-lg border border-slate-100 leading-relaxed ${
                isManifestoExpanded ? "" : "line-clamp-2"
              }`}
            >
              &ldquo;{candidate.manifesto}&rdquo;
            </p>
            {candidate.manifesto.length > 120 && (
              <button
                type="button"
                onClick={() => setIsManifestoExpanded(!isManifestoExpanded)}
                className="text-[11px] font-semibold text-indigo-600 hover:underline mt-1"
              >
                {isManifestoExpanded ? "Show less" : "Read full manifesto"}
              </button>
            )}
          </div>
        ) : (
          <p className="text-slate-400 italic text-xs">
            No personal manifesto statement provided.
          </p>
        )}
      </div>

      {/* Action Footer: Approval Review (Admin Only) */}
      {isAdmin && (
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="text-[11px] text-slate-400">
            {isDraft ? (
              <span className="text-emerald-600 font-medium">
                ✓ Eligible for administrative review
              </span>
            ) : (
              <span className="text-slate-400" title="Backend restricts candidate reviews to draft elections">
                🔒 Locked (Election is {candidate.election_status})
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isApproved ? (
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => onUpdateApproval(candidate, "rejected")}
                className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  isDraft
                    ? "Reject this candidate's nomination"
                    : "Cannot review candidate: Election is not in Draft status"
                }
              >
                Reject Nomination
              </button>
            ) : (
              <button
                type="button"
                disabled={!isDraft}
                onClick={() => onUpdateApproval(candidate, "approved")}
                className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={
                  isDraft
                    ? "Approve this candidate for ballot voting"
                    : "Cannot review candidate: Election is not in Draft status"
                }
              >
                Approve Nomination
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

