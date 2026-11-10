"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import { Election } from "@/types/election";
import ElectionCard from "./ElectionCard";
import { FIVE_CORE_DEPARTMENTS } from "@/lib/constants";

interface ElectionListProps {
  elections: Election[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onViewDetails: (election: Election) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export default function ElectionList({
  elections,
  loading,
  error,
  onRetry,
  onViewDetails,
  searchQuery,
  onSearchChange,
}: ElectionListProps) {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");

  // Requirement 5: Search works against election titles & department filter
  const filteredElections = useMemo(() => {
    return elections.filter((election) => {
      const matchesSearch = election.title
        .toLowerCase()
        .includes(searchQuery.toLowerCase().trim());

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
  }, [elections, searchQuery, statusFilter, departmentFilter]);

  return (
    <section className="elections-section" aria-label="Elections Overview">
      {/* Section Heading */}
      <div className="section-heading">
        <div>
          <h2>Election Overview</h2>
          <p className="muted">
            Authenticated election records synchronized from PostgreSQL.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Status filter tabs */}
          <div
            className="hidden sm:flex items-center p-1 bg-slate-100 rounded-lg text-xs"
            role="group"
            aria-label="Filter by election status"
          >
            {[
              { id: "all", label: "All" },
              { id: "open", label: "Open" },
              { id: "draft", label: "Draft" },
              { id: "closed", label: "Closed" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusFilter(tab.id)}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === tab.id
                    ? "bg-white text-slate-800 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
                aria-pressed={statusFilter === tab.id}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="text-button"
            onClick={() => {
              setStatusFilter("all");
              onSearchChange("");
            }}
          >
            Reset Filters
          </button>

          <Link
            href="/elections"
            className="text-button inline-flex items-center gap-1 hover:underline ml-1"
          >
            Manage all →
          </Link>
        </div>
      </div>

      {/* Filter & Search Row (Requirement 5) */}
      <div className="filter-row">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search elections by title..."
            aria-label="Search elections by title"
          />
        </label>

        {searchQuery && (
          <button
            type="button"
            className="filter-button"
            onClick={() => onSearchChange("")}
            aria-label="Clear election search query"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* 5 Core Academic Department Filter Pills */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1" role="group" aria-label="Filter elections by department">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
          <span>🏛️</span> Program:
        </span>
        <button
          type="button"
          onClick={() => setDepartmentFilter("all")}
          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all shrink-0 ${
            departmentFilter === "all"
              ? "bg-[#6857e8] text-white border-[#6857e8] shadow-2xs"
              : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
          }`}
        >
          All Programs
        </button>
        {FIVE_CORE_DEPARTMENTS.map((dept) => {
          const isSelected = departmentFilter === dept.code;
          return (
            <button
              key={dept.id}
              type="button"
              onClick={() => setDepartmentFilter(dept.code)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all flex items-center gap-1 shrink-0 ${
                isSelected
                  ? "bg-[#6857e8] text-white border-[#6857e8] shadow-2xs"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              <span>{dept.icon}</span>
              <span>{dept.name}</span>
            </button>
          );
        })}
      </div>

      {/* Error State with Retry Button (Requirement 3 & 4) */}
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
            onClick={onRetry}
            className="self-start sm:self-auto px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs transition-colors"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Loading State (Requirement 3) */}
      {loading && (
        <div
          className="empty-state py-12 flex flex-col items-center justify-center gap-3"
          aria-live="polite"
        >
          <div className="w-8 h-8 border-3 border-indigo-200 border-t-[#6857e8] rounded-full animate-spin" />
          <p className="font-medium text-slate-600">
            Fetching college election records from FastAPI backend...
          </p>
        </div>
      )}

      {/* Empty State: No results found */}
      {!loading && !error && filteredElections.length === 0 && (
        <div className="empty-state py-12 text-center" role="status">
          <div className="text-3xl mb-2 text-slate-300">📋</div>
          <p className="font-semibold text-slate-700 text-sm">
            {searchQuery
              ? `No elections found matching "${searchQuery}"`
              : statusFilter !== "all"
              ? `No elections currently in "${statusFilter}" status`
              : "No election records available"}
          </p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery || statusFilter !== "all"
              ? "Try adjusting your search terms or clearing the status filter."
              : "New elections registered via the administration portal will appear here."}
          </p>
          {(searchQuery || statusFilter !== "all") && (
            <button
              type="button"
              onClick={() => {
                onSearchChange("");
                setStatusFilter("all");
              }}
              className="mt-4 px-3.5 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Reset Search & Filters
            </button>
          )}
        </div>
      )}

      {/* Election Overview List */}
      {!loading && !error && filteredElections.length > 0 && (
        <div className="election-list" role="list">
          {filteredElections.map((election, index) => (
            <ElectionCard
              key={election.id}
              election={election}
              index={index}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </section>
  );
}

