"use client";

import { useState, useRef, useEffect } from "react";
import { Smile, Paperclip, Send, Mic, X, Loader2, Image as ImageIcon, FileText } from "lucide-react";
import { useChatStore, Message } from "@/store/useChatStore";
import { api } from "@/lib/api";

interface MessageInputProps {
  conversationId: number;
  replyTo?: Message | null;
  onCancelReply?: () => void;
}

export function MessageInput({ conversationId, replyTo, onCancelReply }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [attachment, setAttachment] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const data = await api.upload("/attachments", file);
      setAttachment(data);
    } catch (err) {
      console.error("Upload failed", err);
      alert("Failed to upload file");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !attachment) return;
    
    sendMessage(conversationId, content, replyTo?.id, attachment?.id);
    setContent("");
    setAttachment(null);
    if (onCancelReply) onCancelReply();
    
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
    <div className="flex flex-col bg-[#1e1e1e] border-t border-white/5">
      {/* Reply Preview */}
      {replyTo && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-signal-blue">Replying to { (replyTo as any).sender?.display_name || "message" }</span>
            <span className="text-sm text-gray-400 truncate max-w-md">{replyTo.body || "Attachment"}</span>
          </div>
          <button onClick={onCancelReply} className="p-1 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Attachment Preview */}
      {attachment && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-black/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-black/40 rounded flex items-center justify-center">
              {attachment.content_type?.startsWith("image/") ? (
                <ImageIcon className="w-5 h-5 text-gray-400" />
              ) : (
                <FileText className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm text-gray-300 truncate max-w-[200px]">{attachment.file_name}</span>
              <span className="text-xs text-gray-500">{(attachment.size_bytes / 1024).toFixed(1)} KB</span>
            </div>
          </div>
          <button onClick={() => setAttachment(null)} className="p-1 text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 flex items-end space-x-2">
        <button type="button" className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0">
          <Smile className="w-6 h-6" />
        </button>
        
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <button 
          type="button" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors shrink-0 disabled:opacity-50"
        >
          {isUploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Paperclip className="w-6 h-6" />}
        </button>
        
        <div className="flex-1 bg-[#2a2a2a] rounded-2xl border border-transparent focus-within:border-white/10 focus-within:bg-[#333] transition-colors flex items-center min-h-[44px]">
          <input
            type="text"
            value={content}
            onChange={handleTextChange}
            placeholder={attachment ? "Add a caption..." : "Message"}
            className="w-full bg-transparent text-white px-4 py-2.5 focus:outline-none placeholder:text-gray-500"
          />
        </div>

        {(content.trim() || attachment) ? (
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
    </div>
  );
}
