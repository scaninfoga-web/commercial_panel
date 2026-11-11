"use client";

import { useParams, useRouter } from "next/navigation";
import ChatSupport from "@/components/pages/get-support/chat_support";

export default function SupportChatPage() {
  const router = useRouter();
  const params = useParams<{ issueId: string }>();

  return (
    <ChatSupport
      issueId={decodeURIComponent(params.issueId)}
      onClose={() => router.push("/get_support")}
    />
  );
}
