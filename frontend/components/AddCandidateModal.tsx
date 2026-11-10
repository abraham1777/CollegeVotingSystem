"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Election } from "@/types/election";
import { Position } from "@/types/candidate";
import {
  fetchPositions,
  fetchCandidatesForPosition,
  createPosition,
  registerCandidate,
  fetchRegisteredStudents,
  RegisteredStudent,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { STANDARD_POSITION_OPTIONS } from "@/lib/constants";

interface AddCandidateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCandidateAdded: () => void;
  elections: Election[];
}

export default function AddCandidateModal({
  isOpen,
  onClose,
  onCandidateAdded,
  elections,
}: AddCandidateModalProps) {
  const { token, isAdmin } = useAuth();

  // Draft elections only (backend requirement: candidates can only be registered for draft elections)
  const draftElections = elections.filter(
    (e) => e.status.toLowerCase() === "draft"
  );

  // Form states
  const [selectedElectionId, setSelectedElectionId] = useState<number | null>(
    null
  );
  const [positions, setPositions] = useState<Position[]>([]);
  const [selectedPositionId, setSelectedPositionId] = useState<number | null>(
    null
  );
  const [positionCandidateCount, setPositionCandidateCount] = useState<number>(0);
  const [registeredStudents, setRegisteredStudents] = useState<
    RegisteredStudent[]
  >([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | null>(
    null
  );
  const [manifesto, setManifesto] = useState<string>("");
  const [imageUrl, setImageUrl] = useState<string>("");

  // Position Options State (Requirements: Positions must be given as options rather than entering manually)
  const [showAddPositionSection, setShowAddPositionSection] = useState(false);
  const [selectedPresetPosition, setSelectedPresetPosition] = useState<string>(
    STANDARD_POSITION_OPTIONS[0]
  );
  const [isCustomPosition, setIsCustomPosition] = useState(false);
  const [customPositionTitle, setCustomPositionTitle] = useState("");
  const [creatingPosition, setCreatingPosition] = useState(false);

  // Feedback states
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Active election object
  const currentElection = useMemo(() => {
    return draftElections.find((e) => e.id === selectedElectionId);
  }, [draftElections, selectedElectionId]);

  // Requirement: Department isolation (MBA student cannot participate in MCA election)
  // Filter registered students strictly by election's designated academic program
  const eligibleStudentsForElection = useMemo(() => {
    if (!currentElection) return registeredStudents;

    // Check by election's explicit department_id first
    if (currentElection.department_id) {
      const filteredByDept = registeredStudents.filter(
        (s) => s.department_id === currentElection.department_id
      );
      if (filteredByDept.length > 0) return filteredByDept;
    }

    // Fallback matching by department code in election title
    const titleUpper = currentElection.title.toUpperCase();
    let targetDeptCode = "";
    for (const code of ["MCA", "MBA", "MCOM", "MSW", "MSC"]) {
      if (titleUpper.includes(code)) {
        targetDeptCode = code;
        break;
      }
    }

    if (targetDeptCode) {
      return registeredStudents.filter(
        (s) =>
          s.student_number.toUpperCase().includes(targetDeptCode) ||
          (s.department_name &&
            s.department_name.toUpperCase().includes(targetDeptCode))
      );
    }
    return registeredStudents;
  }, [registeredStudents, currentElection]);

  // Auto-select first draft election when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      if (draftElections.length > 0 && !selectedElectionId) {
        setSelectedElectionId(draftElections[0].id);
      }
    }
  }, [isOpen, draftElections, selectedElectionId]);

  // Load positions whenever selectedElectionId changes
  useEffect(() => {
    if (!selectedElectionId) {
      setPositions([]);
      setSelectedPositionId(null);
      return;
    }

    let isCancelled = false;
    async function loadPos() {
      setLoadingPositions(true);
      try {
        const data = await fetchPositions(selectedElectionId!);
        if (!isCancelled) {
          setPositions(data);
          if (data.length > 0) {
            setSelectedPositionId(data[0].id);
          } else {
            setSelectedPositionId(null);
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load positions."
          );
        }
      } finally {
        if (!isCancelled) setLoadingPositions(false);
      }
    }

    loadPos();
    return () => {
      isCancelled = true;
    };
  }, [selectedElectionId]);

  // Check candidate count for selected position (Requirement: Maximum 5 candidates per position)
  useEffect(() => {
    if (!selectedPositionId) {
      setPositionCandidateCount(0);
      return;
    }

    let isCancelled = false;
    async function checkCount() {
      try {
        const cands = await fetchCandidatesForPosition(selectedPositionId!);
        if (!isCancelled) {
          setPositionCandidateCount(cands.length);
        }
      } catch {
        if (!isCancelled) setPositionCandidateCount(0);
      }
    }

    checkCount();
    return () => {
      isCancelled = true;
    };
  }, [selectedPositionId]);

  // Load registered students list
  useEffect(() => {
    if (!isOpen || !token) return;

    let isCancelled = false;
    async function loadStudents() {
      setLoadingStudents(true);
      try {
        const students = await fetchRegisteredStudents(token!);
        if (!isCancelled) {
          setRegisteredStudents(students);
        }
      } catch {
        // Fallback gracefully
      } finally {
        if (!isCancelled) setLoadingStudents(false);
      }
    }

    loadStudents();
    return () => {
      isCancelled = true;
    };
  }, [isOpen, token]);

  // Auto-select first eligible student when list changes
  useEffect(() => {
    if (eligibleStudentsForElection.length > 0) {
      setSelectedStudentId(eligibleStudentsForElection[0].id);
    } else {
      setSelectedStudentId(null);
    }
  }, [eligibleStudentsForElection]);

  // Handle ESC key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !isAdmin) return null;

  // Handle Adding a Position from Predefined Options
  const handleAddPositionOption = async (positionTitle: string) => {
    const finalTitle = positionTitle.trim();
    if (!token || !selectedElectionId || !finalTitle) return;

    const alreadyExists = positions.some(
      (p) => p.title.toLowerCase() === finalTitle.toLowerCase()
    );
    if (alreadyExists) {
      setError(`The position "${finalTitle}" already exists for this election.`);
      const existing = positions.find(
        (p) => p.title.toLowerCase() === finalTitle.toLowerCase()
      );
      if (existing) setSelectedPositionId(existing.id);
      setShowAddPositionSection(false);
      return;
    }

    setCreatingPosition(true);
    setError(null);
    try {
      const pos = await createPosition(selectedElectionId, finalTitle, token);
      setPositions((prev) => [...prev, pos]);
      setSelectedPositionId(pos.id);
      setShowAddPositionSection(false);
      setIsCustomPosition(false);
      setCustomPositionTitle("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create position.");
    } finally {
      setCreatingPosition(false);
    }
  };

  // Handle Register Candidate Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Administrator authentication required.");
      return;
    }
    if (!selectedPositionId) {
      setError("Please select or configure an election position.");
      return;
    }
    if (!selectedStudentId) {
      setError("Please select an eligible student nominee from this department.");
      return;
    }
    if (positionCandidateCount >= 5) {
      setError(
        "Candidate quota reached: A maximum of 5 candidates can participate for any single position."
      );
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await registerCandidate(
        selectedPositionId,
        selectedStudentId,
        manifesto.trim() || null,
        token,
        imageUrl.trim() || null
      );
      setSuccessMsg(
        "Candidate nominated successfully! The nominee has been registered with photo and Pending approval status."
      );
      setManifesto("");
      setImageUrl("");
      setTimeout(() => {
        onCandidateAdded();
        onClose();
      }, 1400);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to register candidate."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const isPositionQuotaFull = positionCandidateCount >= 5;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-candidate-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/60">
          <div>
            <span className="text-[10px] font-bold tracking-wider text-purple-700 uppercase bg-purple-50 px-2 py-0.5 rounded border border-purple-200 inline-block mb-1">
              Administrator Governance
            </span>
            <h2 id="add-candidate-modal-title" className="text-xl font-bold text-[#171b35]">
              Nominate Candidate
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Register a departmental student nominee with campaign photo and manifesto.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {/* Success Banner */}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-medium">
              <span className="text-base font-bold">✓</span>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <span className="text-base font-bold">⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Department & Quota Governance Notice */}
          <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-900 leading-relaxed space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-indigo-950">
              <span>🛡️</span>
              <span>Governance & Eligibility Rules:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-indigo-800 text-[10px]">
              <li><strong>Department Isolation:</strong> Only students belonging to this election&apos;s department can be nominated.</li>
              <li><strong>Candidate Quota:</strong> Exactly up to <strong>5 candidates</strong> may contest each position.</li>
              <li><strong>Single-Vote Integrity:</strong> Each student may cast only 1 vote per position on their ballot.</li>
            </ul>
          </div>

          {/* Step 1: Draft Election Selection */}
          <div>
            <label htmlFor="election-select" className="block text-xs font-bold text-slate-700 mb-1">
              1. Target Draft Election <span className="text-rose-500">*</span>
            </label>
            {draftElections.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                ⚠️ No draft elections currently available. Please create a new election in <strong>Draft</strong> status first from the Elections page.
              </div>
            ) : (
              <select
                id="election-select"
                value={selectedElectionId || ""}
                onChange={(e) => setSelectedElectionId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#6857e8]"
                required
              >
                {draftElections.map((elec) => (
                  <option key={elec.id} value={elec.id}>
                    #{elec.id} - {elec.title} (Draft)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Step 2: Position Selection (Options-driven rather than manual entry) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="position-select" className="block text-xs font-bold text-slate-700">
                2. Contested Position <span className="text-rose-500">*</span>
              </label>
              {selectedPositionId && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isPositionQuotaFull
                      ? "bg-rose-100 text-rose-700 border border-rose-200"
                      : "bg-purple-100 text-purple-700 border border-purple-200"
                  }`}
                >
                  {positionCandidateCount} / 5 Candidates Registered
                </span>
              )}
            </div>

            {loadingPositions ? (
              <div className="text-xs text-slate-400 py-2">Loading positions...</div>
            ) : positions.length === 0 && !showAddPositionSection ? (
              <div className="p-3.5 bg-purple-50/50 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-2">
                <p className="font-semibold">No positions configured yet for this election.</p>
                <p className="text-[11px] text-purple-700">Select a standard position to add from the options below:</p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {STANDARD_POSITION_OPTIONS.slice(0, 6).map((posTitle) => (
                    <button
                      key={posTitle}
                      type="button"
                      disabled={creatingPosition}
                      onClick={() => handleAddPositionOption(posTitle)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white border border-purple-300 text-purple-800 rounded-lg hover:bg-purple-100 transition-colors shadow-2xs"
                    >
                      ＋ {posTitle}
                    </button>
                  ))}
                </div>
              </div>
            ) : !showAddPositionSection ? (
              <div className="space-y-2">
                <select
                  id="position-select"
                  value={selectedPositionId || ""}
                  onChange={(e) => setSelectedPositionId(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#6857e8]"
                  required
                >
                  {positions.map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      #{pos.id} - {pos.title}
                    </option>
                  ))}
                </select>

                {/* Quick Add Pill helper */}
                <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-slate-500">
                  <span className="font-medium text-slate-600">Add standard position:</span>
                  {STANDARD_POSITION_OPTIONS.filter(
                    (title) => !positions.some((p) => p.title.toLowerCase() === title.toLowerCase())
                  )
                    .slice(0, 4)
                    .map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        disabled={creatingPosition}
                        onClick={() => handleAddPositionOption(opt)}
                        className="px-2 py-0.5 bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-800 rounded border border-slate-200 text-[10px] font-semibold transition-colors"
                      >
                        ＋ {opt}
                      </button>
                    ))}
                  <button
                    type="button"
                    onClick={() => setShowAddPositionSection(true)}
                    className="text-[10px] text-purple-700 hover:text-purple-900 underline font-semibold ml-1 cursor-pointer"
                  >
                    All position options...
                  </button>
                </div>
              </div>
            ) : null}

            {/* Quota Warning */}
            {isPositionQuotaFull && (
              <p className="text-xs text-rose-600 font-bold mt-1.5 flex items-center gap-1">
                <span>⚠️</span>
                <span>Maximum limit of 5 candidates reached for this position. Cannot register more.</span>
              </p>
            )}

            {/* Position Options Selector Dialog */}
            {showAddPositionSection && (
              <div className="p-4 bg-purple-50/80 border border-purple-200 rounded-xl space-y-3 mt-1.5 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-900 block">
                    Choose Standard Position Option
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPositionSection(false);
                      setIsCustomPosition(false);
                    }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✕ Cancel
                  </button>
                </div>

                <div>
                  <select
                    value={isCustomPosition ? "CUSTOM" : selectedPresetPosition}
                    onChange={(e) => {
                      if (e.target.value === "CUSTOM") {
                        setIsCustomPosition(true);
                      } else {
                        setIsCustomPosition(false);
                        setSelectedPresetPosition(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-1 focus:ring-purple-700"
                  >
                    {STANDARD_POSITION_OPTIONS.map((posOpt) => (
                      <option key={posOpt} value={posOpt}>
                        {posOpt}
                      </option>
                    ))}
                    <option value="CUSTOM">Custom Position Title...</option>
                  </select>
                </div>

                {isCustomPosition && (
                  <div>
                    <input
                      type="text"
                      value={customPositionTitle}
                      onChange={(e) => setCustomPositionTitle(e.target.value)}
                      placeholder="e.g. Fine Arts Secretary, Library Committee Representative"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-purple-300 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-700"
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddPositionSection(false);
                      setIsCustomPosition(false);
                    }}
                    className="px-3 py-1 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={creatingPosition || (isCustomPosition && !customPositionTitle.trim())}
                    onClick={() =>
                      handleAddPositionOption(
                        isCustomPosition ? customPositionTitle : selectedPresetPosition
                      )
                    }
                    className="px-3.5 py-1 text-xs font-semibold text-white bg-purple-700 hover:bg-purple-800 disabled:opacity-50 rounded-lg transition-colors shadow-2xs"
                  >
                    {creatingPosition ? "Adding..." : "Confirm & Select Position"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Student Selection (Enforcing Department Isolation) */}
          <div>
            <label htmlFor="student-select" className="block text-xs font-bold text-slate-700 mb-1">
              3. Student Nominee <span className="text-rose-500">*</span>{" "}
              <span className="text-slate-400 font-normal">
                (Filtered for {currentElection?.title.slice(0, 30) || "this"} department)
              </span>
            </label>
            {loadingStudents ? (
              <div className="text-xs text-slate-400 py-2">Loading student registry...</div>
            ) : eligibleStudentsForElection.length > 0 ? (
              <select
                id="student-select"
                value={selectedStudentId || ""}
                onChange={(e) => setSelectedStudentId(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-[#6857e8]"
                required
              >
                {eligibleStudentsForElection.map((s) => (
                  <option key={s.id} value={s.id}>
                    Roll #{s.student_number} — {s.full_name || s.email} ({s.department_name || `Dept #${s.department_id}`})
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                ⚠️ No enrolled students found matching this election&apos;s department. Please register or seed students for this department in the roster.
              </div>
            )}
            <span className="text-[10px] text-slate-500 mt-1 block">
              Enforces departmental boundary: only enrolled students from the designated program are eligible to run.
            </span>
          </div>

          {/* Step 4: Candidate Photo / Image Option (Requirement) */}
          <div>
            <label htmlFor="candidate-image-input" className="block text-xs font-bold text-slate-700 mb-1">
              4. Candidate Photo / Avatar <span className="text-slate-400 font-normal">(Helps voters identify candidates on ballots)</span>
            </label>
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-xl border border-purple-200 bg-purple-50 flex items-center justify-center overflow-hidden shrink-0 shadow-2xs mt-0.5">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Candidate preview"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                ) : (
                  <span className="text-xl">👤</span>
                )}
              </div>
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <input
                    id="candidate-image-input"
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Paste candidate photo URL or browse local image file →"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6857e8]"
                  />
                  <label className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg text-[11px] font-semibold text-slate-700 cursor-pointer transition-colors shrink-0">
                    📁 Upload File
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            setError("Candidate photo must be under 2MB.");
                            return;
                          }
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setImageUrl(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                  </label>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">Quick avatars:</span>
                  {[
                    { label: "Photo 1", url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80" },
                    { label: "Photo 2", url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80" },
                    { label: "Photo 3", url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80" },
                    { label: "Photo 4", url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80" },
                    { label: "Dicebear", url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedStudentId || "candidate"}` },
                  ].map((av) => (
                    <button
                      key={av.label}
                      type="button"
                      onClick={() => setImageUrl(av.url)}
                      className="px-2 py-0.5 rounded border border-purple-200 bg-white hover:bg-purple-50 text-[10px] font-semibold text-purple-700 transition-colors"
                    >
                      {av.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Step 5: Candidate Manifesto */}
          <div>
            <label htmlFor="manifesto-input" className="block text-xs font-bold text-slate-700 mb-1">
              5. Campaign Manifesto / Agenda <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <textarea
              id="manifesto-input"
              rows={3}
              value={manifesto}
              onChange={(e) => setManifesto(e.target.value)}
              placeholder="Outline the candidate's agenda, campaign manifesto, and promises to student voters..."
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#6857e8] leading-relaxed"
              maxLength={5000}
            />
            <span className="text-[10px] text-slate-400 block text-right mt-0.5">
              {manifesto.length} / 5000 characters
            </span>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                submitting ||
                draftElections.length === 0 ||
                !selectedPositionId ||
                !selectedStudentId ||
                isPositionQuotaFull
              }
              className="primary-button bg-[#6857e8] hover:bg-[#5847d1] text-white font-semibold text-xs px-4 py-2 rounded-lg disabled:opacity-50 transition-colors shadow-xs"
            >
              {submitting
                ? "Registering Nominee..."
                : isPositionQuotaFull
                ? "Position Quota Full (5/5)"
                : "Register Candidate"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
