"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { Election, ElectionStats } from "@/types/election";
import { fetchElections, API_URL } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import StatsOverview from "@/components/StatsOverview";
import ElectionList from "@/components/ElectionList";
import ElectionDetailModal from "@/components/ElectionDetailModal";
import CreateElectionModal from "@/components/CreateElectionModal";
import AuthBanner from "@/components/AuthBanner";

export default function Home() {
  const { isAdmin, isStudent } = useAuth();
  const [active, setActive] = useState<string>("Dashboard");
  const [elections, setElections] = useState<Election[]>([]);
  const [search, setSearch] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [selectedElection, setSelectedElection] = useState<Election | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Requirement 1 & 4: Fetch elections from the backend with reliable retry logic
  const handleReload = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
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
          : "Could not establish connection with FastAPI backend."
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
              : "Could not establish connection with FastAPI backend."
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

  // Requirement 2: Calculate election statistics dynamically from API data
  const stats: ElectionStats = useMemo(() => {
    return {
      total: elections.length,
      open: elections.filter((e) => e.status.toLowerCase() === "open").length,
      draft: elections.filter((e) => e.status.toLowerCase() === "draft").length,
      closed: elections.filter((e) => e.status.toLowerCase() === "closed").length,
    };
  }, [elections]);

  return (
    <main className="smartvote">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection={active}
        onSelectSection={setActive}
        electionCount={elections.length}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Administrative Workspace */}
      <section className="main-panel">
        {/* Topbar with Synchronized Status */}
        <Topbar
          activeSection={active}
          isApiConnected={!error}
          onRefresh={() => handleReload(true)}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          {/* Authentication & Security Notice */}
          <AuthBanner />

          {/* Welcome Header & Primary Actions */}
          <section className="welcome-row" aria-label="Dashboard Header">
            <div>
              <div className="eyebrow">
                {isAdmin
                  ? "SMARTVOTE · ACADEMIC ADMINISTRATION"
                  : isStudent
                  ? "SMARTVOTE · STUDENT VOTER PORTAL"
                  : "SMARTVOTE · COLLEGE ELECTIONS"}
              </div>
              <h1>
                {isStudent && active === "Dashboard"
                  ? "Student Election Portal"
                  : active === "Dashboard"
                  ? "Election Dashboard"
                  : active === "Elections"
                  ? "Manage College Elections"
                  : active}
              </h1>
              <p className="muted">
                {isStudent
                  ? "Explore active college elections, discover approved candidates, and cast confidential secret ballots."
                  : "Secure, tamper-evident election governance portal for college ballot management."}
              </p>
            </div>

            {/* Create-election action ONLY for administrators */}
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
                className="primary-button bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 shadow-xs transition-colors"
              >
                <span>🗳️</span> Go to Voting Ballots →
              </Link>
            )}

            {!isAdmin && !isStudent && (
              <div className="flex items-center gap-2">
                <Link
                  href="/student/login"
                  className="primary-button bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs px-3.5 py-2 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <span>🎓</span> Student Sign In
                </Link>
                <Link
                  href="/login"
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                >
                  Admin Portal →
                </Link>
              </div>
            )}
          </section>

          {/* Live Student Voting Callout (Requirements 1 & 2) */}
          {stats.open > 0 && (
            <div className="mb-6 p-5 rounded-2xl bg-gradient-to-r from-purple-700 to-indigo-800 text-white shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] uppercase tracking-wider font-extrabold text-purple-200">
                    Live College Election Voting Open
                  </span>
                </div>
                <h2 className="text-lg font-bold tracking-tight text-white">
                  Cast Your Ballot in {stats.open} Active Election{stats.open === 1 ? "" : "s"}
                </h2>
                <p className="text-xs text-purple-100/90 mt-0.5 max-w-xl">
                  Official voting is currently in progress. Authenticate with your student credentials to review candidate manifestos and cast confidential secret ballots.
                </p>
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <Link
                  href="/student/vote"
                  className="px-4 py-2 bg-white hover:bg-slate-50 text-purple-900 font-bold text-xs rounded-xl transition-all shadow-xs"
                >
                  🗳️ Vote Now →
                </Link>
                <Link
                  href="/student/login"
                  className="px-3 py-2 bg-purple-600/60 hover:bg-purple-600 text-white font-semibold text-xs rounded-xl border border-white/20 transition-all"
                >
                  Student Login
                </Link>
              </div>
            </div>
          )}

          {/* Conditional View Rendering */}
          {active === "Dashboard" && (
            <>
              {/* Dynamic Stats Cards (Requirement 2 & 9) */}
              <StatsOverview stats={stats} loading={loading} />

              {/* Elections Overview List with Search & Filters (Requirements 1, 3, 4, 5, 6) */}
              <ElectionList
                elections={elections}
                loading={loading}
                error={error}
                onRetry={() => handleReload()}
                onViewDetails={(election) => setSelectedElection(election)}
                searchQuery={search}
                onSearchChange={setSearch}
              />
            </>
          )}

          {active === "Elections" && (
            <ElectionList
              elections={elections}
              loading={loading}
              error={error}
              onRetry={() => handleReload()}
              onViewDetails={(election) => setSelectedElection(election)}
              searchQuery={search}
              onSearchChange={setSearch}
            />
          )}

          {/* Dedicated Administration Placeholders for Non-Dashboard views */}
          {active !== "Dashboard" && active !== "Elections" && (
            <section className="elections-section" aria-label={`${active} Administration`}>
              <div className="section-heading">
                <div>
                  <h2>{active} Management</h2>
                  <p className="muted">
                    Module configuration for {active.toLowerCase()} in SmartVote election system.
                  </p>
                </div>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setActive("Dashboard")}
                >
                  ← Return to Dashboard
                </button>
              </div>

              <div className="empty-state py-12 text-center">
                <div className="text-3xl mb-2 text-indigo-400">⚙</div>
                <p className="font-semibold text-slate-800 text-sm">
                  {active} Portal Synchronized
                </p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {active === "Candidates"
                    ? "Candidate nominations and eligibility verification are managed per election."
                    : active === "Results"
                    ? "Cryptographic ballot tallying and audit reports are generated once elections close."
                    : "System parameters, cryptographic keys, and department cohorts are configured here."}
                </p>
                <button
                  type="button"
                  onClick={() => setActive("Dashboard")}
                  className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-[#6857e8] hover:bg-[#5847d1] rounded-lg transition-colors"
                >
                  Back to Dashboard Overview
                </button>
              </div>
            </section>
          )}

          {/* System Footer */}
          <footer className="footer">
            <span>SmartVote · Secure College Election Management System</span>
            <span>
              <span className="footer-dot" aria-hidden="true">
                ●
              </span>
              {error ? "API connection issue" : `Connected to FastAPI (${API_URL})`}
            </span>
          </footer>
        </div>
      </section>

      {/* View Election Details Modal */}
      <ElectionDetailModal
        election={selectedElection}
        onClose={() => setSelectedElection(null)}
      />

      {/* Create Election Modal (Admin Only) */}
      {isAdmin && (
        <CreateElectionModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => handleReload()}
        />
      )}
    </main>
  );
}
