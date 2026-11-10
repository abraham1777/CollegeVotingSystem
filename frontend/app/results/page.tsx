"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Election } from "@/types/election";
import { PositionWithResults } from "@/types/results";
import { fetchElections, fetchElectionResults } from "@/lib/api";
import { formatKolkataDateTime } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AuthBanner from "@/components/AuthBanner";
import StatusBadge from "@/components/StatusBadge";

function ResultsView() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Core state
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionWithResults[]>([]);
  const [hasPublishedTallies, setHasPublishedTallies] = useState<boolean>(false);
  const [tallyNotice, setTallyNotice] = useState<string>("");

  // Loading & Error states
  const [loadingElections, setLoadingElections] = useState<boolean>(true);
  const [loadingResults, setLoadingResults] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Expanded manifestos map
  const [expandedManifestos, setExpandedManifestos] = useState<Record<number, boolean>>({});

  const toggleManifesto = (candidateId: number) => {
    setExpandedManifestos((prev) => ({
      ...prev,
      [candidateId]: !prev[candidateId],
    }));
  };

  // Step 1: Fetch results breakdown for a specific election
  const fetchResultsForElection = useCallback(async (electionId: number) => {
    setLoadingResults(true);
    try {
      const result = await fetchElectionResults(electionId);
      setPositions(result.positions);
      setHasPublishedTallies(result.hasPublishedTallies);
      setTallyNotice(result.tallyNotice);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to load results for election #${electionId}`
      );
      setPositions([]);
    } finally {
      setLoadingResults(false);
    }
  }, []);

  // Step 2: Full refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchElections();
      setElections(data);
      setError("");

      const currentId = selectedElectionId ?? (data.length > 0 ? data[0].id : null);
      if (currentId !== null) {
        await fetchResultsForElection(currentId);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve elections from the backend API."
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [selectedElectionId, fetchResultsForElection]);

  // Initial load
  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      try {
        const data = await fetchElections();
        if (ignore) return;
        setElections(data);
        setError("");

        if (data.length > 0) {
          const queryId = searchParams.get("electionId");
          const found = queryId ? data.find((e) => e.id.toString() === queryId) : null;
          const initialId = found ? found.id : data[0].id;
          setSelectedElectionId(initialId);

          const result = await fetchElectionResults(initialId);
          if (ignore) return;
          setPositions(result.positions);
          setHasPublishedTallies(result.hasPublishedTallies);
          setTallyNotice(result.tallyNotice);
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not retrieve elections from the backend API."
          );
        }
      } finally {
        if (!ignore) {
          setLoadingElections(false);
          setLoadingResults(false);
        }
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, [searchParams]);

  // Handle election switch
  const handleSelectElection = (id: number) => {
    setSelectedElectionId(id);
    router.replace(`/results?electionId=${id}`);
    fetchResultsForElection(id);
  };

  // Currently active election object
  const activeElection = useMemo(() => {
    return elections.find((e) => e.id === selectedElectionId) || null;
  }, [elections, selectedElectionId]);

  // Export CSV Handler
  const handleExportCsv = () => {
    if (!activeElection) return;

    const rows: string[] = [];
    rows.push("Election ID,Election Title,Status,Position ID,Position,Candidate ID,Candidate Name,Student ID,Votes,Percentage,Declared Winner");

    positions.forEach((pos) => {
      pos.candidates.forEach((cand) => {
        const row = [
          activeElection.id,
          `"${activeElection.title.replace(/"/g, '""')}"`,
          activeElection.status.toUpperCase(),
          pos.id,
          `"${pos.title.replace(/"/g, '""')}"`,
          cand.id,
          `"${(cand.candidate_name || `Candidate #${cand.id}`).replace(/"/g, '""')}"`,
          cand.student_id,
          cand.votes ?? "Sealed",
          cand.percentage !== null && cand.percentage !== undefined ? `${cand.percentage.toFixed(1)}%` : "N/A",
          cand.is_winner ? "YES (CERTIFIED WINNER)" : "NO",
        ];
        rows.push(row.join(","));
      });
    });

    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `smartvote_certified_results_election_${activeElection.id}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export / Print PDF Handler
  const handlePrintPdf = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  // Aggregated metrics
  const metrics = useMemo(() => {
    const totalPositions = positions.length;
    const totalNominees = positions.reduce((acc, p) => acc + p.candidates.length, 0);
    const hasAnyCandidates = totalNominees > 0;
    return { totalPositions, totalNominees, hasAnyCandidates };
  }, [positions]);

  return (
    <main className="smartvote">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection="Results"
        electionCount={elections.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Panel */}
      <section className="main-panel">
        {/* Topbar */}
        <Topbar
          activeSection="Results"
          isApiConnected={!error}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          {/* Security & Authentication Notice */}
          <AuthBanner />

          {/* Page Heading (Requirement 4) */}
          <section className="welcome-row" aria-label="Election Results Header">
            <div>
              <div className="eyebrow">SMARTVOTE · AUDITED BALLOT OUTCOMES</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171b35] tracking-tight">
                Election Results
              </h1>
              <p className="muted text-xs text-slate-500 max-w-2xl">
                Inspect official election outcomes, position contest breakdowns, and verified nominee participation synchronized directly from PostgreSQL.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={!activeElection || positions.length === 0}
                className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                title="Download certified CSV breakdown of results"
              >
                <span>📊</span> Download CSV
              </button>

              <button
                type="button"
                onClick={handlePrintPdf}
                disabled={!activeElection}
                className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                title="Print or save official certified election results certificate as PDF"
              >
                <span>📄</span> Export / Print PDF
              </button>

              <Link
                href="/elections"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                ← Elections Catalog
              </Link>
            </div>
          </section>

          {/* Error Banner with Retry (Requirement 8) */}
          {error && (
            <div
              className="p-4 mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs"
              role="alert"
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base text-rose-600 font-bold" aria-hidden="true">
                  ⚠
                </span>
                <div>
                  <strong>Error loading results:</strong> {error}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Election Selector (Requirement 5) */}
          <section className="mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs" aria-label="Election Selection">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex-1">
                <label
                  htmlFor="election-selector"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5"
                >
                  Select College Election
                </label>
                {loadingElections ? (
                  <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
                ) : elections.length === 0 ? (
                  <p className="text-xs text-slate-500">No elections found in database.</p>
                ) : (
                  <select
                    id="election-selector"
                    value={selectedElectionId ?? ""}
                    onChange={(e) => handleSelectElection(Number(e.target.value))}
                    className="w-full md:max-w-md px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 focus:bg-white transition-all cursor-pointer"
                  >
                    {elections.map((el) => (
                      <option key={el.id} value={el.id}>
                        #{el.id} — {el.title} ({el.status.toUpperCase()})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Quick Pills for Recent Elections */}
              {elections.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-2 md:pt-0">
                  <span className="text-[11px] font-semibold text-slate-400 mr-1 uppercase tracking-wider">
                    Quick Select:
                  </span>
                  {elections.slice(0, 4).map((el) => {
                    const isSelected = el.id === selectedElectionId;
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => handleSelectElection(el.id)}
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors border ${
                          isSelected
                            ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        #{el.id} {el.title.length > 20 ? `${el.title.slice(0, 18)}...` : el.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Active Election Details Header (Requirement 6) */}
          {activeElection && (
            <section className="mb-6 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs" aria-label="Selected Election Details">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2.5 mb-2">
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-purple-100 text-purple-800">
                      Election #{activeElection.id}
                    </span>
                    <StatusBadge status={activeElection.status} />
                  </div>
                  <h2 className="text-xl font-bold text-[#171b35] tracking-tight">
                    {activeElection.title}
                  </h2>
                  {activeElection.description && (
                    <p className="text-xs text-slate-600 mt-1 max-w-3xl leading-relaxed">
                      {activeElection.description}
                    </p>
                  )}
                </div>

                {/* Timeline Box */}
                <div className="flex flex-col sm:flex-row gap-4 p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 shrink-0">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Scheduled Start (IST)
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatKolkataDateTime(activeElection.starts_at, true)}
                    </span>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Scheduled End (IST)
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatKolkataDateTime(activeElection.ends_at, true)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Metrics Pill Strip */}
              <div className="mt-3 flex items-center gap-2.5 text-xs text-slate-600 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-50 text-purple-700 font-medium">
                  <strong>{metrics.totalPositions}</strong> {metrics.totalPositions === 1 ? "Contested Position" : "Contested Positions"}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                  <strong>{metrics.totalNominees}</strong> {metrics.totalNominees === 1 ? "Verified Nominee" : "Verified Nominees"}
                </span>
                <span className="text-[11px] text-slate-400">
                  {metrics.hasAnyCandidates ? "All candidate profiles synchronized with backend" : "No approved nominees registered"}
                </span>
              </div>

              {/* Status Transparency Banner (Requirements 6, 8, 9) */}
              <div className="mt-4 pt-1">
                {activeElection.status.toLowerCase() === "draft" && (
                  <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                    <span className="text-base text-amber-600 font-bold shrink-0">♙</span>
                    <div>
                      <strong>Draft Stage — Ballots Not Opened:</strong> This election is currently in draft configuration. Candidates and positions are in nomination review. Voting has not begun, and no votes have been recorded.
                    </div>
                  </div>
                )}

                {activeElection.status.toLowerCase() === "open" && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-start gap-2.5 leading-relaxed">
                    <span className="text-base text-emerald-600 font-bold shrink-0">◉</span>
                    <div>
                      <strong>Live Voting In Progress:</strong> Eligible students are actively casting secret ballots via institutional verification. Per election audit protocols, interim vote counts remain sealed in the database until voting concludes to prevent voter bias.
                    </div>
                  </div>
                )}

                {activeElection.status.toLowerCase() === "closed" && (
                  <div className="p-3.5 bg-indigo-50 border border-indigo-200 rounded-xl text-xs text-indigo-900 flex items-start gap-2.5 leading-relaxed">
                    <span className="text-base text-indigo-600 font-bold shrink-0">🔒</span>
                    <div>
                      <strong>Voting Concluded — Ledger Sealed:</strong> This election has concluded. All ballots are securely recorded in the PostgreSQL <code className="bg-indigo-100 px-1 py-0.5 rounded text-[11px]">votes</code> table. {tallyNotice}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Results Breakdown by Position (Requirements 6, 7, 8, 9) */}
          {loadingResults ? (
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs animate-pulse">
                  <div className="h-5 w-48 bg-slate-200 rounded mb-4" />
                  <div className="space-y-2">
                    <div className="h-12 bg-slate-100 rounded" />
                    <div className="h-12 bg-slate-100 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : positions.length === 0 ? (
            /* Empty State: No positions (Requirement 8) */
            <div className="p-12 bg-white rounded-2xl border border-slate-200 text-center shadow-xs">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl font-bold mb-3">
                ▤
              </div>
              <h3 className="text-base font-bold text-slate-800">
                No Positions Configured
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No contested offices or candidate positions have been established for this election in PostgreSQL.
              </p>
              <div className="mt-4">
                <Link
                  href="/candidates"
                  className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors inline-block"
                >
                  Go to Candidate Governance →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {positions.map((position) => (
                <article
                  key={position.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                  aria-labelledby={`pos-${position.id}-title`}
                >
                  {/* Position Header */}
                  <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                        #{position.id}
                      </div>
                      <div>
                        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                          Contested Position
                        </span>
                        <h3
                          id={`pos-${position.id}-title`}
                          className="text-base font-bold text-[#171b35] leading-tight"
                        >
                          {position.title}
                        </h3>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {hasPublishedTallies && position.totalVotes !== undefined && position.totalVotes !== null && (
                        <span className="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold shadow-2xs">
                          {position.totalVotes} {position.totalVotes === 1 ? "vote" : "votes"} cast
                        </span>
                      )}
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                        {position.candidates.length} {position.candidates.length === 1 ? "Nominee" : "Nominees"}
                      </span>
                    </div>
                  </div>

                  {/* Candidates & Tallies List */}
                  {position.candidates.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No approved candidates registered for this position.
                    </div>
                  ) : (
                    <div className="p-5 divide-y divide-slate-100">
                      {position.candidates.map((candidate) => {
                        const isExpanded = !!expandedManifestos[candidate.id];

                        return (
                          <div
                            key={candidate.id}
                            className="py-4 first:pt-0 last:pb-0 flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            {/* Candidate Identity */}
                            <div className="flex items-start gap-3.5">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center font-mono font-bold text-indigo-700 text-xs shrink-0">
                                #{candidate.id}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="text-sm font-bold text-slate-900">
                                    {candidate.candidate_name || `Candidate Record #${candidate.id}`}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    ● {candidate.approval_status}
                                  </span>

                                  {/* Certified Winner Badge if provided by API (Requirement 6) */}
                                  {candidate.is_winner && (
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 shadow-xs">
                                      🏆 Declared Winner
                                    </span>
                                  )}
                                </div>

                                <div className="text-xs text-slate-500 mt-0.5">
                                  {candidate.candidate_name ? (
                                    <span>
                                      Candidate <strong className="text-slate-700 font-mono">#{candidate.id}</strong> • Student <strong className="text-slate-700 font-mono">#{candidate.student_id}</strong>
                                    </span>
                                  ) : (
                                    <span>
                                      Student Reference ID: <strong className="text-slate-700 font-mono">Student #{candidate.student_id}</strong>
                                    </span>
                                  )}
                                </div>

                                {/* Manifesto preview */}
                                {candidate.manifesto && (
                                  <div className="mt-2 text-xs">
                                    <p className={`text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed ${isExpanded ? "" : "line-clamp-2"}`}>
                                      <span className="font-semibold text-slate-700 block text-[11px] mb-0.5">
                                        Platform Manifesto:
                                      </span>
                                      &quot;{candidate.manifesto}&quot;
                                    </p>
                                    {candidate.manifesto.length > 120 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleManifesto(candidate.id)}
                                        className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 mt-1"
                                      >
                                        {isExpanded ? "Show less" : "Read full manifesto →"}
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Vote Totals & Tally Metrics (Requirements 6 & 9: Only display when supported by backend) */}
                            <div className="md:text-right shrink-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl">
                              {hasPublishedTallies && candidate.votes !== null && candidate.votes !== undefined ? (
                                <div>
                                  <div className="text-base font-extrabold text-slate-900">
                                    {candidate.votes.toLocaleString()} votes
                                  </div>
                                  {candidate.percentage !== null && candidate.percentage !== undefined && (
                                    <div className="text-xs font-semibold text-purple-700">
                                      {candidate.percentage.toFixed(1)}% of ballots
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="text-xs text-slate-500 space-y-0.5">
                                  <div className="font-medium text-slate-700 flex md:justify-end items-center gap-1">
                                    <span className="text-slate-400">🔒</span>
                                    <span>Tally Sealed</span>
                                  </div>
                                  <span className="text-[11px] text-slate-400 block">
                                    {activeElection?.status === "closed"
                                      ? "Tabulation pending audit"
                                      : "Ballots not yet audited"}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Position Summary Footer */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                    <div>
                      Contest Status:{" "}
                      <strong className="text-slate-700 font-semibold">
                        {position.candidates.length >= 2 ? "Contested Election" : position.candidates.length === 1 ? "Single Candidate" : "Uncontested (No Nominees)"}
                      </strong>
                    </div>

                    <div className="text-[11px] text-slate-400">
                      Audit Ledger: Verified via FastAPI & PostgreSQL
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {/* Official Audit Certification & Signatures Certificate (Print / PDF Ready) */}
          {hasPublishedTallies && activeElection && (
            <div className="mt-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-xs print:border-black print:p-8">
              <div className="border-b border-slate-200 pb-3 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-800">
                    Official Election Tally Certification Certificate
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Certified outcomes for Election #{activeElection.id} — {activeElection.title}
                  </p>
                </div>
                <div className="text-right">
                  <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">
                    AUDIT SEALED
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-600 mb-6 leading-relaxed">
                This document certifies that the vote tallies recorded herein have been verified against the PostgreSQL cryptographic ballot ledger. Each ballot represents a unique, verified student voter participation receipt decoupled from individual ballot choices.
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-6 border-t border-slate-100">
                <div className="border-t border-dashed border-slate-400 pt-2 text-xs">
                  <span className="font-bold text-slate-800 block">Chief Election Commissioner</span>
                  <span className="text-[11px] text-slate-500">SmartVote Collegiate Governance Committee</span>
                </div>
                <div className="border-t border-dashed border-slate-400 pt-2 text-xs sm:text-right">
                  <span className="font-bold text-slate-800 block">Dean of Student Affairs / Observer</span>
                  <span className="text-[11px] text-slate-500">Institutional Audit & Ethics Board</span>
                </div>
              </div>
            </div>
          )}

          {/* Institutional Compliance Notice */}
          <div className="mt-8 p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-600 text-center leading-relaxed">
            <span className="font-semibold text-slate-800">SmartVote Cryptographic Election Governance:</span>{" "}
            All ballots are cast using anonymized student participation receipts (<code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-[11px]">voter_participation</code>) and encrypted ballot records (<code className="bg-slate-200/80 px-1 py-0.5 rounded font-mono text-[11px]">votes</code>).
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            Loading election results portal...
          </div>
        </div>
      }
    >
      <ResultsView />
    </Suspense>
  );
}
