"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Election } from "@/types/election";
import { fetchElections, API_URL } from "@/lib/api";
import { formatKolkataDateTime } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import StatusBadge from "@/components/StatusBadge";
import ElectionCard from "@/components/ElectionCard";
import ElectionDetailModal from "@/components/ElectionDetailModal";
import CreateElectionModal from "@/components/CreateElectionModal";
import AuthBanner from "@/components/AuthBanner";
import { FIVE_CORE_DEPARTMENTS } from "@/lib/constants";

export default function ElectionsPage() {
  const { isAdmin, isStudent } = useAuth();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  // Filters & Search (Requirements 2, 4)
  const [search, setSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [sortBy, setSortBy] = useState<"id_desc" | "id_asc" | "title" | "starts_at">("id_desc");

  // Modals (Requirements 6, 8, 9)
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Requirement 1: Load elections using GET /elections
  const loadElections = useCallback(async (isManual = false) => {
    if (isManual) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await fetchElections();
      setElections(data);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve elections from the backend API."
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
        const data = await fetchElections();
        if (!ignore) {
          setElections(data);
          setError("");
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
          setLoading(false);
        }
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, []);

  // Compute status counts for the filter chips
  const counts = useMemo(() => {
    return {
      all: elections.length,
      open: elections.filter((e) => e.status.toLowerCase() === "open").length,
      draft: elections.filter((e) => e.status.toLowerCase() === "draft").length,
      closed: elections.filter((e) => e.status.toLowerCase() === "closed").length,
    };
  }, [elections]);

  // Requirement 2, 4 & 7: Filter and sort elections
  const filteredElections = useMemo(() => {
    const result = elections.filter((election) => {
      const query = search.toLowerCase().trim();
      const matchesSearch =
        !query ||
        election.title.toLowerCase().includes(query) ||
        (election.description && election.description.toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === "all" ||
        election.status.toLowerCase() === statusFilter.toLowerCase();

      const matchesDept =
        departmentFilter === "all" ||
        election.title.toLowerCase().includes(departmentFilter.toLowerCase()) ||
        (election.description &&
          election.description.toLowerCase().includes(departmentFilter.toLowerCase()));

      return matchesSearch && matchesStatus && matchesDept;
    });

    return result.sort((a, b) => {
      if (sortBy === "id_desc") return b.id - a.id;
      if (sortBy === "id_asc") return a.id - b.id;
      if (sortBy === "title") return a.title.localeCompare(b.title);
      if (sortBy === "starts_at") {
        return new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime();
      }
      return 0;
    });
  }, [elections, search, statusFilter, departmentFilter, sortBy]);

  return (
    <main className="smartvote">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection="Elections"
        electionCount={elections.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Panel */}
      <section className="main-panel">
        {/* Topbar */}
        <Topbar
          activeSection="Elections"
          isApiConnected={!error}
          onRefresh={() => loadElections(true)}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          {/* Security & Authentication Notice */}
          <AuthBanner />

          {/* Page Header */}
          <section className="welcome-row" aria-label="Elections Management Header">
            <div>
              <div className="eyebrow">
                {isAdmin ? "SMARTVOTE · ACADEMIC ADMINISTRATION" : "SMARTVOTE · COLLEGE ELECTIONS"}
              </div>
              <h1>Elections Management</h1>
              <p className="muted">
                {isAdmin
                  ? "Inspect, filter, and schedule college election processes powered by FastAPI and PostgreSQL."
                  : "Browse active and scheduled college elections and view positions up for election."}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
              >
                ← Back to Dashboard
              </Link>
              {/* Create Election Button (Admin Only) */}
              {isAdmin && (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setIsCreateModalOpen(true)}
                  aria-label="Create a new election"
                >
                  <span>＋</span> Create election
                </button>
              )}
              {isStudent && (
                <Link
                  href="/student/vote"
                  className="primary-button bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>🗳️</span> Vote Now
                </Link>
              )}
              {!isAdmin && !isStudent && (
                <Link
                  href="/student/vote"
                  className="primary-button bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>🗳️</span> Vote Now
                </Link>
              )}
            </div>
          </section>

          {/* Requirement 4: Dedicated Status Filter Pills / Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6" role="group" aria-label="Filter by election status">
            {[
              { id: "all", label: "All Elections", count: counts.all, color: "text-slate-800", bg: "bg-white", border: "border-slate-200" },
              { id: "open", label: "Open (Live)", count: counts.open, color: "text-emerald-700", bg: "bg-emerald-50/60", border: "border-emerald-200" },
              { id: "draft", label: "Draft (Pending)", count: counts.draft, color: "text-amber-700", bg: "bg-amber-50/60", border: "border-amber-200" },
              { id: "closed", label: "Closed (Concluded)", count: counts.closed, color: "text-slate-600", bg: "bg-slate-100/70", border: "border-slate-200" },
            ].map((tab) => {
              const isActive = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFilter(tab.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    isActive
                      ? "ring-2 ring-[#6857e8] border-[#6857e8] bg-white shadow-xs"
                      : `${tab.bg} ${tab.border} hover:border-slate-300`
                  }`}
                  aria-pressed={isActive}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      {tab.label}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[#6857e8]" />
                    )}
                  </div>
                  <div className={`text-2xl font-bold mt-1 ${tab.color}`}>
                    {loading ? "—" : tab.count.toString().padStart(2, "0")}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Academic Department Filter Bar (5 Core Programs) */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" role="group" aria-label="Filter elections by academic department">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
              <span>🏛️</span> Department:
            </span>
            <button
              type="button"
              onClick={() => setDepartmentFilter("all")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
                departmentFilter === "all"
                  ? "bg-[#6857e8] text-white border-[#6857e8] shadow-xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              All Departments
            </button>
            {FIVE_CORE_DEPARTMENTS.map((dept) => {
              const isSelected = departmentFilter === dept.code;
              return (
                <button
                  key={dept.id}
                  type="button"
                  onClick={() => setDepartmentFilter(dept.code)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1.5 shrink-0 ${
                    isSelected
                      ? "bg-[#6857e8] text-white border-[#6857e8] shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <span>{dept.icon}</span>
                  <span>{dept.name}</span>
                </button>
              );
            })}
          </div>

          {/* Search, Filter, Sort, and View Controls */}
          <section className="elections-section mb-6" aria-label="Search and Filter Controls">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              {/* Search Box (Requirement 2) */}
              <div className="flex-1 max-w-md">
                <label className="search-box">
                  <span aria-hidden="true">⌕</span>
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by title or description..."
                    aria-label="Search elections by title"
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

              {/* Secondary Controls: Sort & View Mode */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Sort selector */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span className="font-medium text-slate-400">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(
                        e.target.value as "id_desc" | "id_asc" | "title" | "starts_at"
                      )
                    }
                    className="px-2.5 py-1.5 text-xs bg-white border border-[#eaecf2] rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6857e8] font-medium text-slate-700"
                    aria-label="Sort election records"
                  >
                    <option value="id_desc">Newest First (ID ↓)</option>
                    <option value="id_asc">Oldest First (ID ↑)</option>
                    <option value="title">Title (A - Z)</option>
                    <option value="starts_at">Start Time</option>
                  </select>
                </div>

                {/* View toggle (Grid vs Table) */}
                <div
                  className="flex items-center p-1 bg-slate-100 rounded-lg text-xs"
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
                    title="Grid card view"
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
                    title="Table list view"
                  >
                    ☰ Table
                  </button>
                </div>

                {/* Reset Filters button */}
                {(search || statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Results Count & Current Active Filters Banner */}
            <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
              <div>
                Showing <strong>{filteredElections.length}</strong> of{" "}
                <strong>{elections.length}</strong> total elections
                {statusFilter !== "all" && (
                  <span>
                    {" "}
                    filtered by <code className="font-semibold text-slate-700">{statusFilter}</code>
                  </span>
                )}
                {search && (
                  <span>
                    {" "}
                    matching <code className="font-semibold text-slate-700">&quot;{search}&quot;</code>
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-400">
                Times displayed in Asia/Kolkata (IST)
              </span>
            </div>
          </section>

          {/* Requirement 5: Error State with Retry Button */}
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
                  <strong>Failed to synchronize election records:</strong>
                  <p className="mt-0.5 text-rose-700">{error}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => loadElections()}
                className="self-start sm:self-auto px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
              >
                Retry Connection
              </button>
            </div>
          )}

          {/* Requirement 5: Loading State */}
          {loading && (
            <div
              className="elections-section py-16 flex flex-col items-center justify-center gap-3 text-center"
              aria-live="polite"
            >
              <div className="w-8 h-8 border-3 border-indigo-200 border-t-[#6857e8] rounded-full animate-spin" />
              <p className="font-semibold text-slate-700 text-sm">
                Loading college election catalog...
              </p>
              <p className="text-xs text-slate-400">
                Contacting FastAPI at <code>{API_URL}</code>
              </p>
            </div>
          )}

          {/* Requirement 5: Empty State */}
          {!loading && !error && filteredElections.length === 0 && (
            <div className="elections-section py-16 text-center" role="status">
              <div className="text-4xl mb-3 text-slate-300">📋</div>
              <h3 className="text-base font-bold text-slate-800">
                {search
                  ? `No elections matching "${search}"`
                  : statusFilter !== "all"
                  ? `No elections in "${statusFilter}" status`
                  : "No elections found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                {search || statusFilter !== "all"
                  ? "Try clearing your search term or selecting 'All Elections' to see complete records."
                  : isAdmin
                  ? "Initialize your first college election using the Create Election button above."
                  : "There are currently no elections matching your criteria. Check back soon for upcoming ballots."}
              </p>
              <div className="mt-4 flex items-center justify-center gap-3">
                {(search || statusFilter !== "all") && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Clear Filters
                  </button>
                )}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(true)}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#6857e8] hover:bg-[#5847d1] rounded-lg shadow-xs"
                  >
                    Create Election
                  </button>
                ) : (
                  <Link
                    href="/student/vote"
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#6857e8] hover:bg-[#5847d1] rounded-lg shadow-xs"
                  >
                    Check Live Ballots
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Requirement 1, 3: Elections Display - Grid View */}
          {!loading && !error && filteredElections.length > 0 && viewMode === "grid" && (
            <div className="election-list" role="list">
              {filteredElections.map((election, index) => (
                <ElectionCard
                  key={election.id}
                  election={election}
                  index={index}
                  onViewDetails={(e) => setSelectedElection(e)}
                />
              ))}
            </div>
          )}

          {/* Requirement 1, 3: Elections Display - Table View */}
          {!loading && !error && filteredElections.length > 0 && viewMode === "table" && (
            <div className="elections-section overflow-hidden p-0 border border-slate-200 rounded-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                      <th scope="col" className="py-3 px-4">ID</th>
                      <th scope="col" className="py-3 px-4">Title & Description</th>
                      <th scope="col" className="py-3 px-4">Status</th>
                      <th scope="col" className="py-3 px-4">Start Time (IST)</th>
                      <th scope="col" className="py-3 px-4">End Time (IST)</th>
                      <th scope="col" className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {filteredElections.map((election) => {
                      return (
                        <tr
                          key={election.id}
                          className="hover:bg-slate-50/70 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-500">
                            #{election.id}
                          </td>
                          <td className="py-3.5 px-4">
                            <strong className="text-slate-800 block text-xs font-bold">
                              {election.title}
                            </strong>
                            <span className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                              {election.description || "No description provided."}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <StatusBadge status={election.status} />
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                            {formatKolkataDateTime(election.starts_at)}
                          </td>
                          <td className="py-3.5 px-4 text-slate-700 whitespace-nowrap">
                            {formatKolkataDateTime(election.ends_at)}
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setSelectedElection(election)}
                              className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                              aria-label={`View details for ${election.title}`}
                            >
                              View Details →
                            </button>
                          </td>
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
            <span>SmartVote · College Elections Administration Workspace</span>
            <span>
              <span className="footer-dot" aria-hidden="true">
                ●
              </span>
              Connected to FastAPI ({API_URL})
            </span>
          </footer>
        </div>
      </section>

      {/* View Election Details Modal */}
      <ElectionDetailModal
        election={selectedElection}
        onClose={() => setSelectedElection(null)}
      />

      {/* Create Election Modal Form (Admin Only) */}
      {isAdmin && (
        <CreateElectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => loadElections(true)}
        />
      )}
    </main>
  );
}
