"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

interface SidebarProps {
  activeSection?: string;
  onSelectSection?: (section: string) => void;
  electionCount: number;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  href: string;
  showCount?: boolean;
  adminOnly?: boolean;
}

const menuItems: MenuItem[] = [
  { id: "Dashboard", label: "Dashboard", icon: "▦", href: "/" },
  { id: "Elections", label: "Elections", icon: "◉", href: "/elections", showCount: true },
  { id: "Candidates", label: "Candidates", icon: "♙", href: "/candidates" },
  { id: "Roster", label: "Voter Roster", icon: "👥", href: "/roster", adminOnly: true },
  { id: "Results", label: "Results", icon: "▤", href: "/results" },
  { id: "Audit", label: "Audit Ledger", icon: "🛡️", href: "/audit", adminOnly: true },
  { id: "Settings", label: "Settings", icon: "⚙", href: "/settings", adminOnly: true },
];

export default function Sidebar({
  activeSection,
  onSelectSection,
  electionCount,
  isOpenMobile = false,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();
  const { user, isAuthenticated, isStudent, isAdmin, logout } = useAuth();

  const isItemActive = (item: (typeof menuItems)[0]) => {
    if (activeSection) {
      return activeSection.toLowerCase() === item.id.toLowerCase();
    }
    if (item.href === "/" && pathname === "/") return true;
    if (item.href !== "/" && pathname?.startsWith(item.href)) return true;
    return false;
  };

  const visibleMenuItems = menuItems.filter((item) => !item.adminOnly || isAdmin);

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          role="presentation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`sidebar ${isOpenMobile ? "open-mobile" : ""}`}
        aria-label="Main Navigation"
      >
        {/* Brand */}
        <div className="brand">
          <Link href="/" className="flex items-center gap-[11px] text-inherit no-underline">
            <div className="brand-icon" aria-hidden="true">
              S
            </div>
            <div>
              <strong>SmartVote</strong>
              <small>COLLEGE ELECTIONS</small>
            </div>
          </Link>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="ml-auto p-1.5 text-slate-400 hover:text-slate-600 md:hidden"
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        {/* Student Voter Section (Requirements 1 & 2) */}
        <div className="nav-label">STUDENT VOTER</div>
        <nav className="navigation mb-3" aria-label="Student Voter Navigation">
          <Link
            href="/student/vote"
            className={`nav-item ${pathname?.startsWith("/student/vote") ? "selected" : ""}`}
            onClick={() => {
              if (onCloseMobile) onCloseMobile();
            }}
            aria-current={pathname?.startsWith("/student/vote") ? "page" : undefined}
          >
            <span aria-hidden="true">🗳️</span>
            <span>Vote Now</span>
            <span className="ml-auto text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
              Live
            </span>
          </Link>

          {!isStudent && (
            <>
              <Link
                href="/student/login"
                className={`nav-item ${pathname === "/student/login" ? "selected" : ""}`}
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                }}
                aria-current={pathname === "/student/login" ? "page" : undefined}
              >
                <span aria-hidden="true">🎓</span>
                <span>Student Login</span>
              </Link>

              <Link
                href="/student/register"
                className={`nav-item ${pathname === "/student/register" ? "selected" : ""}`}
                onClick={() => {
                  if (onCloseMobile) onCloseMobile();
                }}
                aria-current={pathname === "/student/register" ? "page" : undefined}
              >
                <span aria-hidden="true">✍️</span>
                <span>Register to Vote</span>
              </Link>
            </>
          )}
        </nav>

        <div className="nav-label">{isAdmin ? "ADMINISTRATIVE WORKSPACE" : "ELECTIONS WORKSPACE"}</div>

        {/* Navigation list */}
        <nav className="navigation" aria-label={isAdmin ? "Administrative Views" : "Workspace Views"}>
          {visibleMenuItems.map((item) => {
            const isSelected = isItemActive(item);

            // If an onSelectSection callback was provided, we use a button if on same page, or Link
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`nav-item ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  if (onSelectSection) onSelectSection(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                aria-current={isSelected ? "page" : undefined}
              >
                <span aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
                {item.showCount && (
                  <span
                    className="nav-count"
                    aria-label={`${electionCount} elections loaded`}
                  >
                    {electionCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Security & Academic Footer */}
        <div className="sidebar-bottom">
          <div className="secure-badge" aria-hidden="true">
            ✓
          </div>
          <strong>Secure by design</strong>
          <p>One student. One vote. One voice. Protected by audit-verified ballots.</p>

          {/* User / Admin Profile */}
          <div className="user-profile">
            <div className="avatar" aria-hidden="true">
              {isAuthenticated && user
                ? (user.full_name || user.email || "U").charAt(0).toUpperCase()
                : "?"}
            </div>
            <div className="min-w-0 flex-1">
              <strong>
                {isAuthenticated && user
                  ? user.full_name || (isStudent ? "Student Voter" : "Administrator")
                  : "Guest Session"}
              </strong>
              <small>
                {isAuthenticated && user
                  ? `${user.role.toUpperCase()} • ${user.email}`
                  : "Not signed in"}
              </small>
            </div>
            {isAuthenticated ? (
              <button
                type="button"
                onClick={logout}
                className="profile-menu text-xs text-rose-600 hover:text-rose-800"
                title="Sign out of session"
                aria-label="Sign out"
              >
                ⎋
              </button>
            ) : (
              <div className="flex flex-col gap-0.5 text-right">
                <Link
                  href="/student/login"
                  className="text-[11px] font-semibold text-purple-700 hover:underline"
                  title="Sign in to Student Portal"
                >
                  Student Sign In
                </Link>
                <Link
                  href="/login"
                  className="text-[10px] text-slate-500 hover:text-slate-800"
                  title="Administrator Portal"
                >
                  Admin Portal
                </Link>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
