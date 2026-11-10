/**
 * SmartVote Shared Constants
 * Core academic departments & standard election positions
 */

export interface DepartmentOption {
  id: string;
  name: string;
  code: string;
  fullName: string;
  icon: string;
  deptId: number;
}

export const FIVE_CORE_DEPARTMENTS: DepartmentOption[] = [
  {
    id: "MCA",
    code: "MCA",
    name: "MCA",
    fullName: "Master of Computer Applications (MCA)",
    icon: "💻",
    deptId: 16,
  },
  {
    id: "MBA",
    code: "MBA",
    name: "MBA",
    fullName: "Master of Business Administration (MBA)",
    icon: "📊",
    deptId: 17,
  },
  {
    id: "MCom",
    code: "MCOM",
    name: "MCom",
    fullName: "Master of Commerce (MCom)",
    icon: "📈",
    deptId: 18,
  },
  {
    id: "MSW",
    code: "MSW",
    name: "MSW",
    fullName: "Master of Social Work (MSW)",
    icon: "🤝",
    deptId: 19,
  },
  {
    id: "MSc",
    code: "MSC",
    name: "MSc",
    fullName: "Master of Science (MSc)",
    icon: "🔬",
    deptId: 20,
  },
];

/**
 * Standard College Election Positions
 * Used across nomination dialogs and election creators so users can pick from options
 * rather than having to type them manually.
 */
export const STANDARD_POSITION_OPTIONS = [
  "President",
  "Vice President",
  "General Secretary",
  "Joint Secretary",
  "Treasurer",
  "Department Student Representative",
  "Cultural Secretary",
  "Sports Secretary",
  "Technical / Innovation Secretary",
  "Academic & Placement Representative",
  "Social Welfare Coordinator",
  "Class Representative (CR)",
] as const;

export type StandardPosition = (typeof STANDARD_POSITION_OPTIONS)[number];

