import { Election } from "@/types/election";
import {
  Candidate,
  CandidateWithContext,
  Position,
  CandidateApprovalUpdatePayload,
} from "@/types/candidate";
import { PositionWithResults } from "@/types/results";
import { extractErrorMessage } from "./utils";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface CreateElectionInput {
  title: string;
  description?: string | null;
  department_id?: number | null;
  starts_at: string; // ISO 8601 string
  ends_at: string;   // ISO 8601 string
}

/**
 * Fetch elections from the FastAPI backend (GET /elections).
 */
export async function fetchElections(): Promise<Election[]> {
  const response = await fetch(`${API_URL}/elections`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `FastAPI server returned HTTP ${response.status}: ${
        response.statusText || "Unable to retrieve elections"
      }`
    );
    throw new Error(message);
  }

  const data: Election[] = await response.json();
  return data;
}

/**
 * Create a new election using the existing FastAPI endpoint (POST /elections).
 * Requires administrator bearer token.
 */
export async function createElection(
  input: CreateElectionInput,
  token: string
): Promise<Election> {
  const response = await fetch(`${API_URL}/elections`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      department_id: input.department_id ?? null,
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to create election (HTTP ${response.status}: ${
        response.statusText || "Bad Request"
      })`
    );
    throw new Error(message);
  }

  const data: Election = await response.json();
  return data;
}

/**
 * Fetch positions for an election (GET /elections/{election_id}/positions).
 */
export async function fetchPositions(electionId: number): Promise<Position[]> {
  const response = await fetch(`${API_URL}/elections/${electionId}/positions`, {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to fetch positions for election #${electionId} (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const data: Position[] = await response.json();
  return data;
}

/**
 * Fetch approved candidates for a position (GET /positions/{position_id}/candidates).
 * Note: The backend endpoint filters for approval_status == "approved".
 */
export async function fetchCandidatesForPosition(
  positionId: number
): Promise<Candidate[]> {
  const response = await fetch(
    `${API_URL}/positions/${positionId}/candidates`,
    {
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to fetch candidates for position #${positionId} (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const data: Candidate[] = await response.json();
  return data;
}

/**
 * Aggregates all candidates by traversing elections -> positions -> candidates.
 * Enriches each candidate with associated election and position details.
 */
export async function fetchAllCandidatesWithContext(): Promise<{
  candidates: CandidateWithContext[];
  elections: Election[];
  positions: Position[];
}> {
  // Step 1: Fetch all elections
  const elections = await fetchElections();

  const allCandidates: CandidateWithContext[] = [];
  const allPositions: Position[] = [];

  // Step 2: Traverse each election to retrieve its positions
  for (const election of elections) {
    try {
      const positions = await fetchPositions(election.id);
      allPositions.push(...positions);

      // Step 3: Traverse each position to retrieve its candidates
      for (const position of positions) {
        try {
          const candidates = await fetchCandidatesForPosition(position.id);
          for (const cand of candidates) {
            allCandidates.push({
              ...cand,
              position_title: position.title,
              election_id: election.id,
              election_title: election.title,
              election_status: election.status,
              election_starts_at: election.starts_at,
              election_ends_at: election.ends_at,
            });
          }
        } catch {
          // If a position has no candidates or an error occurs, continue
        }
      }
    } catch {
      // If an election has no positions or an error occurs, continue
    }
  }

  return {
    candidates: allCandidates,
    elections,
    positions: allPositions,
  };
}

/**
 * Update candidate approval status (PATCH /candidates/{candidate_id}/approval).
 * Requires administrator bearer token.
 * Note: The backend permits approval review only when the associated election is in 'draft' status.
 */
export async function updateCandidateApproval(
  candidateId: number,
  status: "approved" | "rejected",
  token: string
): Promise<Candidate> {
  const payload: CandidateApprovalUpdatePayload = {
    approval_status: status,
  };

  const response = await fetch(
    `${API_URL}/candidates/${candidateId}/approval`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to update candidate approval status (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const data: Candidate = await response.json();
  return data;
}

/**
 * Register a candidate for a position (POST /positions/{position_id}/candidates).
 * Requires administrator bearer token.
 * Note: Only allowed when election is in 'draft' status.
 */
export async function registerCandidate(
  positionId: number,
  studentId: number,
  manifesto: string | null,
  token: string,
  imageUrl?: string | null
): Promise<Candidate> {
  const response = await fetch(
    `${API_URL}/positions/${positionId}/candidates`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify({
        student_id: studentId,
        manifesto: manifesto?.trim() || null,
        image_url: imageUrl?.trim() || null,
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to register candidate (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  const data: Candidate = await response.json();
  return data;
}

export interface RegisteredStudent {
  id: number;
  user_id: number;
  student_number: string;
  full_name: string | null;
  email: string | null;
  department_id: number;
  department_name: string | null;
  semester: number;
}

/**
 * Create a position for an election (POST /elections/{election_id}/positions).
 * Requires administrator bearer token.
 * Note: Only allowed when election is in 'draft' status.
 */
export async function createPosition(
  electionId: number,
  title: string,
  token: string
): Promise<Position> {
  const response = await fetch(`${API_URL}/elections/${electionId}/positions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify({
      title: title.trim(),
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to create position (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch all registered students (GET /students).
 * Requires administrator bearer token.
 */
export async function fetchRegisteredStudents(
  token: string
): Promise<RegisteredStudent[]> {
  const response = await fetch(`${API_URL}/students`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to fetch registered students (HTTP ${response.status})`
    );
    throw new Error(message);
  }

  return response.json();
}

/**
 * Fetch results and position breakdown for a specific election.
 * Traverses existing FastAPI endpoints: GET /elections/{id}/positions and GET /positions/{id}/candidates.
 * If backend publishes certified tallies at /elections/{id}/results, it incorporates them;
 * otherwise provides an explicit transparency notice indicating tallies are sealed in the ledger.
 */
export async function fetchElectionResults(electionId: number): Promise<{
  positions: PositionWithResults[];
  hasPublishedTallies: boolean;
  tallyNotice: string;
}> {
  try {
    const tallyRes = await fetch(`${API_URL}/elections/${electionId}/results`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (tallyRes.ok) {
      const tallyData = await tallyRes.json();
      if (tallyData && Array.isArray(tallyData.positions)) {
        const mappedPositions: PositionWithResults[] = tallyData.positions.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => ({
            id: p.id,
            election_id: p.election_id,
            title: p.title,
            totalVotes: p.total_votes,
            winner: p.winner,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            candidates: (p.candidates || []).map((c: any) => ({
              id: c.id,
              student_id: c.student_id,
              candidate_name: c.candidate_name,
              position_id: c.position_id,
              manifesto: c.manifesto,
              approval_status: c.approval_status,
              votes: c.votes,
              percentage: c.percentage,
              is_winner: c.is_winner,
            })),
          })
        );

        return {
          positions: mappedPositions,
          hasPublishedTallies: tallyData.has_published_tallies ?? true,
          tallyNotice: tallyData.tally_notice || "Official vote tabulation verified.",
        };
      }
    }
  } catch {
    // Fall back to positions list if results endpoint fails
  }

  // Fallback: Fetch positions and candidates
  const positions = await fetchPositions(electionId);
  const positionsWithResults: PositionWithResults[] = [];

  for (const pos of positions) {
    try {
      const candidates = await fetchCandidatesForPosition(pos.id);
      positionsWithResults.push({
        ...pos,
        candidates: candidates.map((c) => ({
          ...c,
          votes: null,
          percentage: null,
          is_winner: null,
        })),
        totalVotes: null,
        winner: null,
      });
    } catch {
      positionsWithResults.push({
        ...pos,
        candidates: [],
        totalVotes: null,
        winner: null,
      });
    }
  }

  return {
    positions: positionsWithResults,
    hasPublishedTallies: false,
    tallyNotice:
      "Official vote totals, percentages, and certified winner declarations are currently sealed in the database ledger.",
  };
}

export interface ApiHealthResult {
  isHealthy: boolean;
  apiUrl: string;
  status: string;
  latencyMs: number;
  database: {
    status: string;
    name?: string;
    connected: boolean;
  } | null;
  timestamp: string;
}

/**
 * Perform a live health check against the FastAPI backend (/health and /health/database).
 */
export async function checkApiHealth(): Promise<ApiHealthResult> {
  const startTime = Date.now();
  try {
    const healthRes = await fetch(`${API_URL}/health`, {
      cache: "no-store",
    });
    const latencyMs = Date.now() - startTime;

    if (!healthRes.ok) {
      return {
        isHealthy: false,
        apiUrl: API_URL,
        status: `HTTP ${healthRes.status}`,
        latencyMs,
        database: null,
        timestamp: new Date().toISOString(),
      };
    }

    const healthData = await healthRes.json();

    // Check database health
    let dbInfo: ApiHealthResult["database"] = null;
    try {
      const dbRes = await fetch(`${API_URL}/health/database`, {
        cache: "no-store",
      });
      if (dbRes.ok) {
        const dbData = await dbRes.json();
        dbInfo = {
          status: dbData.status || "connected",
          name: dbData.database || "smartvote_db",
          connected: dbData.status === "connected",
        };
      } else {
        dbInfo = {
          status: `HTTP ${dbRes.status}`,
          connected: false,
        };
      }
    } catch {
      dbInfo = {
        status: "unreachable",
        connected: false,
      };
    }

    return {
      isHealthy: healthData.status === "healthy",
      apiUrl: API_URL,
      status: healthData.status || "healthy",
      latencyMs,
      database: dbInfo,
      timestamp: new Date().toISOString(),
    };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    return {
      isHealthy: false,
      apiUrl: API_URL,
      status: err instanceof Error ? err.message : "Connection failed",
      latencyMs,
      database: null,
      timestamp: new Date().toISOString(),
    };
  }
}

export interface VoteResult {
  message: string;
  election_id: number;
  position_id: number;
  receipt_hash?: string;
  recorded_at?: string;
}

/**
 * Cast a vote for a candidate in an election position (POST /elections/{election_id}/positions/{position_id}/vote).
 * Requires student bearer token.
 */
export async function castVote(
  electionId: number,
  positionId: number,
  candidateId: number,
  token: string
): Promise<VoteResult> {
  const response = await fetch(
    `${API_URL}/elections/${electionId}/positions/${positionId}/vote`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      body: JSON.stringify({ candidate_id: candidateId }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = extractErrorMessage(
      errorData,
      `Failed to submit ballot (HTTP ${response.status})`
    );
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return await response.json();
}

export interface EligibleStudentDetail {
  id: number;
  college_id: string;
  full_name: string;
  department_id: number;
  department_name?: string | null;
  semester: number;
  claimed_by_user_id: number | null;
  claimed_at: string | null;
}

export interface BulkUploadResult {
  success: boolean;
  message: string;
  total_processed: number;
  added: number;
  skipped: number;
  errors: string[];
}

export interface DepartmentItem {
  id: number;
  name: string;
}

/**
 * Fetch all departments from backend (GET /departments)
 */
export async function fetchDepartments(): Promise<DepartmentItem[]> {
  const response = await fetch(`${API_URL}/departments`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch departments (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Fetch eligible student roster (GET /eligible-students).
 * Requires admin authorization.
 */
export async function fetchEligibleStudents(token: string): Promise<EligibleStudentDetail[]> {
  const response = await fetch(`${API_URL}/eligible-students`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Failed to fetch roster (HTTP ${response.status})`)
    );
  }

  return response.json();
}

/**
 * Bulk upload student roster via CSV file (POST /eligible-students/bulk).
 * Requires admin authorization.
 */
export async function uploadRosterCsv(file: File, token: string): Promise<BulkUploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/eligible-students/bulk`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Bulk upload failed (HTTP ${response.status})`)
    );
  }

  return response.json();
}

