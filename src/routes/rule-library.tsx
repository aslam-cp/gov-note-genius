import { createFileRoute } from "@tanstack/react-router";
import RuleLibraryScreen from "@/components/RuleLibraryScreen";

export const Route = createFileRoute("/rule-library")({ component: RuleLibraryScreen });
