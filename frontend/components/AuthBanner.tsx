"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthBanner() {
  const pathname = usePathname();
  const { user, isAuthenticated, isAdmin, isStudent, sessionExpired, logout, clearSessionExpiredBanner } =
    useAuth();

  // If session expired
  if (sessionExpired) {
    return (
      <div
        className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-xs"
        role="alert"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base text-amber-600 font-bold" aria-hidden="true">
            ⚠️
          </span>
          <div>
            <strong>Session Expired:</strong> Your 30-minute security token has expired. Please sign in again to continue.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/student/login?returnUrl=${encodeURIComponent(pathname || "/")}`}
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-xs transition-colors"
          >
            Student Sign In
          </Link>
          <Link
            href={`/login?returnUrl=${encodeURIComponent(pathname || "/")}&expired=true`}
            className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg text-xs transition-colors"
          >
            Admin Sign In
          </Link>
          <button
            type="button"
            onClick={clearSessionExpiredBanner}
            className="p-1.5 text-amber-700 hover:text-amber-900 text-xs"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        </div>
      </div>
    );
  }

  // If not authenticated (Requirement 1: Clearly visible Student Login / Vote Now link)
  if (!isAuthenticated || !user) {
    return (
      <div className="mb-6 p-3.5 rounded-xl bg-slate-100/90 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-700 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-purple-600 text-sm font-semibold" aria-hidden="true">
            ℹ️
          </span>
          <div>
            <span className="font-semibold text-slate-800">Public Academic View:</span>{" "}
            Viewing public college election data. Students may authenticate to access confidential voting ballots.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/student/login?returnUrl=/student/vote"
            className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg text-xs transition-colors shadow-xs"
          >
            Student Login / Vote Now →
          </Link>
          <Link
            href={`/login?returnUrl=${encodeURIComponent(pathname || "/")}`}
            className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium rounded-lg text-xs transition-colors"
          >
            Admin Sign In
          </Link>
        </div>
      </div>
    );
  }

  // If authenticated as student voter (Requirement 2 & 3: Vote Now link & logout)
  if (isStudent) {
    return (
      <div className="mb-6 p-4 rounded-xl bg-purple-50/80 border border-purple-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-950 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <div>
            <strong>Student Voter Session:</strong> Signed in as{" "}
            <span className="font-semibold">{user.full_name || user.email}</span> ({user.email}). You are authorized to access ballots and cast confidential votes.
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/student/vote"
            className="px-3.5 py-1.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs transition-colors shadow-xs"
          >
            Vote Now →
          </Link>
          <button
            type="button"
            onClick={logout}
            className="px-2.5 py-1.5 bg-white border border-purple-200 hover:bg-purple-50 text-purple-800 rounded-lg text-xs font-semibold transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  // If authenticated as admin
  if (isAdmin) {
    return (
      <div className="mb-6 px-4 py-2.5 rounded-xl bg-purple-50/70 border border-purple-100 flex items-center justify-between text-xs text-purple-900">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            <strong>Administrator Mode:</strong> Authorized as{" "}
            <span className="font-semibold">{user.full_name || user.email}</span> ({user.email}). Server-side authorization active via FastAPI <code className="bg-purple-100/80 px-1 py-0.5 rounded text-[11px]">require_admin</code>.
          </span>
        </div>
        <span className="text-[11px] text-purple-700 hidden md:inline">
          Session Token: 30m Expiry
        </span>
      </div>
    );
  }

  // Authenticated as other non-admin role
  return (
    <div className="mb-6 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between text-xs text-amber-900">
      <div className="flex items-center gap-2">
        <span className="text-amber-600 font-bold">⚠️</span>
        <span>
          Signed in as <strong>{user.email}</strong> with role <strong>{user.role}</strong>. Administrative operations require an administrator account.
        </span>
      </div>
      <Link
        href="/login"
        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded text-xs"
      >
        Switch Account
      </Link>
    </div>
  );
}

