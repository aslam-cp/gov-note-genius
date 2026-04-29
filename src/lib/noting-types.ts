export type NotingType = "approve" | "reject" | "putup_positive" | "putup_negative" | "other";

export const NOTING_OPTIONS: { value: NotingType; label: string; hint: string }[] = [
  {
    value: "approve",
    label: "For Approval with reasoning (final order by Director / CEO)",
    hint: "The Director / CEO of the organization grants approval, with full reasoning.",
  },
  {
    value: "reject",
    label: "For Rejection with reasoning (final order by Director / CEO)",
    hint: "The Director / CEO of the organization rejects the proposal, with full reasoning.",
  },
  {
    value: "putup_positive",
    label: "Putting up to higher ups with positive remarks",
    hint: "Submit the case to a higher authority with favourable remarks.",
  },
  {
    value: "putup_negative",
    label: "Putting up to higher ups with negative / cautionary remarks",
    hint: "Submit the case to a higher authority with adverse / cautionary observations.",
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
