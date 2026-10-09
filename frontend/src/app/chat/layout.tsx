"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/useAuthStore";
import { Loader2 } from "lucide-react";

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, user } = useAuthStore();
  const [isMounting, setIsMounting] = useState(true);

  useEffect(() => {
    setIsMounting(false);
    if (!isAuthenticated && !useAuthStore.getState().token) {
      router.push("/");
    }
  }, [isAuthenticated, router]);

  if (isMounting || (!isAuthenticated && useAuthStore.getState().token)) {
    return (
      <div className="h-screen w-screen bg-signal-dark flex items-center justify-center">
         <Loader2 className="w-8 h-8 text-signal-blue animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-signal-darker text-white">
      {children}
    </div>
  );
}
