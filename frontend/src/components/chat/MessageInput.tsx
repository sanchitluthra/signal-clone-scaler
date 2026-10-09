"use client";

import { useState, useRef, useEffect } from "react";
import { Smile, Paperclip, Send, Mic } from "lucide-react";
import { useChatStore } from "@/store/useChatStore";

interface MessageInputProps {
  conversationId: number;
}

export function MessageInput({ conversationId }: MessageInputProps) {
  const [content, setContent] = useState("");
  const { sendMessage, sendTyping } = useChatStore();
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setContent(e.target.value);
    
    // Typing indicator logic
    sendTyping(conversationId, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(conversationId, false);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    
    sendMessage(conversationId, content);
    setContent("");
    sendTyping(conversationId, false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      // Ensure we send false when unmounting
      sendTyping(conversationId, false);
    };
  }, [conversationId, sendTyping]);

  return (
    <form onSubmit={handleSubmit} className="p-3 bg-[#1e1e1e] border-t border-white/5 flex items-end space-x-2">
      <button type="button" className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0">
        <Smile className="w-6 h-6" />
      </button>
      <button type="button" className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0">
        <Paperclip className="w-6 h-6" />
      </button>
      
      <div className="flex-1 bg-[#2a2a2a] rounded-2xl border border-transparent focus-within:border-white/10 focus-within:bg-[#333] transition-colors flex items-center">
        <input
          type="text"
          value={content}
          onChange={handleTextChange}
          placeholder="Message"
          className="w-full bg-transparent text-white px-4 py-3 focus:outline-none placeholder:text-gray-500"
        />
      </div>

      {content.trim() ? (
        <button 
          type="submit"
          className="p-3 bg-signal-blue hover:bg-blue-600 text-white rounded-full transition-colors shrink-0 shadow-lg shadow-signal-blue/20"
        >
          <Send className="w-5 h-5 ml-0.5" />
        </button>
      ) : (
        <button type="button" className="p-3 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0">
          <Mic className="w-6 h-6" />
        </button>
      )}
    </form>
  );
}