/**
 * Add a single eligible student to the roster (POST /eligible-students).
 * Requires admin authorization.
 */
export async function addSingleEligibleStudent(
  payload: {
    college_id: string;
    full_name: string;
    department_id: number;
    semester: number;
  },
  token: string
): Promise<EligibleStudentDetail> {
  const response = await fetch(`${API_URL}/eligible-students`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Failed to add student (HTTP ${response.status})`)
    );
  }

  return response.json();
}


export interface VerifiedReceipt {
  verified: boolean;
  receipt_hash: string;
  election_id: number;
  election_title: string;
  position_id: number;
  position_title: string;
  recorded_at: string;
  status: string;
  algorithm: string;
  secrecy_note: string;
}

export interface AuditLogItem {
  id: number;
  admin_id: number | null;
  admin_email: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface ClockStatus {
  status: "running" | "stopped";
  current_time_utc: string;
  job_id: string;
  interval_seconds: number;
}

export async function verifyBallotReceipt(receiptHash: string): Promise<VerifiedReceipt> {
  const response = await fetch(`${API_URL}/votes/verify/${receiptHash.trim()}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(
        errorData,
        `Receipt verification failed (HTTP ${response.status}): Invalid or unrecorded ballot receipt`
      )
    );
  }

  return response.json();
}

export async function fetchAuditLogs(
  token: string,
  action?: string,
  targetType?: string
): Promise<AuditLogItem[]> {
  const params = new URLSearchParams();
  if (action) params.append("action", action);
  if (targetType) params.append("target_type", targetType);

  const url = `${API_URL}/audit-logs${params.toString() ? `?${params.toString()}` : ""}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Failed to fetch audit logs (HTTP ${response.status})`)
    );
  }

  return response.json();
}

export async function triggerClockTick(
  token: string
): Promise<{ success: boolean; message: string; transitions: Array<{ id: number; title: string; transition: string }> }> {
  const response = await fetch(`${API_URL}/admin/clock/tick`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Failed to trigger election clock evaluation (HTTP ${response.status})`)
    );
  }

  return response.json();
}

export async function fetchClockStatus(token: string): Promise<ClockStatus> {
  const response = await fetch(`${API_URL}/admin/clock/status`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      extractErrorMessage(errorData, `Failed to retrieve election clock status (HTTP ${response.status})`)
    );
  }

  return response.json();
}
