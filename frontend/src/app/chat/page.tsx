"use client";

import { Sidebar } from "@/components/chat/Sidebar";
import { ChatPane } from "@/components/chat/ChatPane";
import { useChatStore } from "@/store/useChatStore";

export default function ChatPage() {
  const activeConversationId = useChatStore((state) => state.activeConversationId);

  return (
    <>
      <Sidebar />
      {activeConversationId ? (
        <ChatPane />
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-signal-dark border-l border-white/10 hidden md:flex">
          <div className="text-center p-8 max-w-sm">
            <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-gray-500">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className="text-xl font-medium text-white mb-2">Signal Clone for Web</h3>
            <p className="text-sm text-gray-400">Send and receive messages without keeping your phone online. Use Signal on up to 4 linked devices and 1 phone at the same time.</p>
          </div>
        </div>
      )}
    </>
  );
}
