"use client";

import React, { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Election } from "@/types/election";
import { Position, Candidate } from "@/types/candidate";
import {
  fetchElections,
  fetchPositions,
  fetchCandidatesForPosition,
  castVote,
} from "@/lib/api";
import {
  getStudentToken,
  getAdminToken,
  fetchCurrentUser,
  removeStudentToken,
  removeAdminToken,
  AuthUser,
} from "@/lib/auth";
import { formatKolkataDateTime } from "@/lib/utils";

interface PositionWithCandidates extends Position {
  candidates: Candidate[];
}

function StudentVoteContent() {
  const router = useRouter();

  // Authentication state
  const [student, setStudent] = useState<AuthUser | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string>("");

  // Election & Positions state
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(null);
  const [positions, setPositions] = useState<PositionWithCandidates[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(true);
  const [loadingPositions, setLoadingPositions] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>("");

  // Voting interaction state
  const [selectedCandidates, setSelectedCandidates] = useState<Record<number, number>>({});
  const [expandedManifestos, setExpandedManifestos] = useState<Record<number, boolean>>({});
  const [votedPositions, setVotedPositions] = useState<Record<number, { timestamp: string; message: string }>>({});
  const [ballotReceipts, setBallotReceipts] = useState<Array<{
    positionId: number;
    positionTitle: string;
    receiptHash: string;
    recordedAt: string;
  }>>([]);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionFeedback, setSubmissionFeedback] = useState<{
    type: "success" | "error";
    message: string;
    details?: string[];
  } | null>(null);

  // Helper to fetch enriched positions for an election
  const fetchEnrichedPositions = useCallback(async (electionId: number) => {
    const posList = await fetchPositions(electionId);
    const enriched = await Promise.all(
      posList.map(async (pos) => {
        try {
          const candidates = await fetchCandidatesForPosition(pos.id);
          return {
            ...pos,
            candidates: candidates.filter(
              (c) => c.approval_status.toLowerCase() === "approved"
            ),
          };
        } catch {
          return { ...pos, candidates: [] };
        }
      })
    );
    return enriched;
  }, []);

  // 1. Initial Authentication & Open Elections Check (Single async effect satisfying React 19 rules)
  useEffect(() => {
    let ignore = false;

    async function init() {
      const token = getStudentToken();
      if (!token) {
        if (!ignore) {
          // Check if user is currently signed in as administrator
          const adminTok = getAdminToken();
          if (adminTok) {
            try {
              const adminUser = await fetchCurrentUser(adminTok);
              if (adminUser.role === "admin") {
                setAdminEmail(adminUser.email);
                setAuthError(
                  `You are currently signed in as Administrator (${adminUser.email}). Administrative accounts cannot cast ballots in student elections.`
                );
                setAuthChecking(false);
                return;
              }
            } catch {
              // Ignore and proceed to standard unauthenticated handling
            }
          }

          setAuthChecking(false);
          setAuthError(
            "Authentication required. Please sign in with your student credentials."
          );
        }
        return;
      }

      try {
        const user = await fetchCurrentUser(token);
        if (ignore) return;

        if (user.role !== "student") {
          setAdminEmail(user.email);
          setAuthError(
            `Access Denied: Account '${user.email}' has role '${user.role}'. Only registered students may cast ballots in college elections.`
          );
          setAuthChecking(false);
          return;
        }

        setStudent(user);

        // Fetch open elections
        const allElections = await fetchElections();
        if (ignore) return;

        const openOnes = allElections.filter(
          (e) => e.status.toLowerCase() === "open"
        );
        setElections(openOnes);

        if (openOnes.length > 0) {
          const initialId = openOnes[0].id;
          setSelectedElectionId(initialId);

          const initialPositions = await fetchEnrichedPositions(initialId);
          if (ignore) return;
          setPositions(initialPositions);
        }
      } catch {
        if (!ignore) {
          // Token expired or invalid
          removeStudentToken();
          setAuthChecking(false);
          router.replace("/student/login?returnUrl=/student/vote");
          return;
        }
      } finally {
        if (!ignore) {
          setAuthChecking(false);
          setLoadingData(false);
        }
      }
    }

    init();

    return () => {
      ignore = true;
    };
  }, [fetchEnrichedPositions, router]);

  // 2. Handle switching election via user interaction
  const handleSelectElection = async (electionId: number) => {
    setSelectedElectionId(electionId);
    setSelectedCandidates({});
    setSubmissionFeedback(null);
    setLoadingPositions(true);
    setGeneralError("");

    try {
      const enriched = await fetchEnrichedPositions(electionId);
      setPositions(enriched);
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : `Failed to load positions for election #${electionId}`
      );
      setPositions([]);
    } finally {
      setLoadingPositions(false);
    }
  };

  // 3. Manual reload handler
  const loadElections = async () => {
    setLoadingData(true);
    setGeneralError("");
    try {
      const allElections = await fetchElections();
      const openOnes = allElections.filter(
        (e) => e.status.toLowerCase() === "open"
      );
      setElections(openOnes);

      if (openOnes.length > 0) {
        const targetId = selectedElectionId ?? openOnes[0].id;
        setSelectedElectionId(targetId);
        const enriched = await fetchEnrichedPositions(targetId);
        setPositions(enriched);
      }
    } catch (err) {
      setGeneralError(
        err instanceof Error
          ? err.message
          : "Could not load active elections from FastAPI backend."
      );
    } finally {
      setLoadingData(false);
    }
  };

  const activeElection = useMemo(() => {
    return elections.find((e) => e.id === selectedElectionId) || null;
  }, [elections, selectedElectionId]);

  // Check if voter belongs to a different department than this election (strict department boundary isolation)
  const isDepartmentIneligible = useMemo(() => {
    if (!activeElection || !student) return false;
    if (activeElection.department_id && student.department_id) {
      return activeElection.department_id !== student.department_id;
    }
    if (student.student_number) {
      const rollUpper = student.student_number.toUpperCase();
      const titleUpper = activeElection.title.toUpperCase();
      for (const code of ["MCA", "MBA", "MCOM", "MSW", "MSC"]) {
        if (titleUpper.includes(code) && !rollUpper.includes(code)) {
          return true;
        }
      }
    }
    return false;
  }, [activeElection, student]);

  // Toggle manifesto drawer
  const toggleManifesto = (candidateId: number) => {
    setExpandedManifestos((prev) => ({
      ...prev,
      [candidateId]: !prev[candidateId],
    }));
  };

  // Select a candidate for a position (one candidate per position rule)
  const handleSelectCandidate = (positionId: number, candidateId: number) => {
    // If already voted for this position, do not allow changing
    if (votedPositions[positionId]) return;

    if (isDepartmentIneligible) {
      setGeneralError(
        "Department Ineligible: You belong to a different department and cannot select candidates in this election."
      );
      return;
    }

    setSelectedCandidates((prev) => ({
      ...prev,
      [positionId]: candidateId,
    }));
  };

  // Deselect candidate for a position
  const handleDeselectCandidate = (positionId: number) => {
    if (votedPositions[positionId]) return;

    setSelectedCandidates((prev) => {
      const updated = { ...prev };
      delete updated[positionId];
      return updated;
    });
  };

  // Sign out student
  const handleSignOut = () => {
    removeStudentToken();
    setStudent(null);
    router.push("/student/login");
  };

  // Count unvoted positions with pending selections
  const pendingCount = Object.keys(selectedCandidates).length;
  const unvotedPositions = positions.filter((p) => !votedPositions[p.id]);

  // 4. Submit Ballots (Requirement 2.E)
  const handleSubmitVotes = async () => {
    const token = getStudentToken();
    if (!token || !selectedElectionId) {
      setSubmissionFeedback({
        type: "error",
        message: "Authentication token missing or election not selected. Please sign in again.",
      });
      return;
    }

    setIsSubmitting(true);
    setSubmissionFeedback(null);

    const positionIdsToVote = Object.keys(selectedCandidates).map(Number);
    const successMessages: string[] = [];
    const errorMessages: string[] = [];
    const newlyVoted: Record<number, { timestamp: string; message: string }> = {};
    const newReceipts: Array<{
      positionId: number;
      positionTitle: string;
      receiptHash: string;
      recordedAt: string;
    }> = [];

    for (const posId of positionIdsToVote) {
      const candidateId = selectedCandidates[posId];
      const posObj = positions.find((p) => p.id === posId);
      const posTitle = posObj?.title || `Position #${posId}`;

      try {
        const result = await castVote(selectedElectionId, posId, candidateId, token);
        newlyVoted[posId] = {
          timestamp: new Date().toISOString(),
          message: result.message || "Ballot securely registered",
        };
        successMessages.push(`Vote for "${posTitle}" was recorded.`);

        if (result.receipt_hash) {
          newReceipts.push({
            positionId: posId,
            positionTitle: posTitle,
            receiptHash: result.receipt_hash,
            recordedAt: result.recorded_at || new Date().toISOString(),
          });
        }
      } catch (err: unknown) {
        const error = err as Error & { status?: number };
        if (error.status === 409) {
          // If already voted according to the backend
          newlyVoted[posId] = {
            timestamp: new Date().toISOString(),
            message: "A vote has already been recorded for this position",
          };
          errorMessages.push(`"${posTitle}": A vote has already been recorded for this position.`);
        } else {
          errorMessages.push(`"${posTitle}": ${error.message || "Failed to submit ballot."}`);
        }
      }
    }

    if (newReceipts.length > 0) {
      setBallotReceipts((prev) => [...prev, ...newReceipts]);
    }

    // Update voted positions map
    setVotedPositions((prev) => ({ ...prev, ...newlyVoted }));

    // Remove successfully voted positions from pending selection
    setSelectedCandidates((prev) => {
      const remaining: Record<number, number> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (!newlyVoted[Number(k)]) {
          remaining[Number(k)] = v;
        }
      }
      return remaining;
    });

    setIsSubmitting(false);
    setShowConfirmModal(false);

    if (errorMessages.length === 0) {
      setSubmissionFeedback({
        type: "success",
        message: "Your secret ballot has been cryptographically recorded in PostgreSQL.",
        details: successMessages,
      });
    } else {
      setSubmissionFeedback({
        type: successMessages.length > 0 ? "success" : "error",
        message:
          successMessages.length > 0
            ? "Some of your votes were recorded, but errors occurred on others."
            : "Failed to submit one or more ballots.",
        details: [...successMessages, ...errorMessages],
      });
    }
  };

  // If checking authentication
  if (authChecking) {
    return (
      <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
        <div className="text-sm text-slate-600 flex items-center gap-2">
          <span className="animate-spin text-purple-600 font-bold">↻</span>
          Verifying student voter credentials...
        </div>
      </div>
    );
  }

  // If authentication failed or unauthorized
  if (authError || !student) {
    const isAdminAccount = !!adminEmail || authError.toLowerCase().includes("administrator") || authError.toLowerCase().includes("role 'admin'");

    return (
      <div className="min-h-screen bg-[#f6f7fb] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-center">
            <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center text-xl font-bold mb-3 ${
              isAdminAccount ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-600"
            }`}>
              {isAdminAccount ? "🛡️" : "🔒"}
            </div>
            <h1 className="text-lg font-bold text-slate-900">
              {isAdminAccount ? "Administrator Session Detected" : "Student Voter Sign In Required"}
            </h1>
            <p className="text-xs text-slate-600 mt-2 leading-relaxed">
              {isAdminAccount
                ? `You are currently logged in with an Administrator account (${adminEmail || "admin"}). Under election governance and neutrality rules, administrators cannot cast secret ballots. Please sign in with a registered student account to vote.`
                : (authError || "You must be signed in with a verified student account to access college voting ballots.")}
            </p>

            <div className="mt-6 space-y-3">
              <Link
                href="/student/login?returnUrl=/student/vote"
                className="w-full inline-flex justify-center py-2.5 px-4 rounded-lg bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs transition-colors shadow-xs"
              >
                Sign In to Student Voter Portal →
              </Link>
              {!isAdminAccount && (
                <Link
                  href="/student/register"
                  className="w-full inline-flex justify-center py-2 px-4 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 font-semibold text-xs transition-colors"
                >
                  Register to Vote (Claim College ID) ✍️
                </Link>
              )}
              {isAdminAccount && (
                <button
                  type="button"
                  onClick={() => {
                    removeAdminToken();
                    router.push("/student/login?returnUrl=/student/vote");
                  }}
                  className="w-full inline-flex justify-center py-2 px-4 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition-colors"
                >
                  Sign Out Administrator & Switch to Student Login
                </button>
              )}
              <div>
                <Link
                  href="/"
                  className="text-xs font-semibold text-slate-600 hover:text-slate-900 inline-block"
                >
                  ← Return to Dashboard
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7fb] pb-16">
      {/* Top Student Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-700 text-white flex items-center justify-center font-extrabold text-lg shadow-xs">
              S
            </div>
            <div>
              <span className="font-extrabold text-sm text-[#171b35] tracking-tight block">
                SmartVote
              </span>
              <span className="text-[10px] uppercase font-bold text-purple-700 tracking-wider block">
                Official Student Ballot
              </span>
            </div>
          </div>

          {/* Student Profile & Sign Out (Requirement 2.A) */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-slate-800">{student.full_name}</span>
              <span className="text-[10px] text-slate-500 font-mono">
                {student.email} • ID #{student.id}
              </span>
            </div>

            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
              {(student.full_name || student.email).charAt(0).toUpperCase()}
            </div>

            <button
              type="button"
              onClick={handleSignOut}
              className="px-2.5 py-1 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors"
              title="Sign out of student voter session"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Ballot Workspace */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Navigation Breadcrumbs */}
        <div className="flex items-center justify-between text-xs text-slate-500 mb-6 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Link href="/" className="hover:text-purple-700 transition-colors">
              Public Dashboard
            </Link>
            <span>/</span>
            <Link href="/elections" className="hover:text-purple-700 transition-colors">
              Elections
            </Link>
            <span>/</span>
            <strong className="text-slate-800">Student Voting Portal</strong>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Verified Student Voter
            </span>
          </div>
        </div>

        {/* Global Feedback Banner */}
        {submissionFeedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-3 shadow-xs ${
              submissionFeedback.type === "success"
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-rose-50 border border-rose-200 text-rose-900"
            }`}
            role="alert"
          >
            <div className="flex items-start gap-2.5">
              <span className="text-base font-bold shrink-0">
                {submissionFeedback.type === "success" ? "✓" : "⚠"}
              </span>
              <div>
                <strong className="block font-semibold mb-1">
                  {submissionFeedback.message}
                </strong>
                {submissionFeedback.details && submissionFeedback.details.length > 0 && (
                  <ul className="list-disc list-inside space-y-0.5 mt-1 text-[11px]">
                    {submissionFeedback.details.map((item, idx) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmissionFeedback(null)}
              className="text-xs font-semibold px-2 py-1 rounded hover:bg-black/5 shrink-0"
            >
              ✕ Dismiss
            </button>
          </div>
        )}

        {/* Phase 3: Cryptographic Voter Receipts */}
        {ballotReceipts.length > 0 && (
          <div className="mb-6 p-5 rounded-2xl bg-white border border-purple-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-purple-100">
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-base">
                  🔐
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    Cryptographic Voter Ballot Receipt
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                      SHA-256 Sealed
                    </span>
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Your ballot has been decoupled from your identity and sealed in the immutable participation ledger.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const receiptText = ballotReceipts
                    .map(
                      (r) =>
                        `Election: ${activeElection?.title || "College Election"}\nPosition: ${r.positionTitle}\nSHA-256 Receipt Hash: ${r.receiptHash}\nTimestamp (UTC): ${r.recordedAt}\nAlgorithm: SHA-256 / PostgreSQL Decoupled Ledger\n----------------------------------------`
                    )
                    .join("\n");
                  const blob = new Blob([receiptText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `smartvote_ballot_receipts_election_${selectedElectionId}.txt`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold text-xs transition-colors self-start sm:self-auto cursor-pointer"
              >
                <span>💾</span>
                Download Receipt (.txt)
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {ballotReceipts.map((r) => (
                <div
                  key={r.positionId}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 max-w-full overflow-hidden">
                    <span className="font-semibold text-slate-800 block">
                      {r.positionTitle}
                    </span>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-purple-700 bg-white px-2.5 py-1 rounded border border-slate-200 overflow-x-auto max-w-full">
                      <span>{r.receiptHash}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      Recorded: {formatKolkataDateTime(r.recordedAt)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(r.receiptHash);
                      setCopiedHash(r.receiptHash);
                      setTimeout(() => setCopiedHash(null), 2500);
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold text-[11px] shrink-0 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span>{copiedHash === r.receiptHash ? "✓" : "📋"}</span>
                    <span>{copiedHash === r.receiptHash ? "Copied!" : "Copy Hash"}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {generalError && (
          <div
            className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between"
            role="alert"
          >
            <span>⚠ {generalError}</span>
            <button
              type="button"
              onClick={loadElections}
              className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded font-semibold text-xs"
            >
              Retry
            </button>
          </div>
        )}

        {/* SECTION A: Open Elections Dashboard (Requirement 2.A & 2.B) */}
        {loadingData ? (
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-xs animate-pulse space-y-4">
            <div className="h-6 w-48 bg-slate-200 rounded" />
            <div className="h-4 w-96 bg-slate-100 rounded" />
          </div>
        ) : elections.length === 0 ? (
          /* Informative message when no elections are open (Requirement 2.A) */
          <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-xs text-center">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-2xl font-bold mb-4">
              🗳️
            </div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">
              No Elections Currently Open For Voting
            </h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
              There are currently no college elections in the active voting stage. Elections are either in preliminary draft registration or have concluded and been sealed.
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Link
                href="/elections"
                className="px-4 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold rounded-lg transition-colors shadow-xs"
              >
                Inspect Elections Catalog →
              </Link>
              <Link
                href="/"
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active Election Header Card (Requirement 2.B) */}
            <section
              className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs"
              aria-label="Active Election Header"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Voting Open
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-purple-100 text-purple-800 font-bold">
                      Election #{activeElection?.id}
                    </span>
                  </div>

                  <h1 className="text-2xl font-extrabold text-[#171b35] tracking-tight">
                    {activeElection?.title}
                  </h1>

                  {activeElection?.description && (
                    <p className="text-xs text-slate-600 mt-1 max-w-2xl leading-relaxed">
                      {activeElection.description}
                    </p>
                  )}
                </div>

                {/* Scheduled Voting Period (Requirement 2.B) */}
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs text-slate-600 shrink-0 flex flex-col sm:flex-row gap-4">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Ballots Open (IST)
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatKolkataDateTime(activeElection?.starts_at, true)}
                    </span>
                  </div>
                  <div className="sm:border-l sm:border-slate-200 sm:pl-4">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Ballots Close (IST)
                    </span>
                    <span className="font-semibold text-slate-800">
                      {formatKolkataDateTime(activeElection?.ends_at, true)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Multiple Open Elections Selector */}
              {elections.length > 1 && (
                <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 overflow-x-auto">
                  <span className="text-xs font-bold text-slate-500 shrink-0">
                    Switch Active Election:
                  </span>
                  {elections.map((el) => {
                    const isSelected = el.id === selectedElectionId;
                    return (
                      <button
                        key={el.id}
                        type="button"
                        onClick={() => handleSelectElection(el.id)}
                        className={`px-3 py-1 text-xs rounded-lg font-semibold transition-colors shrink-0 border ${
                          isSelected
                            ? "bg-purple-700 text-white border-purple-700 shadow-xs"
                            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        #{el.id} {el.title}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Department Isolation Eligibility Warning */}
            {isDepartmentIneligible && (
              <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-2xl text-xs text-amber-950 flex items-start gap-3 shadow-xs">
                <span className="text-2xl shrink-0 mt-0.5">⚠️</span>
                <div>
                  <h4 className="text-sm font-bold text-amber-900">
                    Department Ineligible to Vote in this Election
                  </h4>
                  <p className="mt-1 text-amber-800 leading-relaxed">
                    This election is designated exclusively for students belonging to this department.
                    You are currently authenticated as <strong>{student?.full_name}</strong>{" "}
                    ({student?.department_name || "Other Program"}, Roll #{student?.student_number || student?.id}).
                    Per college democratic governance rules, an MBA student cannot participate in an MCA election, and vice versa. Ballots for this election are view-only for you.
                  </p>
                </div>
              </div>
            )}

            {/* SECTION C: Candidate Selection Grouped by Position (Requirement 2.C) */}
            <section aria-label="Contested Positions & Ballots" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#171b35] tracking-tight">
                    Contested Offices & Ballots
                  </h2>
                  <p className="text-xs text-slate-500">
                    Select exactly 1 candidate for each contested office. Your vote is secret.
                  </p>
                </div>

                {/* Floating Ballot Summary Pill */}
                {pendingCount > 0 && !isDepartmentIneligible && (
                  <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-purple-900 shadow-xs">
                    <span>{pendingCount} candidate selection{pendingCount === 1 ? "" : "s"} ready</span>
                    <button
                      type="button"
                      onClick={() => setShowConfirmModal(true)}
                      className="px-2.5 py-1 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                    >
                      Review & Cast →
                    </button>
                  </div>
                )}
              </div>

              {loadingPositions ? (
                <div className="space-y-4">
                  {[1, 2].map((i) => (
                    <div key={i} className="p-6 bg-white rounded-2xl border border-slate-200 shadow-xs animate-pulse">
                      <div className="h-5 w-40 bg-slate-200 rounded mb-4" />
                      <div className="h-16 bg-slate-100 rounded" />
                    </div>
                  ))}
                </div>
              ) : positions.length === 0 ? (
                <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-xs text-slate-500">
                  No contested positions configured for this election.
                </div>
              ) : (
                <div className="space-y-6">
                  {positions.map((position) => {
                    const isVoted = !!votedPositions[position.id];
                    const chosenCandidateId = selectedCandidates[position.id];

                    return (
                      <article
                        key={position.id}
                        className={`bg-white rounded-2xl border shadow-xs overflow-hidden transition-all ${
                          isVoted
                            ? "border-emerald-200 bg-emerald-50/20"
                            : chosenCandidateId
                            ? "border-purple-300 ring-1 ring-purple-200"
                            : "border-slate-200"
                        }`}
                        aria-labelledby={`pos-${position.id}-title`}
                      >
                        {/* Position Header */}
                        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-xl font-bold flex items-center justify-center text-sm shadow-xs ${
                                isVoted
                                  ? "bg-emerald-100 text-emerald-800"
                                  : "bg-purple-100 text-purple-700"
                              }`}
                            >
                              #{position.id}
                            </div>
                            <div>
                              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-semibold">
                                Contested Office
                              </span>
                              <h3
                                id={`pos-${position.id}-title`}
                                className="text-base font-bold text-[#171b35] leading-tight"
                              >
                                {position.title}
                              </h3>
                            </div>
                          </div>

                          {/* Voting Status Indicator (Requirement 2.F) */}
                          <div>
                            {isVoted ? (
                              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs">
                                ✓ Ballot Cast & Recorded
                              </span>
                            ) : chosenCandidateId ? (
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-xs font-semibold">
                                  Candidate Selected
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDeselectCandidate(position.id)}
                                  className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                                >
                                  Clear
                                </button>
                              </div>
                            ) : (
                              <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
                                Selection Required
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Candidates List (Requirement 2.C: only approved candidates) */}
                        <div className="p-5">
                          {isVoted ? (
                            /* Locked Post-Vote Confirmation */
                            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between flex-wrap gap-2">
                              <div className="flex items-center gap-2">
                                <span className="text-emerald-600 font-bold text-base">✓</span>
                                <div>
                                  <strong>Secret Ballot Finalized:</strong> Your vote for{" "}
                                  <span className="font-semibold">{position.title}</span> has been
                                  recorded in PostgreSQL. Per institutional audit standards, this ballot choice is
                                  permanent and cannot be modified.
                                </div>
                              </div>
                              <span className="text-[11px] text-emerald-700 font-mono">
                                Participation Sealed
                              </span>
                            </div>
                          ) : position.candidates.length === 0 ? (
                            <div className="p-6 text-center text-xs text-slate-500">
                              No approved candidates registered for this position.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {position.candidates.map((candidate) => {
                                const isSelected = chosenCandidateId === candidate.id;
                                const isExpanded = !!expandedManifestos[candidate.id];

                                return (
                                  <div
                                    key={candidate.id}
                                    onClick={() => handleSelectCandidate(position.id, candidate.id)}
                                    className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between ${
                                      isSelected
                                        ? "border-purple-600 bg-purple-50/50 shadow-sm ring-2 ring-purple-600/20"
                                        : "border-slate-200 bg-white hover:border-purple-300 hover:bg-slate-50/50"
                                    }`}
                                    role="radio"
                                    aria-checked={isSelected}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                      if (e.key === " " || e.key === "Enter") {
                                        e.preventDefault();
                                        handleSelectCandidate(position.id, candidate.id);
                                      }
                                    }}
                                  >
                                    <div>
                                      {/* Candidate Card Header */}
                                      <div className="flex items-start justify-between gap-3 mb-2">
                                        <div className="flex items-center gap-3">
                                          {candidate.image_url ? (
                                            <img
                                              src={candidate.image_url}
                                              alt={candidate.student_name || `Candidate #${candidate.id}`}
                                              className="w-14 h-14 rounded-xl object-cover border-2 border-purple-200 shadow-2xs shrink-0"
                                              onError={(e) => {
                                                (e.target as HTMLElement).style.display = "none";
                                              }}
                                            />
                                          ) : (
                                            <div className="w-14 h-14 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center font-bold text-2xl text-purple-700 shrink-0">
                                              👤
                                            </div>
                                          )}
                                          <div>
                                            <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                              {candidate.student_name || `Candidate Record #${candidate.id}`}
                                            </h4>
                                            <span className="text-[11px] font-semibold text-purple-700 block">
                                              {candidate.student_number ? `Roll #${candidate.student_number}` : `Student #${candidate.student_id}`}
                                            </span>
                                            {candidate.department_name && (
                                              <span className="text-[10px] text-slate-500 block">
                                                {candidate.department_name}
                                              </span>
                                            )}
                                          </div>
                                        </div>

                                        {/* Radio Indicator (Requirement: Exactly 1 vote per position) */}
                                        <div
                                          className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${
                                            isSelected
                                              ? "border-purple-600 bg-purple-600 text-white shadow-2xs"
                                              : "border-slate-300 bg-white"
                                          }`}
                                          aria-hidden="true"
                                        >
                                          {isSelected && (
                                            <span className="text-xs font-bold">✓</span>
                                          )}
                                        </div>
                                      </div>

                                      {/* Manifesto Preview */}
                                      {candidate.manifesto ? (
                                        <div className="mt-2 text-xs">
                                          <p
                                            className={`text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100 leading-relaxed ${
                                              isExpanded ? "" : "line-clamp-2"
                                            }`}
                                          >
                                            <strong className="block text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">
                                              Platform Manifesto
                                            </strong>
                                            &quot;{candidate.manifesto}&quot;
                                          </p>
                                          {candidate.manifesto.length > 100 && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleManifesto(candidate.id);
                                              }}
                                              className="text-[11px] font-semibold text-purple-700 hover:text-purple-900 mt-1 cursor-pointer"
                                            >
                                              {isExpanded ? "Show less" : "Read full manifesto →"}
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-[11px] text-slate-400 italic mt-1">
                                          No campaign manifesto submitted.
                                        </p>
                                      )}
                                    </div>

                                    {/* Action button inside card */}
                                    <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between">
                                      <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider">
                                        ● Approved Nominee
                                      </span>
                                      <span
                                        className={`text-xs font-bold ${
                                          isSelected ? "text-purple-700" : "text-slate-400"
                                        }`}
                                      >
                                        {isSelected ? "Selected for Ballot" : "Click to Select"}
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {/* Bottom Sticky Submission Strip */}
              {unvotedPositions.length > 0 && (
                <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Ready to Cast Your Ballot?
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      You have selected {pendingCount} of {unvotedPositions.length} contested offices.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={pendingCount === 0}
                      onClick={() => setShowConfirmModal(true)}
                      className="px-5 py-2.5 bg-purple-700 hover:bg-purple-800 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold text-xs rounded-xl transition-colors shadow-xs cursor-pointer disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <span>🔒 Review & Cast Ballot</span>
                      <span className="px-1.5 py-0.5 bg-white/20 rounded text-[10px]">
                        {pendingCount}
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {/* SECTION D: Vote Confirmation Modal (Requirement 2.D) */}
        {showConfirmModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
          >
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 duration-150">
              {/* Modal Header */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center text-base">
                    🗳️
                  </div>
                  <div>
                    <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
                      Confirm Your Ballot Selections
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      SmartVote Election #{activeElection?.id}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1"
                  aria-label="Close review dialog"
                >
                  ✕
                </button>
              </div>

              {/* Review List of Selections */}
              <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Selected Choices ({pendingCount} Position{pendingCount === 1 ? "" : "s"}):
                </span>
                {Object.entries(selectedCandidates).map(([posIdStr, candId]) => {
                  const posId = Number(posIdStr);
                  const pos = positions.find((p) => p.id === posId);
                  const cand = pos?.candidates.find((c) => c.id === candId);

                  return (
                    <div
                      key={posId}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs gap-3"
                    >
                      <div className="flex items-center gap-2.5">
                        {cand?.image_url ? (
                          <img
                            src={cand.image_url}
                            alt={cand.student_name || `Candidate #${candId}`}
                            className="w-9 h-9 rounded-lg object-cover border border-purple-200 shrink-0"
                          />
                        ) : (
                          <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center font-bold text-sm text-purple-700 shrink-0">
                            👤
                          </div>
                        )}
                        <div>
                          <span className="text-[10px] text-slate-400 block font-mono">
                            Office: {pos?.title || `#${posId}`}
                          </span>
                          <strong className="text-slate-900 font-semibold block">
                            {cand?.student_name || `Candidate #${candId}`}
                          </strong>
                          <span className="text-[10px] text-purple-700 font-mono">
                            {cand?.student_number ? `Roll #${cand.student_number}` : `Student #${cand?.student_id}`}
                          </span>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px] shrink-0">
                        Choice Confirmed
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Irreversibility Warning (Requirement 2.D) */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
                <span className="text-base text-amber-600 font-bold shrink-0">⚠️</span>
                <div>
                  <strong>Irreversible Action:</strong> Once submitted, your vote is recorded anonymously in the PostgreSQL database ledger. Per collegiate election rules, a successfully submitted vote may not be modified or recalled.
                </div>
              </div>

              {/* Modal Actions (Requirement 2.E) */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  Back to Review
                </button>

                <button
                  type="button"
                  onClick={handleSubmitVotes}
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white rounded-lg text-xs font-bold transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <span className="animate-spin text-sm">↻</span>
                      <span>Recording Secret Ballot...</span>
                    </>
                  ) : (
                    <span>Submit Official Ballot</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic Privacy Assurance Footer */}
        <div className="mt-12 p-4 bg-slate-100/80 border border-slate-200 rounded-xl text-xs text-slate-600 text-center leading-relaxed">
          <span className="font-semibold text-slate-800">SmartVote Cryptographic Guarantee:</span>{" "}
          Voter participation receipts (<code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">voter_participation</code>) are decoupled from cast ballot records (<code className="bg-slate-200 px-1 py-0.5 rounded font-mono text-[11px]">votes</code>). Your ballot choice is completely secret.
        </div>
      </div>
    </main>
  );
}

export default function StudentVotePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#f6f7fb] flex items-center justify-center">
          <div className="text-sm text-slate-600 flex items-center gap-2">
            <span className="animate-spin text-purple-600 font-bold">↻</span>
            Loading student ballot portal...
          </div>
        </div>
      }
    >
      <StudentVoteContent />
    </Suspense>
  );
}
