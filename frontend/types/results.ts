import { Election } from "./election";
import { Position } from "./candidate";

export interface CandidateResult {
  id: number;
  student_id: number;
  candidate_name?: string | null;
  position_id: number;
  manifesto: string | null;
  approval_status: string;
  votes?: number | null;
  percentage?: number | null;
  is_winner?: boolean | null;
}

export interface PositionWithResults extends Position {
  candidates: CandidateResult[];
  totalVotes?: number | null;
  winner?: CandidateResult | null;
}

export interface ElectionResultsView {
  election: Election;
  positions: PositionWithResults[];
  hasPublishedTallies: boolean;
  tallyNotice: string;
}
