export type ElectionStatus = "draft" | "open" | "closed" | string;

export interface Election {
  id: number;
  title: string;
  description: string | null;
  department_id?: number | null;
  status: ElectionStatus;
  starts_at: string;
  ends_at: string;
}

export interface ElectionStats {
  total: number;
  open: number;
  draft: number;
  closed: number;
}

