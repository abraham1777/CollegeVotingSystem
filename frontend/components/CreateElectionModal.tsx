"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createElection, createPosition } from "@/lib/api";
import { getAdminToken } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { FIVE_CORE_DEPARTMENTS, STANDARD_POSITION_OPTIONS } from "@/lib/constants";

interface CreateElectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export default function CreateElectionModal({
  isOpen,
  onClose,
  onCreated,
}: CreateElectionModalProps) {
  const { user, token: ctxToken, isAdmin, login, logout } = useAuth();

  // Form fields
  const [department, setDepartment] = useState("ALL");
  const [selectedPositions, setSelectedPositions] = useState<string[]>([
    "President",
    "Vice President",
    "General Secretary",
    "Department Student Representative",
  ]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");

  // Admin credentials state (if not already authenticated)
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");

  // Status feedback
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    setServerError(null);
    setSuccessMessage(null);
    setFieldErrors({});
    onClose();
  }, [onClose]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        handleClose();
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleClose]);

  if (!isOpen || !isAdmin) return null;

  // Client-side validation (Requirement 7)
  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    if (!title.trim()) {
      errors.title = "Election title is required.";
    } else if (title.trim().length < 3) {
      errors.title = "Title must have at least 3 characters.";
    } else if (title.trim().length > 200) {
      errors.title = "Title cannot exceed 200 characters.";
    }

    if (!startsAt) {
      errors.startsAt = "Start date and time are required.";
    }

    if (!endsAt) {
      errors.endsAt = "End date and time are required.";
    }

    if (startsAt && endsAt) {
      const startDate = new Date(startsAt);
      const endDate = new Date(endsAt);

      if (isNaN(startDate.getTime())) {
        errors.startsAt = "Invalid start time format.";
      }
      if (isNaN(endDate.getTime())) {
        errors.endsAt = "Invalid end time format.";
      }
      if (endDate <= startDate) {
        errors.endsAt = "Election end time must be strictly later than start time.";
      }
    }

    // If not authenticated yet as admin, validate credentials
    if (!isAdmin || !ctxToken) {
      if (!adminEmail.trim()) {
        errors.adminEmail = "Administrator email is required.";
      }
      if (!adminPassword) {
        errors.adminPassword = "Administrator password is required.";
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setSuccessMessage(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);

    try {
      let token = ctxToken;

      // If no valid session token exists, authenticate first
      if (!token || !isAdmin) {
        await login(adminEmail.trim(), adminPassword);
        token = getAdminToken();
        if (!token) {
          throw new Error("Authentication failed to establish an active session token.");
        }
      }

      // Convert datetime-local to ISO-8601 strings
      const startIso = new Date(startsAt).toISOString();
      const endIso = new Date(endsAt).toISOString();

      let department_id: number | null = null;
      if (department !== "ALL") {
        const foundDept = FIVE_CORE_DEPARTMENTS.find((d) => d.id === department);
        if (foundDept) {
          department_id = foundDept.deptId;
        }
      }

      const created = await createElection(
        {
          title: title.trim(),
          description: description.trim() || null,
          department_id,
          starts_at: startIso,
          ends_at: endIso,
        },
        token
      );

      // Automatically create all selected standard positions for this election
      for (const posTitle of selectedPositions) {
        try {
          await createPosition(created.id, posTitle, token);
        } catch {
          // Ignore duplicate
        }
      }

      setSuccessMessage(
        `Election #${created.id} ("${created.title}") created with ${selectedPositions.length} configured position(s) in Draft status!`
      );

      // Reset fields
      setTitle("");
      setDescription("");
      setStartsAt("");
      setEndsAt("");
      setFieldErrors({});

      // Notify parent to refresh election list (Requirement 9)
      if (onCreated) {
        onCreated();
      }

      // Automatically close modal after brief delay
      setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (err) {
      setServerError(
        err instanceof Error
          ? err.message
          : "An unexpected error occurred while communicating with the server."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
          <div>
            <span className="text-[11px] font-mono font-bold tracking-wider text-indigo-600 uppercase">
              SmartVote Election Authority
            </span>
            <h2 id="create-modal-title" className="text-xl font-bold text-[#171b35]">
              Create New Election
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Success Banner */}
          {successMessage && (
            <div
              role="alert"
              className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2.5 font-medium animate-in fade-in"
            >
              <span className="text-base">✓</span>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Server Error Banner */}
          {serverError && (
            <div
              role="alert"
              className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start gap-2.5 leading-relaxed"
            >
              <span className="text-base text-rose-500 font-bold">⚠</span>
              <div>
                <strong>Election creation error:</strong>
                <p className="mt-0.5">{serverError}</p>
              </div>
            </div>
          )}

          {/* Department Selection */}
          <div>
            <label
              htmlFor="election-dept-select"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Academic Department <span className="text-slate-400 font-normal">(5 Core Programs)</span>
            </label>
            <select
              id="election-dept-select"
              value={department}
              onChange={(e) => {
                const val = e.target.value;
                setDepartment(val);
                if (val !== "ALL") {
                  const d = FIVE_CORE_DEPARTMENTS.find((dept) => dept.id === val);
                  if (d && (!title || title.includes("Student Association") || title.includes("Council"))) {
                    setTitle(`${d.name} Department Student Council Elections 2026`);
                  }
                }
              }}
              className="w-full px-3.5 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] font-semibold text-slate-800"
            >
              <option value="ALL">🏛️ All Departments (College-wide General Council)</option>
              {FIVE_CORE_DEPARTMENTS.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.icon} {dept.fullName}
                </option>
              ))}
            </select>
          </div>

          {/* Title Field */}
          <div>
            <label
              htmlFor="election-title-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Election Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="election-title-input"
              type="text"
              required
              minLength={3}
              maxLength={200}
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => ({ ...prev, title: "" }));
                }
              }}
              placeholder="e.g. Student Council General Election 2026"
              className={`w-full px-3.5 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] transition-colors ${
                fieldErrors.title
                  ? "border-rose-300 bg-rose-50/30"
                  : "border-slate-200"
              }`}
              aria-invalid={!!fieldErrors.title}
              aria-describedby={fieldErrors.title ? "title-error" : undefined}
            />
            {fieldErrors.title && (
              <p id="title-error" className="text-rose-600 text-xs mt-1">
                {fieldErrors.title}
              </p>
            )}
          </div>

          {/* Description Field */}
          <div>
            <label
              htmlFor="election-desc-input"
              className="block text-xs font-bold text-slate-700 mb-1"
            >
              Description <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="election-desc-input"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, candidate requirements, or eligibility criteria..."
              className="w-full px-3.5 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8]"
            />
          </div>

          {/* Contested Position Options (Preset rather than entering manually) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-slate-700">
                Contested Position Options <span className="text-rose-500">*</span>
              </label>
              <span className="text-[11px] text-purple-700 font-bold">
                {selectedPositions.length} position{selectedPositions.length === 1 ? "" : "s"} selected
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2">
              Select standard positions to automatically create on this election ballot:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 bg-purple-50/40 border border-purple-200 rounded-xl max-h-48 overflow-y-auto">
              {STANDARD_POSITION_OPTIONS.map((pos) => {
                const isChecked = selectedPositions.includes(pos);
                return (
                  <label
                    key={pos}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? "bg-white border-purple-300 text-purple-900 font-bold shadow-2xs"
                        : "bg-white/60 border-slate-200 text-slate-600 hover:bg-white"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedPositions((prev) => [...prev, pos]);
                        } else {
                          setSelectedPositions((prev) => prev.filter((p) => p !== pos));
                        }
                      }}
                      className="w-3.5 h-3.5 rounded text-purple-600 border-slate-300 focus:ring-purple-500"
                    />
                    <span className="truncate">{pos}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Schedule Fields (Requirement 7) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="starts-at-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Starts At (Asia/Kolkata) <span className="text-rose-500">*</span>
              </label>
              <input
                id="starts-at-input"
                type="datetime-local"
                required
                value={startsAt}
                onChange={(e) => {
                  setStartsAt(e.target.value);
                  if (fieldErrors.startsAt) {
                    setFieldErrors((prev) => ({ ...prev, startsAt: "" }));
                  }
                }}
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] ${
                  fieldErrors.startsAt
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-slate-200"
                }`}
                aria-invalid={!!fieldErrors.startsAt}
              />
              {fieldErrors.startsAt && (
                <p className="text-rose-600 text-xs mt-1">{fieldErrors.startsAt}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="ends-at-input"
                className="block text-xs font-bold text-slate-700 mb-1"
              >
                Ends At (Asia/Kolkata) <span className="text-rose-500">*</span>
              </label>
              <input
                id="ends-at-input"
                type="datetime-local"
                required
                value={endsAt}
                onChange={(e) => {
                  setEndsAt(e.target.value);
                  if (fieldErrors.endsAt) {
                    setFieldErrors((prev) => ({ ...prev, endsAt: "" }));
                  }
                }}
                className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] ${
                  fieldErrors.endsAt
                    ? "border-rose-300 bg-rose-50/30"
                    : "border-slate-200"
                }`}
                aria-invalid={!!fieldErrors.endsAt}
              />
              {fieldErrors.endsAt && (
                <p className="text-rose-600 text-xs mt-1">{fieldErrors.endsAt}</p>
              )}
            </div>
          </div>

          {/* Administrator Authentication Section (Security & Data Integrity) */}
          <div className="pt-3 border-t border-slate-100">
            {isAdmin && user ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Authorized Admin: <strong>{user.full_name || user.email}</strong> ({user.email})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={logout}
                  className="text-emerald-700 hover:text-emerald-900 underline font-medium"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-600 font-bold">🔒</span>
                    <span className="text-xs font-bold text-slate-800">
                      Administrator Authorization Required
                    </span>
                  </div>
                  <Link
                    href="/login"
                    className="text-[11px] font-semibold text-purple-700 hover:underline"
                  >
                    Go to Login Page →
                  </Link>
                </div>
                <p className="text-[11px] text-slate-500 leading-normal">
                  FastAPI endpoint <code>POST /elections</code> requires an administrator bearer token. Sign in below or use the login portal.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label
                      htmlFor="admin-email-input"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Admin Email <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="admin-email-input"
                      type="email"
                      value={adminEmail}
                      onChange={(e) => {
                        setAdminEmail(e.target.value);
                        if (fieldErrors.adminEmail) {
                          setFieldErrors((prev) => ({ ...prev, adminEmail: "" }));
                        }
                      }}
                      placeholder="admin@college.edu"
                      className={`w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] ${
                        fieldErrors.adminEmail
                          ? "border-rose-300 bg-rose-50/30"
                          : "border-slate-200 bg-white"
                      }`}
                    />
                    {fieldErrors.adminEmail && (
                      <p className="text-rose-600 text-[11px] mt-0.5">
                        {fieldErrors.adminEmail}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="admin-password-input"
                      className="block text-[11px] font-semibold text-slate-700 mb-1"
                    >
                      Admin Password <span className="text-rose-500">*</span>
                    </label>
                    <input
                      id="admin-password-input"
                      type="password"
                      value={adminPassword}
                      onChange={(e) => {
                        setAdminPassword(e.target.value);
                        if (fieldErrors.adminPassword) {
                          setFieldErrors((prev) => ({ ...prev, adminPassword: "" }));
                        }
                      }}
                      placeholder="••••••••••••"
                      className={`w-full px-3 py-1.5 text-xs border rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6857e8] ${
                        fieldErrors.adminPassword
                          ? "border-rose-300 bg-rose-50/30"
                          : "border-slate-200 bg-white"
                      }`}
                    />
                    {fieldErrors.adminPassword && (
                      <p className="text-rose-600 text-[11px] mt-0.5">
                        {fieldErrors.adminPassword}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="text-[11px] text-slate-500 leading-relaxed">
            Note: Newly created elections start in <strong>draft</strong> status. Candidates and positions must be verified before opening voting to students.
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#6857e8] hover:bg-[#5847d1] rounded-lg transition-colors shadow-xs flex items-center gap-2 disabled:opacity-50"
            >
              {submitting && (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              )}
              <span>{submitting ? "Creating Election..." : "Create Election"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
