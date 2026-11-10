"use client";

import React from "react";
import { Election } from "@/types/election";
import { formatKolkataDateTime } from "@/lib/utils";
import StatusBadge from "./StatusBadge";

interface ElectionCardProps {
  election: Election;
  index: number;
  onViewDetails: (election: Election) => void;
}

export default function ElectionCard({
  election,
  index,
  onViewDetails,
}: ElectionCardProps) {
  // Accessible symbol based on index and status
  const symbols = ["◈", "♙", "✳"];
  const symbol = symbols[index % symbols.length];

  return (
    <article
      className="election-card group"
      aria-labelledby={`election-${election.id}-title`}
    >
      {/* Visual Identity Icon */}
      <div
        className={`election-symbol symbol-${index % 3}`}
        aria-hidden="true"
      >
        {symbol}
      </div>

      {/* Main Info */}
      <div className="election-info">
        <div className="election-title-row">
          <h3 id={`election-${election.id}-title`}>
            {election.title}
          </h3>
          <StatusBadge status={election.status} />
        </div>

        <p>
          {election.description
            ? election.description
            : "No formal description provided for this election."}
        </p>

        {/* Election Metadata (ID, Start, End in Asia/Kolkata timezone) */}
        <div className="election-meta">
          <span className="font-mono text-slate-500 font-semibold">
            ID #{election.id}
          </span>
          <span title={`Voting starts at: ${formatKolkataDateTime(election.starts_at, true)}`}>
            <strong className="text-slate-600 font-medium">Starts:</strong>{" "}
            {formatKolkataDateTime(election.starts_at)}
          </span>
          <span title={`Voting ends at: ${formatKolkataDateTime(election.ends_at, true)}`}>
            <strong className="text-slate-600 font-medium">Ends:</strong>{" "}
            {formatKolkataDateTime(election.ends_at)}
          </span>
        </div>
      </div>

      {/* View Election Action */}
      <button
        type="button"
        className="more-button transition-transform active:scale-95"
        onClick={() => onViewDetails(election)}
        aria-label={`View full details for election #${election.id}: ${election.title}`}
        title="View Election Details"
      >
        →
      </button>
    </article>
  );
}
