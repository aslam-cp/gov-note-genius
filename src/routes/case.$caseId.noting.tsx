import { createFileRoute } from "@tanstack/react-router";
import NotingScreen from "@/components/NotingScreen";

export const Route = createFileRoute("/case/$caseId/noting")({ component: NotingScreen });
