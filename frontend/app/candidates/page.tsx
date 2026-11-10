"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Election } from "@/types/election";
import { CandidateWithContext, Position } from "@/types/candidate";
import { fetchAllCandidatesWithContext, API_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import CandidateCard from "@/components/CandidateCard";
import ApprovalConfirmationModal from "@/components/ApprovalConfirmationModal";
import AddCandidateModal from "@/components/AddCandidateModal";
import AuthBanner from "@/components/AuthBanner";

export default function CandidatesPage() {
  const { isAdmin } = useAuth();
  const [candidates, setCandidates] = useState<CandidateWithContext[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Search & Filtering
  const [search, setSearch] = useState<string>("");
  const [selectedElectionId, setSelectedElectionId] = useState<string>("all");
  const [selectedPositionId, setSelectedPositionId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");

  // Approval & Nomination Modal state
  const [actionCandidate, setActionCandidate] = useState<CandidateWithContext | null>(null);
  const [actionTargetStatus, setActionTargetStatus] = useState<"approved" | "rejected" | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Load data using the actual backend endpoints
  const loadData = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const result = await fetchAllCandidatesWithContext();
      setCandidates(result.candidates);
      setElections(result.elections);
      setPositions(result.positions);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve candidate records from the backend API."
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      try {
        const result = await fetchAllCandidatesWithContext();
        if (!ignore) {
          setCandidates(result.candidates);
          setElections(result.elections);
          setPositions(result.positions);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not retrieve candidate records from the backend API."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, []);

  // Filter candidates
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      const query = search.toLowerCase().trim();

      const matchesSearch =
        !query ||
        c.id.toString().includes(query) ||
        c.student_id.toString().includes(query) ||
        c.position_title.toLowerCase().includes(query) ||
        c.election_title.toLowerCase().includes(query) ||
        (c.manifesto && c.manifesto.toLowerCase().includes(query));

      const matchesElection =
        selectedElectionId === "all" ||
        c.election_id.toString() === selectedElectionId;

      const matchesPosition =
        selectedPositionId === "all" ||
        c.position_id.toString() === selectedPositionId;

      const matchesStatus =
        statusFilter === "all" ||
        c.approval_status.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesElection && matchesPosition && matchesStatus;
    });
  }, [candidates, search, selectedElectionId, selectedPositionId, statusFilter]);

  // Dynamic counts
  const counts = useMemo(() => {
    return {
      total: candidates.length,
      approved: candidates.filter((c) => c.approval_status.toLowerCase() === "approved").length,
      pending: candidates.filter((c) => c.approval_status.toLowerCase() === "pending").length,
      rejected: candidates.filter((c) => c.approval_status.toLowerCase() === "rejected").length,
      contestedPositions: new Set(candidates.map((c) => c.position_id)).size,
    };
  }, [candidates]);

  // Trigger modal
  const handleInitiateApproval = (
    candidate: CandidateWithContext,
    targetStatus: "approved" | "rejected"
  ) => {
    setActionCandidate(candidate);
    setActionTargetStatus(targetStatus);
  };

  const handleApprovalSuccess = () => {
    setSuccessToast(
      `Candidate #${actionCandidate?.id} status was successfully updated to "${actionTargetStatus}".`
    );
    loadData(true);
    setTimeout(() => {
      setSuccessToast(null);
    }, 4000);
  };

  return (
    <main className="smartvote">
      {/* Sidebar */}
      <Sidebar
        activeSection="Candidates"
        electionCount={elections.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace */}
      <section className="main-panel">
        <Topbar
          activeSection="Candidates"
          isApiConnected={!error}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          {/* Security & Authentication Notice */}
          <AuthBanner />

          {/* Header */}
          <section className="welcome-row" aria-label="Candidates Page Header">
            <div>
              <div className="eyebrow">SMARTVOTE · CANDIDACY GOVERNANCE</div>
              <h1>Candidate Management</h1>
              <p className="muted">
                Inspect candidate nominations, contest associations, and administrative approvals synchronized from PostgreSQL.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isAdmin ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(true)}
                    className="primary-button"
                  >
                    <span>＋</span> Nominate Candidate
                  </button>
                  <Link
                    href="/elections"
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  >
                    Manage Elections →
                  </Link>
                </>
              ) : (
                <Link
                  href="/student/vote"
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#6857e8] rounded-lg hover:bg-[#5b4cdb] transition-colors shadow-2xs"
                >
                  🗳️ Vote Now →
                </Link>
              )}
            </div>
          </section>

          {/* Backend Contract & Schema Transparency Notice (Important Requirement) */}
          <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl text-xs text-indigo-950 mb-6 space-y-1.5 leading-relaxed">
            <div className="flex items-center gap-2 font-bold text-indigo-900">
              <span>ℹ</span>
              <span>Backend Contract & Schema Documentation</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-indigo-800">
              <li>
                <strong>Student Identification:</strong> The <code>CandidateResponse</code> Pydantic schema returns <code>student_id</code> (Foreign Key to <code>students.id</code>). Per database design, student records are referenced by institutional ID.
              </li>
              <li>
                <strong>Listing Scope:</strong> In the current backend, candidates are registered under positions (<code>GET /positions/&#123;id&#125;/candidates</code>), which filters for approved nominees. Candidates for all active positions are aggregated above.
              </li>
              <li>
                <strong>Approval Governance:</strong> <code>PATCH /candidates/&#123;id&#125;/approval</code> requires an authenticated administrator and enforces that candidates can only be reviewed while the associated election is in <strong>Draft</strong> status.
              </li>
            </ul>
          </div>

          {/* Success Toast */}
          {successToast && (
            <div
              role="alert"
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center justify-between mb-6 animate-in fade-in"
            >
              <div className="flex items-center gap-2 font-medium">
                <span className="text-base">✓</span>
                <span>{successToast}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessToast(null)}
                className="text-emerald-600 hover:text-emerald-800 font-bold"
              >
                ✕
              </button>
            </div>
          )}

          {/* Statistics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" role="group" aria-label="Candidate statistics">
            <div className="p-3 bg-white border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Nominees
              </span>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {loading ? "—" : counts.total.toString().padStart(2, "0")}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Across all positions
              </span>
            </div>

            <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl">
              <span className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider block">
                Approved Candidates
              </span>
              <div className="text-2xl font-bold text-emerald-800 mt-1">
                {loading ? "—" : counts.approved.toString().padStart(2, "0")}
              </div>
              <span className="text-[10px] text-emerald-600 mt-0.5 block">
                Eligible for student voting
              </span>
            </div>

            <div className="p-3 bg-indigo-50/50 border border-indigo-200 rounded-xl">
              <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider block">
                Contested Positions
              </span>
              <div className="text-2xl font-bold text-indigo-800 mt-1">
                {loading ? "—" : counts.contestedPositions.toString().padStart(2, "0")}
              </div>
              <span className="text-[10px] text-indigo-600 mt-0.5 block">
                With registered candidates
              </span>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
                Elections Tracked
              </span>
              <div className="text-2xl font-bold text-slate-800 mt-1">
                {loading ? "—" : elections.length.toString().padStart(2, "0")}
              </div>
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                In PostgreSQL registry
              </span>
            </div>
          </div>

          {/* Search and Filters Section */}
          <section className="elections-section mb-6" aria-label="Search and Filter Candidates">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              {/* Search Bar */}
              <div className="flex-1 max-w-md">
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search candidate ID, student ID, position, manifesto..."
                    aria-label="Search candidates"
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="text-xs text-slate-400 hover:text-slate-600 font-bold px-1"
                      aria-label="Clear search query"
                    >
                      ✕
                    </button>
                  )}
                </label>
              </div>

              {/* View toggle */}
              <div
                className="flex items-center p-1 bg-slate-100 rounded-lg text-xs self-start md:self-auto"
                role="group"
                aria-label="Switch display view"
              >
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    viewMode === "grid"
                      ? "bg-white text-slate-800 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  aria-pressed={viewMode === "grid"}
                >
                  ⊞ Cards
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                    viewMode === "table"
                      ? "bg-white text-slate-800 shadow-2xs font-bold"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                  aria-pressed={viewMode === "table"}
                >
                  ☰ Table
                </button>
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100 text-xs">
              {/* Election Filter */}
              <div>
                <label htmlFor="filter-election" className="block text-[11px] font-bold text-slate-600 mb-1">
                  Filter by Election:
                </label>
                <select
                  id="filter-election"
                  value={selectedElectionId}
                  onChange={(e) => {
                    setSelectedElectionId(e.target.value);
                    setSelectedPositionId("all");
                  }}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#6857e8]"
                >
                  <option value="all">All Elections ({elections.length})</option>
                  {elections.map((elec) => (
                    <option key={elec.id} value={elec.id.toString()}>
                      #{elec.id} - {elec.title} ({elec.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Position Filter */}
              <div>
                <label htmlFor="filter-position" className="block text-[11px] font-bold text-slate-600 mb-1">
                  Filter by Position:
                </label>
                <select
                  id="filter-position"
                  value={selectedPositionId}
                  onChange={(e) => setSelectedPositionId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#6857e8]"
                >
                  <option value="all">All Positions ({positions.length})</option>
                  {positions
                    .filter(
                      (p) =>
                        selectedElectionId === "all" ||
                        p.election_id.toString() === selectedElectionId
                    )
                    .map((pos) => (
                      <option key={pos.id} value={pos.id.toString()}>
                        #{pos.id} - {pos.title} (Election #{pos.election_id})
                      </option>
                    ))}
                </select>
              </div>

              {/* Approval Status Filter */}
              <div>
                <label htmlFor="filter-status" className="block text-[11px] font-bold text-slate-600 mb-1">
                  Approval Status:
                </label>
                <select
                  id="filter-status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-[#6857e8]"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending">Pending</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Clear filters banner */}
            {(search || selectedElectionId !== "all" || selectedPositionId !== "all" || statusFilter !== "all") && (
              <div className="flex items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                <span className="text-slate-500">
                  Showing <strong>{filteredCandidates.length}</strong> matching candidates
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedElectionId("all");
                    setSelectedPositionId("all");
                    setStatusFilter("all");
                  }}
                  className="font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  Reset All Filters
                </button>
              </div>
            )}
          </section>

          {/* Error State with Retry Button */}
          {error && (
            <div
              role="alert"
              className="my-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <span className="text-base leading-none text-rose-500 font-bold" aria-hidden="true">
                  ⚠
                </span>
                <div>
                  <strong>Failed to synchronize candidates:</strong>
                  <p className="mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadData()}
                className="self-start sm:self-auto px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div
              className="elections-section py-16 flex flex-col items-center justify-center gap-3 text-center"
              aria-live="polite"
            >
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-[#6857e8] rounded-full animate-spin" />
              <p className="font-semibold text-slate-700 text-sm">
                Aggregating candidates from elections & contested positions...
              </p>
              <p className="text-xs text-slate-400">
                Contacting backend at <code>{API_URL}</code>
              </p>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredCandidates.length === 0 && (
            <div className="elections-section py-16 text-center" role="status">
              <div className="text-4xl mb-3 text-slate-300">👥</div>
              <h3 className="text-base font-bold text-slate-800">
                {search || selectedElectionId !== "all" || selectedPositionId !== "all" || statusFilter !== "all"
                  ? "No candidates match the specified filters"
                  : "No candidate records retrieved"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                {search || selectedElectionId !== "all" || selectedPositionId !== "all" || statusFilter !== "all"
                  ? "Try adjusting your search terms or clearing the election and position filters."
                  : "Candidates registered under contested positions in draft elections will appear here."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setSelectedElectionId("all");
                    setSelectedPositionId("all");
                    setStatusFilter("all");
                  }}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Grid View */}
          {!loading && !error && filteredCandidates.length > 0 && viewMode === "grid" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list">
              {filteredCandidates.map((candidate) => (
                <CandidateCard
                  key={candidate.id}
                  candidate={candidate}
                  isAdmin={isAdmin}
                  onUpdateApproval={handleInitiateApproval}
                />
              ))}
            </div>
          )}

          {/* Table View */}
          {!loading && !error && filteredCandidates.length > 0 && viewMode === "table" && (
            <div className="elections-section overflow-hidden p-0 border border-slate-200 rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th scope="col" className="py-3 px-4">Candidate ID</th>
                      <th scope="col" className="py-3 px-4">Student Reference</th>
                      <th scope="col" className="py-3 px-4">Position</th>
                      <th scope="col" className="py-3 px-4">Election</th>
                      <th scope="col" className="py-3 px-4">Election Status</th>
                      <th scope="col" className="py-3 px-4">Approval</th>
                      {isAdmin && <th scope="col" className="py-3 px-4 text-right">Review Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredCandidates.map((c) => {
                      const isDraft = c.election_status.toLowerCase() === "draft";
                      const isApproved = c.approval_status.toLowerCase() === "approved";
                      return (
                        <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-600">
                            #{c.id}
                          </td>
                          <td className="py-3.5 px-4 font-mono text-slate-700">
                            Student #{c.student_id}
                          </td>
                          <td className="py-3.5 px-4 font-medium text-slate-800">
                            {c.position_title}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700">
                            <span className="font-semibold block">{c.election_title}</span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Election #{c.election_id}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded ${
                                isDraft
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              }`}
                            >
                              ● {c.election_status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`status text-[10px] font-semibold ${
                                isApproved
                                  ? "status-voting-open"
                                  : c.approval_status === "rejected"
                                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                                  : "status-upcoming"
                              }`}
                            >
                              {c.approval_status}
                            </span>
                          </td>
                          {isAdmin && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              {isApproved ? (
                                <button
                                  type="button"
                                  disabled={!isDraft}
                                  onClick={() => handleInitiateApproval(c, "rejected")}
                                  className="px-2.5 py-1 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-md hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={
                                    isDraft
                                      ? "Reject candidate nomination"
                                      : "Locked: Election is not in Draft"
                                  }
                                >
                                  Reject
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={!isDraft}
                                  onClick={() => handleInitiateApproval(c, "approved")}
                                  className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={
                                    isDraft
                                      ? "Approve candidate nomination"
                                      : "Locked: Election is not in Draft"
                                  }
                                >
                                  Approve
                                </button>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Footer */}
          <footer className="footer mt-8">
            <span>SmartVote · Candidate Nomination & Governance Registry</span>
            <span>
              <span className="footer-dot" aria-hidden="true">
                ●
              </span>
              Connected to FastAPI ({API_URL})
            </span>
          </footer>
        </div>
      </section>

      {/* Confirmation Dialog for Approval / Rejection Action */}
      {isAdmin && (
        <ApprovalConfirmationModal
          candidate={actionCandidate}
          targetStatus={actionTargetStatus}
          onClose={() => {
            setActionCandidate(null);
            setActionTargetStatus(null);
          }}
          onSuccess={handleApprovalSuccess}
        />
      )}

      {/* Nominate Candidate Dialog (Admin Only) */}
      {isAdmin && (
        <AddCandidateModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onCandidateAdded={() => loadData(true)}
          elections={elections}
        />
      )}
    </main>
  );
}

