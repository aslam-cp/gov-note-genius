import { createFileRoute } from "@tanstack/react-router";
import AnalysisScreen from "@/components/AnalysisScreen";

export const Route = createFileRoute("/case/$caseId/analysis")({ component: AnalysisScreen });
