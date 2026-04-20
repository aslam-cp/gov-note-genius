import { createFileRoute } from "@tanstack/react-router";
import HistoryScreen from "@/components/HistoryScreen";

export const Route = createFileRoute("/history")({ component: HistoryScreen });
