export type ApprovalStatus = "approved" | "pending" | "rejected" | string;

export interface Position {
  id: number;
  election_id: number;
  title: string;
}

export interface Candidate {
  id: number;
  student_id: number;
  position_id: number;
  manifesto: string | null;
  image_url?: string | null;
  approval_status: ApprovalStatus;
  student_name?: string | null;
  student_number?: string | null;
  department_name?: string | null;
}

export interface CandidateWithContext extends Candidate {
  position_title: string;
  election_id: number;
  election_title: string;
  election_status: string;
  election_starts_at?: string;
  election_ends_at?: string;
}

export interface CandidateApprovalUpdatePayload {
  approval_status: "approved" | "rejected";
}

