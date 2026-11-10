"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import {
  fetchEligibleStudents,
  uploadRosterCsv,
  addSingleEligibleStudent,
  fetchDepartments,
  EligibleStudentDetail,
  DepartmentItem,
  BulkUploadResult,
} from "@/lib/api";
import { formatKolkataDateTime } from "@/lib/utils";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AuthBanner from "@/components/AuthBanner";

function RosterView() {
  const { token, isAdmin } = useAuth();

  // State
  const [students, setStudents] = useState<EligibleStudentDetail[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  // Filters
  const [search, setSearch] = useState<string>("");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [claimFilter, setClaimFilter] = useState<string>("all");

  // Modals
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);
  const [showAddModal, setShowAddModal] = useState<boolean>(false);

  // Bulk Upload Form
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [uploadResult, setUploadResult] = useState<BulkUploadResult | null>(null);

  // Single Add Form
  const [addCollegeId, setAddCollegeId] = useState("");
  const [addFullName, setAddFullName] = useState("");
  const [addDeptId, setAddDeptId] = useState<number>(1);
  const [addSemester, setAddSemester] = useState<number>(1);
  const [addingSingle, setAddingSingle] = useState(false);
  const [addError, setAddError] = useState("");

  const loadData = useCallback(async () => {
    if (!token || !isAdmin) {
      setLoading(false);
      return;
    }

    try {
      const [rosterData, deptsData] = await Promise.all([
        fetchEligibleStudents(token),
        fetchDepartments().catch(() => []),
      ]);
      setStudents(rosterData);
      setDepartments(deptsData);
      if (deptsData.length > 0) {
        setAddDeptId(deptsData[0].id);
      }
      setError("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not retrieve student eligibility roster from backend."
      );
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    let ignore = false;

    async function init() {
      if (!token || !isAdmin) {
        if (!ignore) setLoading(false);
        return;
      }

      try {
        const [rosterData, deptsData] = await Promise.all([
          fetchEligibleStudents(token),
          fetchDepartments().catch(() => []),
        ]);
        if (!ignore) {
          setStudents(rosterData);
          setDepartments(deptsData);
          if (deptsData.length > 0) {
            setAddDeptId(deptsData[0].id);
          }
          setError("");
        }
      } catch (err: unknown) {
        if (!ignore) {
          setError(
            err instanceof Error
              ? err.message
              : "Could not retrieve student eligibility roster from backend."
          );
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      ignore = true;
    };
  }, [token, isAdmin]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadData();
  };

  // Filtered students
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !search ||
        s.college_id.toLowerCase().includes(q) ||
        s.full_name.toLowerCase().includes(q);

      const matchesDept =
        departmentFilter === "all" ||
        s.department_id.toString() === departmentFilter ||
        s.department_name?.toLowerCase() === departmentFilter.toLowerCase();

      const matchesClaim =
        claimFilter === "all" ||
        (claimFilter === "claimed" && s.claimed_by_user_id !== null) ||
        (claimFilter === "unclaimed" && s.claimed_by_user_id === null);

      return matchesSearch && matchesDept && matchesClaim;
    });
  }, [students, search, departmentFilter, claimFilter]);

  // Roster Metrics
  const metrics = useMemo(() => {
    const total = students.length;
    const claimed = students.filter((s) => s.claimed_by_user_id !== null).length;
    const unclaimed = total - claimed;
    const rate = total > 0 ? ((claimed / total) * 100).toFixed(1) : "0";
    return { total, claimed, unclaimed, rate };
  }, [students]);

  // Handle CSV Upload
  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !token) return;

    setUploading(true);
    setUploadResult(null);
    try {
      const result = await uploadRosterCsv(selectedFile, token);
      setUploadResult(result);
      if (result.added > 0) {
        loadData();
      }
    } catch (err: unknown) {
      setUploadResult({
        success: false,
        message: err instanceof Error ? err.message : "Failed to process CSV file.",
        total_processed: 0,
        added: 0,
        skipped: 0,
        errors: [],
      });
    } finally {
      setUploading(false);
    }
  };

  // Download Sample CSV
  const handleDownloadTemplate = () => {
    const csvContent =
      "college_id,full_name,department,semester\nSTU-2026-101,Aarav Patel,1,4\nSTU-2026-102,Diya Sharma,Computer Science,2\nSTU-2026-103,Rohan Nair,Electronics,6\n";
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "smartvote_roster_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle Single Student Add
  const handleAddSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAddError("");

    if (!addCollegeId.trim() || !addFullName.trim()) {
      setAddError("College ID and Full Name are required.");
      return;
    }

    setAddingSingle(true);
    try {
      await addSingleEligibleStudent(
        {
          college_id: addCollegeId.trim(),
          full_name: addFullName.trim(),
          department_id: addDeptId,
          semester: Number(addSemester),
        },
        token
      );
      setAddCollegeId("");
      setAddFullName("");
      setShowAddModal(false);
      loadData();
    } catch (err: unknown) {
      setAddError(
        err instanceof Error ? err.message : "Failed to add student to roster."
      );
    } finally {
      setAddingSingle(false);
    }
  };

  return (
    <main className="smartvote">
      {/* Sidebar Navigation */}
      <Sidebar
        activeSection="Roster"
        electionCount={0}
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Panel */}
      <section className="main-panel">
        <Topbar
          activeSection="Voter Roster"
          isApiConnected={!error}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
          onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
        />

        <div className="content">
          <AuthBanner />

          {/* Heading */}
          <section className="welcome-row" aria-label="Roster Header">
            <div>
              <div className="eyebrow">SMARTVOTE · STUDENT ELIGIBILITY GOVERNANCE</div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-[#171b35] tracking-tight">
                Voter Eligibility Roster
              </h1>
              <p className="muted text-xs text-slate-500 max-w-2xl">
                Upload institutional student rosters, inspect voter registration claims, and ensure one-student one-vote integrity.
              </p>
            </div>

            {isAdmin && (
              <div className="flex items-center gap-2.5 flex-wrap">
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Download preformatted CSV roster template"
                >
                  📥 Sample CSV
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-3.5 py-2 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors cursor-pointer"
                >
                  ＋ Add Student
                </button>

                <button
                  type="button"
                  onClick={() => setShowBulkModal(true)}
                  className="primary-button"
                >
                  <span>⬆</span> Bulk Upload CSV
                </button>
              </div>
            )}
          </section>

          {/* Non-Admin Access Gate */}
          {!isAdmin && (
            <div className="mb-6 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs">
              <strong className="block text-sm font-bold mb-1">
                🔒 Administrator Authorization Required
              </strong>
              Student voter roster governance contains privileged institutional enrollment data. Only certified election administrators with valid JWT credentials can inspect or upload rosters.
              <div className="mt-3">
                <Link
                  href="/login?returnUrl=/roster"
                  className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-semibold rounded-lg text-xs transition-colors inline-block"
                >
                  Sign In as Administrator →
                </Link>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div
              className="p-4 mb-6 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between shadow-xs"
              role="alert"
            >
              <span>⚠ {error}</span>
              <button
                type="button"
                onClick={handleRefresh}
                className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-xs"
              >
                Retry
              </button>
            </div>
          )}

          {isAdmin && (
            <>
              {/* Roster Metrics Strip */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Total Eligible Students
                  </span>
                  <div className="text-2xl font-extrabold text-[#171b35] mt-1">
                    {loading ? "..." : metrics.total}
                  </div>
                  <span className="text-[10px] text-slate-500 mt-0.5 block">
                    Institutional roster records
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 block">
                    Claimed & Registered
                  </span>
                  <div className="text-2xl font-extrabold text-emerald-700 mt-1">
                    {loading ? "..." : metrics.claimed}
                  </div>
                  <span className="text-[10px] text-emerald-600/80 mt-0.5 block">
                    Active voting accounts
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-amber-600 block">
                    Pending Registration
                  </span>
                  <div className="text-2xl font-extrabold text-amber-700 mt-1">
                    {loading ? "..." : metrics.unclaimed}
                  </div>
                  <span className="text-[10px] text-amber-600/80 mt-0.5 block">
                    Awaiting student claim
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 block">
                    Voter Roll Claim Rate
                  </span>
                  <div className="text-2xl font-extrabold text-purple-700 mt-1">
                    {loading ? "..." : `${metrics.rate}%`}
                  </div>
                  <span className="text-[10px] text-purple-600/80 mt-0.5 block">
                    Participation readiness
                  </span>
                </div>
              </div>

              {/* Roster Filter Bar */}
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs mb-6 flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="w-full md:w-72">
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by ID or Name..."
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-400">Dept:</span>
                    <select
                      value={departmentFilter}
                      onChange={(e) => setDepartmentFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all">All Departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id.toString()}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="font-semibold text-slate-400">Status:</span>
                    <select
                      value={claimFilter}
                      onChange={(e) => setClaimFilter(e.target.value)}
                      className="px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
                    >
                      <option value="all">All Records</option>
                      <option value="claimed">Claimed (Active)</option>
                      <option value="unclaimed">Unclaimed</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Roster Table */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Showing <strong className="text-slate-800">{filteredStudents.length}</strong> of{" "}
                    {students.length} students
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Database Table: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">eligible_students</code>
                  </span>
                </div>

                {loading ? (
                  <div className="p-12 text-center text-xs text-slate-400">
                    <span className="animate-spin inline-block mr-2">↻</span> Loading voter roster...
                  </div>
                ) : filteredStudents.length === 0 ? (
                  <div className="p-12 text-center text-xs text-slate-500">
                    No eligible students match your filter criteria.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50/70 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="py-3 px-4">College ID</th>
                          <th className="py-3 px-4">Full Name</th>
                          <th className="py-3 px-4">Department</th>
                          <th className="py-3 px-4">Semester</th>
                          <th className="py-3 px-4">Voter Registration Status</th>
                          <th className="py-3 px-4">Claimed At (IST)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredStudents.map((s) => {
                          const isClaimed = s.claimed_by_user_id !== null;
                          return (
                            <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                              <td className="py-3 px-4 font-mono font-bold text-slate-900">
                                {s.college_id}
                              </td>
                              <td className="py-3 px-4 font-semibold text-slate-800">
                                {s.full_name}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                {s.department_name || `Dept #${s.department_id}`}
                              </td>
                              <td className="py-3 px-4 text-slate-600">
                                Sem {s.semester}
                              </td>
                              <td className="py-3 px-4">
                                {isClaimed ? (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    Claimed (User #{s.claimed_by_user_id})
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                    Unclaimed (Ready)
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-slate-500 text-[11px]">
                                {s.claimed_at ? formatKolkataDateTime(s.claimed_at, true) : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Bulk Upload Modal */}
          {showBulkModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>⬆</span> Bulk Upload Student Roster
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      setShowBulkModal(false);
                      setUploadResult(null);
                    }}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {uploadResult && (
                  <div
                    className={`p-3.5 rounded-xl text-xs ${
                      uploadResult.success
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                        : "bg-rose-50 border border-rose-200 text-rose-900"
                    }`}
                  >
                    <strong className="block mb-0.5">{uploadResult.message}</strong>
                    {uploadResult.errors.length > 0 && (
                      <ul className="list-disc list-inside mt-1 space-y-0.5 text-[11px]">
                        {uploadResult.errors.map((e, idx) => (
                          <li key={idx}>{e}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <form onSubmit={handleBulkSubmit} className="space-y-4">
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Upload a <code>.csv</code> file containing columns: <strong>college_id, full_name, department, semester</strong>.
                  </p>

                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-purple-500 transition-colors">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="text-xs text-slate-600"
                    />
                    {selectedFile && (
                      <p className="mt-2 text-xs font-semibold text-purple-700">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowBulkModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Close
                    </button>

                    <button
                      type="submit"
                      disabled={!selectedFile || uploading}
                      className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      {uploading ? "Processing CSV..." : "Upload & Ingest Roster"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Single Add Modal */}
          {showAddModal && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
              role="dialog"
              aria-modal="true"
            >
              <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <span>＋</span> Add Eligible Student
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                  >
                    ✕
                  </button>
                </div>

                {addError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
                    {addError}
                  </div>
                )}

                <form onSubmit={handleAddSingle} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      College ID / Roll Number
                    </label>
                    <input
                      type="text"
                      required
                      value={addCollegeId}
                      onChange={(e) => setAddCollegeId(e.target.value)}
                      placeholder="e.g. STU-2026-050"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={addFullName}
                      onChange={(e) => setAddFullName(e.target.value)}
                      placeholder="e.g. Ananya Sen"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Department
                      </label>
                      <select
                        value={addDeptId}
                        onChange={(e) => setAddDeptId(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Semester
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        required
                        value={addSemester}
                        onChange={(e) => setAddSemester(Number(e.target.value))}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-3">
                    <button
                      type="button"
                      onClick={() => setShowAddModal(false)}
                      className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingSingle}
                      className="px-5 py-2 bg-purple-700 hover:bg-purple-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors"
                    >
                      {addingSingle ? "Adding..." : "Add to Roster"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default function RosterPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center text-sm text-slate-600">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
            Loading voter eligibility roster...
          </div>
        </div>
      }
    >
      <RosterView />
    </Suspense>
  );
}
