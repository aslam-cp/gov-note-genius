import { createFileRoute } from "@tanstack/react-router";
import UploadScreen from "@/components/UploadScreen";

export const Route = createFileRoute("/case/$caseId/upload")({ component: UploadScreen });
