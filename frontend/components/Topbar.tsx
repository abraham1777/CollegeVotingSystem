"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";

interface TopbarProps {
  activeSection: string;
  isApiConnected: boolean;
  onRefresh: () => void;
  isRefreshing: boolean;
  onOpenMobileMenu?: () => void;
}

export default function Topbar({
  activeSection,
  isApiConnected,
  onRefresh,
  isRefreshing,
  onOpenMobileMenu,
}: TopbarProps) {
  const { user, isAuthenticated, isAdmin, isStudent, logout } = useAuth();

  return (
    <header className="topbar">
      <div className="flex items-center gap-3">
        {onOpenMobileMenu && (
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="p-1.5 text-slate-600 hover:text-slate-900 md:hidden border border-slate-200 rounded-lg"
            aria-label="Open navigation sidebar"
          >
            ☰
          </button>
        )}

        <div className="breadcrumbs">
          Workspace <span>/</span> <strong>{activeSection}</strong>
        </div>
      </div>

      <div className="top-actions">
        {/* Backend Connectivity Status */}
        <div
          className={`flex items-center gap-2 text-xs font-semibold px-2.5 py-1 rounded-full ${
            isApiConnected
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-rose-50 text-rose-700 border border-rose-200"
          }`}
          role="status"
          aria-live="polite"
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isApiConnected ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
            }`}
            aria-hidden="true"
          />
          <span className="hidden sm:inline">
            {isApiConnected ? "FastAPI Connected" : "API Offline"}
          </span>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-[#eaecf2] rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
          aria-label="Refresh election data"
          title="Refresh data from API"
        >
          <span
            className={`inline-block text-sm ${
              isRefreshing ? "animate-spin" : ""
            }`}
            aria-hidden="true"
          >
            ↻
          </span>
          <span className="hidden sm:inline">
            {isRefreshing ? "Refreshing..." : "Sync"}
          </span>
        </button>

        {/* User / Authentication Status (Requirements 1, 2, 3) */}
        {isAuthenticated && user ? (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            {isStudent && (
              <Link
                href="/student/vote"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-lg transition-colors shadow-xs"
              >
                <span>🗳️ Vote Now</span>
              </Link>
            )}

            <div className="hidden lg:flex flex-col text-right leading-tight">
              <span className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                {user.full_name || user.email}
              </span>
              <span className="text-[10px] uppercase tracking-wider font-semibold text-purple-700">
                {isAdmin ? "Admin" : isStudent ? "Student Voter" : user.role}
              </span>
            </div>

            <div
              className="avatar small-avatar"
              title={`Logged in as ${user.full_name || user.email} (${user.role})`}
              aria-label={`User Avatar: ${user.full_name || user.email}`}
            >
              {(user.full_name || user.email || "U").charAt(0).toUpperCase()}
            </div>

            <button
              type="button"
              onClick={logout}
              className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors ml-1"
              title="Sign out of current session"
            >
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
            <Link
              href="/student/login"
              className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs"
            >
              Student Login
            </Link>
            <Link
              href="/login"
              className="px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 border border-slate-200 rounded-lg transition-colors"
            >
              Admin
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
