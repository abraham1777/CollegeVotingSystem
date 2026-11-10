"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { checkApiHealth, fetchElections, ApiHealthResult, API_URL } from "@/lib/api";
import { formatKolkataDateTime } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AuthBanner from "@/components/AuthBanner";

type SectionTab = "all" | "account" | "appearance" | "api" | "security" | "about";

export default function SettingsPage() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();

  // State
  const [healthResult, setHealthResult] = useState<ApiHealthResult | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [isTestingApi, setIsTestingApi] = useState<boolean>(false);
  const [electionCount, setElectionCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<SectionTab>("all");
  const [error, setError] = useState<string>("");

  // Initial data loading using React 19 pattern
  useEffect(() => {
    let ignore = false;

    async function initialFetch() {
      try {
        const [health, elections] = await Promise.all([
          checkApiHealth(),
          fetchElections().catch(() => []),
        ]);
        if (!ignore) {
          setHealthResult(health);
          setElectionCount(elections.length);
          setError("");
        }
      } catch (err) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not retrieve system configuration data."
          );
        }
      } finally {
        if (!ignore) {
          setLoadingHealth(false);
        }
      }
    }

    initialFetch();

    return () => {
      ignore = true;
    };
  }, []);

  // Re-check / Refresh handler
  const handleRefresh = useCallback(async () => {
    setIsTestingApi(true);
    try {
      const [health, elections] = await Promise.all([
        checkApiHealth(),
        fetchElections().catch(() => []),
      ]);
      setHealthResult(health);
      setElectionCount(elections.length);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "API connection test encountered an error."
      );
    } finally {
      setIsTestingApi(false);
    }
  }, []);

  const shouldShow = (tab: SectionTab) => activeTab === "all" || activeTab === tab;

  return (
    <main className="smartvote">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection="Settings"
        electionCount={electionCount}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Panel */}
      <section className="main-panel">
        {/* Topbar */}
        <Topbar
          activeSection="Settings"
          isApiConnected={healthResult?.isHealthy ?? true}
          onRefresh={handleRefresh}
          isRefreshing={isTestingApi}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          {/* Security & Authentication Notice */}
          <AuthBanner />

          {/* Page Heading (Requirement 4) */}
          <section className="welcome-row" aria-label="Settings Header">
            <div>
              <div className="eyebrow">SMARTVOTE · APPLICATION & ACCOUNT GOVERNANCE</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171b35] tracking-tight">
                Settings
              </h1>
              <p className="muted text-xs text-slate-500 max-w-2xl leading-relaxed">
                Manage administrator account profile, monitor live backend and PostgreSQL database connectivity, review cryptographic security policies, and inspect SmartVote platform environment settings.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isTestingApi}
                className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs disabled:opacity-50"
              >
                <span className={isTestingApi ? "animate-spin" : ""}>↻</span>
                {isTestingApi ? "Testing Connection..." : "Test Health Check"}
              </button>
            </div>
          </section>

          {/* Section Filter Pills */}
          <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1" aria-label="Settings Sections">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1 shrink-0">
              Jump To:
            </span>
            {(
              [
                { id: "all", label: "All Settings" },
                { id: "account", label: "Account" },
                { id: "appearance", label: "Appearance" },
                { id: "api", label: "API Connection" },
                { id: "security", label: "Security" },
                { id: "about", label: "About SmartVote" },
              ] as const
            ).map((tab) => {
              const isSelected = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors shrink-0 border ${
                    isSelected
                      ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Error Banner with Retry (Requirement 9) */}
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
                  <strong>Health Check Notice:</strong> {error}
                </div>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg text-xs transition-colors shrink-0"
              >
                Retry Check
              </button>
            </div>
          )}

          <div className="space-y-6">
            {/* SECTION 1: ACCOUNT (Requirement 5) */}
            {shouldShow("account") && (
              <article
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                aria-labelledby="section-account-title"
              >
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                      👤
                    </div>
                    <div>
                      <h2 id="section-account-title" className="text-base font-bold text-[#171b35] leading-tight">
                        Account & Authentication Profile
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Current administrator profile and institutional authorization status.
                      </p>
                    </div>
                  </div>

                  {isAuthenticated ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                      ● Signed In
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 text-xs font-semibold">
                      ○ Guest Session
                    </span>
                  )}
                </div>

                <div className="p-6">
                  {isAuthenticated && user ? (
                    <div className="space-y-6">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4 pb-6 border-b border-slate-100">
                        <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 font-extrabold text-2xl flex items-center justify-center shadow-xs">
                          {(user.full_name || user.email || "A").charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-bold text-slate-900">
                              {user.full_name || "SmartVote Administrator"}
                            </h3>
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 uppercase tracking-wider">
                              {user.role}
                            </span>
                            {isAdmin && (
                              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                ★ Server Administrator
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-1">{user.email}</p>
                          <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                            PostgreSQL Record ID: #{user.id}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Account Status
                          </span>
                          <span className="font-semibold text-slate-800 text-xs flex items-center gap-1.5 mt-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            {user.is_active ? "Active & Authorized" : "Inactive"}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Authorization Level
                          </span>
                          <span className="font-semibold text-slate-800 text-xs block mt-1">
                            {isAdmin ? "Full Administrative Governance" : "Standard Student Voter"}
                          </span>
                        </div>

                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Session Security
                          </span>
                          <span className="font-semibold text-slate-800 text-xs block mt-1">
                            30-Min Inactivity Auto-Expiry
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-wrap items-center gap-3">
                        <button
                          type="button"
                          onClick={logout}
                          className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
                        >
                          Sign Out of Session
                        </button>
                        <Link
                          href="/login"
                          className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition-colors"
                        >
                          Re-authenticate or Switch Account
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-xl border border-slate-200 text-center">
                      <div className="w-12 h-12 mx-auto rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xl font-bold mb-3">
                        🔒
                      </div>
                      <h3 className="text-sm font-bold text-slate-800">
                        Guest Academic Session
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto leading-relaxed">
                        You are currently viewing SmartVote in unauthenticated read-only mode. Creating elections, managing candidacies, and editing configurations require administrator sign-in.
                      </p>
                      <div className="mt-4">
                        <Link
                          href="/login?returnUrl=/settings"
                          className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors inline-block shadow-xs"
                        >
                          Administrator Sign In →
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* SECTION 2: APPEARANCE (Requirements 5 & 8) */}
            {shouldShow("appearance") && (
              <article
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                aria-labelledby="section-appearance-title"
              >
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                      🎨
                    </div>
                    <div>
                      <h2 id="section-appearance-title" className="text-base font-bold text-[#171b35] leading-tight">
                        Appearance & Display
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Visual themes, typography standards, and accessibility compliance.
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                    Standard Academic
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  {/* Theme Information Card (No nonfunctional toggle per requirement 5 & 8) */}
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          Institutional Light Theme
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                        SmartVote enforces a standardized, high-contrast academic light theme calibrated for institutional computer labs, administrative desks, and accessible voting kiosks.
                      </p>
                    </div>

                    <div className="text-xs text-slate-500 shrink-0 bg-white px-3 py-2 rounded-lg border border-slate-200">
                      Standard: <strong className="text-slate-800">WCAG AA Compliant</strong>
                    </div>
                  </div>

                  {/* Informational Policy on Theme Customization (Requirement 8) */}
                  <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                    <span className="text-base text-amber-600 font-bold shrink-0">ℹ</span>
                    <div>
                      <strong>Theme Customization Status:</strong> Dark mode and custom color profiles are intentionally disabled in this deployment to prevent visual ballot discrepancies during supervised college voting. Custom palette management is scheduled for a future governance release.
                    </div>
                  </div>

                  {/* Color Palette Swatches */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-3">
                      Standard Design Palette
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="w-full h-8 rounded-lg bg-[#f6f7fb] border border-slate-200 mb-2" />
                        <span className="font-semibold text-xs text-slate-800 block">Canvas</span>
                        <span className="text-[11px] font-mono text-slate-400">#f6f7fb</span>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="w-full h-8 rounded-lg bg-[#6857e8] mb-2" />
                        <span className="font-semibold text-xs text-slate-800 block">Primary Purple</span>
                        <span className="text-[11px] font-mono text-slate-400">#6857e8</span>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="w-full h-8 rounded-lg bg-[#171b35] mb-2" />
                        <span className="font-semibold text-xs text-slate-800 block">Navy Heading</span>
                        <span className="text-[11px] font-mono text-slate-400">#171b35</span>
                      </div>
                      <div className="p-3 rounded-xl border border-slate-200 bg-white">
                        <div className="w-full h-8 rounded-lg bg-[#239665] mb-2" />
                        <span className="font-semibold text-xs text-slate-800 block">Emerald Verified</span>
                        <span className="text-[11px] font-mono text-slate-400">#239665</span>
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* SECTION 3: API CONNECTION (Requirement 5) */}
            {shouldShow("api") && (
              <article
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                aria-labelledby="section-api-title"
              >
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                      🔌
                    </div>
                    <div>
                      <h2 id="section-api-title" className="text-base font-bold text-[#171b35] leading-tight">
                        API Connection & Health Status
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Live telemetry from the FastAPI backend and PostgreSQL database.
                      </p>
                    </div>
                  </div>

                  {loadingHealth ? (
                    <span className="text-xs text-slate-400">Probing...</span>
                  ) : healthResult?.isHealthy ? (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Healthy
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Offline
                    </span>
                  )}
                </div>

                <div className="p-6">
                  {loadingHealth ? (
                    <div className="space-y-3 animate-pulse">
                      <div className="h-10 bg-slate-100 rounded-lg" />
                      <div className="h-10 bg-slate-100 rounded-lg" />
                    </div>
                  ) : (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* API Base URL */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Backend API URL
                          </span>
                          <span className="font-mono font-semibold text-slate-800 text-xs block mt-1 truncate" title={API_URL}>
                            {API_URL}
                          </span>
                        </div>

                        {/* FastAPI Engine Status */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            FastAPI Status (/health)
                          </span>
                          <span className="font-semibold text-xs block mt-1">
                            {healthResult?.isHealthy ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                ● {healthResult.status.toUpperCase()}
                              </span>
                            ) : (
                              <span className="text-rose-700 flex items-center gap-1">
                                ✖ {healthResult?.status || "Unreachable"}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* PostgreSQL Database Status */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            PostgreSQL DB (/health/database)
                          </span>
                          <span className="font-semibold text-xs block mt-1">
                            {healthResult?.database?.connected ? (
                              <span className="text-emerald-700 flex items-center gap-1">
                                ● Connected ({healthResult.database.name || "smartvote_db"})
                              </span>
                            ) : (
                              <span className="text-amber-700 flex items-center gap-1">
                                ▲ {healthResult?.database?.status || "Not connected"}
                              </span>
                            )}
                          </span>
                        </div>

                        {/* Round-trip Latency */}
                        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                            Round-Trip Latency
                          </span>
                          <span className="font-semibold text-slate-800 text-xs block mt-1">
                            {healthResult ? `${healthResult.latencyMs} ms` : "—"}
                          </span>
                        </div>
                      </div>

                      {/* Diagnostic Summary & Probe Button */}
                      <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-100">
                        <div className="text-xs text-slate-500">
                          Last probed:{" "}
                          <strong className="text-slate-700">
                            {healthResult?.timestamp
                              ? formatKolkataDateTime(healthResult.timestamp, true)
                              : "Never"}
                          </strong>
                        </div>

                        <button
                          type="button"
                          onClick={handleRefresh}
                          disabled={isTestingApi}
                          className="px-4 py-2 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                        >
                          <span className={isTestingApi ? "animate-spin" : ""}>↻</span>
                          {isTestingApi ? "Ping in progress..." : "Ping API & Re-check"}
                        </button>
                      </div>

                      {/* If API is offline, provide clear troubleshooting steps */}
                      {healthResult && !healthResult.isHealthy && (
                        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 leading-relaxed">
                          <strong className="block mb-1 text-rose-800">Troubleshooting Offline Backend:</strong>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Verify that the FastAPI uvicorn process is running on port 8000: <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">uvicorn main:app --port 8000</code></li>
                            <li>Check that PostgreSQL is active and accessible via the connection string in <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">backend/.env</code>.</li>
                            <li>Confirm CORS allows requests from <code className="bg-rose-100 px-1 py-0.5 rounded font-mono">http://localhost:3000</code>.</li>
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </article>
            )}

            {/* SECTION 4: SECURITY (Requirement 5) */}
            {shouldShow("security") && (
              <article
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                aria-labelledby="section-security-title"
              >
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                      🛡️
                    </div>
                    <div>
                      <h2 id="section-security-title" className="text-base font-bold text-[#171b35] leading-tight">
                        Security & Governance Architecture
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Cryptographic protection standards, zero-knowledge policies, and server authorization.
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                    ✓ Verified Architecture
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  {/* Security Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <h3 className="font-bold text-xs text-slate-900">
                          Server-Side Authorization Boundary
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Administrative operations (such as creating elections, modifying positions, or approving candidates) require verified JWT bearer tokens checked server-side by FastAPI’s <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">require_admin</code> dependency. Frontend buttons are visual conveniences only.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <h3 className="font-bold text-xs text-slate-900">
                          Zero-Knowledge Credential Privacy
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Passwords, JWT signing secrets, and database connection strings are never rendered in client DOM or stored in browser cache. Secrets reside exclusively in server environment files and are never logged or exposed.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <h3 className="font-bold text-xs text-slate-900">
                          Tab-Isolated Session Lifecycle
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Authentication tokens are managed strictly within browser <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">sessionStorage</code>, clearing immediately upon tab closure. Tokens enforce an automatic 30-minute expiration with clock-skew buffer protection.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-600" />
                        <h3 className="font-bold text-xs text-slate-900">
                          Ballot Secrecy & Receipt Anonymity
                        </h3>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Student participation receipts (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">voter_participation</code>) are cryptographically decoupled from secret ballot choice records (<code className="bg-slate-200 px-1 py-0.5 rounded text-[11px] font-mono">votes</code>) to prevent ballot tracing.
                      </p>
                    </div>
                  </div>
                </div>
              </article>
            )}

            {/* SECTION 5: ABOUT SMARTVOTE (Requirement 5) */}
            {shouldShow("about") && (
              <article
                className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
                aria-labelledby="section-about-title"
              >
                <div className="p-5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-sm shadow-xs">
                      ℹ️
                    </div>
                    <div>
                      <h2 id="section-about-title" className="text-base font-bold text-[#171b35] leading-tight">
                        About SmartVote
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Software platform metadata, technology stack, and academic licensing.
                      </p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-xs font-semibold">
                    v1.0 Academic
                  </span>
                </div>

                <div className="p-6 space-y-4">
                  <div className="p-4 rounded-xl bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-100">
                    <h3 className="text-sm font-bold text-slate-900 mb-1">
                      SmartVote — Secure & Intelligent College Election Management System
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      Engineered for collegiate and departmental governance, SmartVote delivers verifiable digital voting, candidate lifecycle review, and sealed cryptographic tally auditing.
                    </p>
                  </div>

                  {/* Metadata Table */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-white">
                      <span className="font-semibold text-slate-500">Frontend Application</span>
                      <span className="sm:col-span-2 text-slate-800 font-mono">Next.js 16.4.1 (React 19.3.0, TypeScript 5, Tailwind CSS v4)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-50/60">
                      <span className="font-semibold text-slate-500">Backend Engine</span>
                      <span className="sm:col-span-2 text-slate-800 font-mono">FastAPI v1.0.0 (ASGI, Python 3.12, Uvicorn)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-white">
                      <span className="font-semibold text-slate-500">Database Engine</span>
                      <span className="sm:col-span-2 text-slate-800 font-mono">PostgreSQL (smartvote_db via SQLAlchemy ORM)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-slate-50/60">
                      <span className="font-semibold text-slate-500">Timezone Specification</span>
                      <span className="sm:col-span-2 text-slate-800">Asia/Kolkata (IST, UTC+5:30)</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 p-3 bg-white">
                      <span className="font-semibold text-slate-500">System Architecture</span>
                      <span className="sm:col-span-2 text-slate-800">Decoupled App Router Client + Secure RESTful Micro-services</span>
                    </div>
                  </div>
                </div>
              </article>
            )}
          </div>

          {/* Institutional Compliance Notice */}
          <div className="mt-8 p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-600 text-center leading-relaxed">
            <span className="font-semibold text-slate-800">SmartVote Governance:</span>{" "}
            System settings and connection parameters reflect verified live telemetry from the university cluster. No credentials or secrets are accessible via client interfaces.
          </div>
        </div>
      </section>
    </main>
  );
}

