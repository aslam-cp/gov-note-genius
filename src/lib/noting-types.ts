export type NotingType =
  | "approve"
  | "reject"
  | "putup_positive"
  | "putup_negative"
  | "other";

export const NOTING_OPTIONS: { value: NotingType; label: string; hint: string }[] = [
  {
    value: "approve",
    label: "For Approving with reasoning",
    hint: "Recommend approval with proper justification.",
  },
  {
    value: "reject",
    label: "For Rejecting with reasoning",
    hint: "Explain why the proposal is not admissible / not feasible.",
  },
  {
    value: "putup_positive",
    label: "Putting up to higher ups with positive remarks",
    hint: "Present the case favourably for the higher authority.",
  },
  {
    value: "putup_negative",
    label: "Putting up to higher ups with negative / cautionary remarks",
    hint: "Submit with adverse, cautionary or neutral observations.",
  },
  {
    value: "other",
    label: "Any other type — to be specified",
    hint: "E.g. seek clarification, defer for funds, approve with conditions.",
  },
];

export interface CaseAnalysis {
  subject: string;
  reference: string;
  brief: string;
  facts: string[];
  issues: string[];
  deficiencies: string[];
  rules: string[];
  recommendation: string;
  verdict:
    | "fit_for_approval"
    | "not_fit"
    | "approve_with_conditions"
    | "needs_clarification"
    | "higher_authority"
    | "needs_examination";
}
