import type { Metadata } from "next";
import { FeedbackList } from "@/components/log/feedback-list";

export const metadata: Metadata = { title: "Feedback" };

export default function FeedbackPage() {
  return <FeedbackList />;
}
