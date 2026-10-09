import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { Message } from "@/store/useChatStore";
import { formatTime, cn } from "@/lib/utils";
import { Check, CheckCheck, Smile, Reply, FileText, Image as ImageIcon } from "lucide-react";
import { api } from "@/lib/api";

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  senderName?: string;
  senderColor?: string;
  onReply?: (msg: Message) => void;
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({ message, showAvatar, senderName, senderColor, onReply }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const [showReactions, setShowReactions] = useState(false);
  const isMine = message.sender_id === user?.id;
  const isSystem = message.kind === "system";

  const handleReact = async (emoji: string) => {
    setShowReactions(false);
    try {
      // Toggle logic: if we already reacted with this emoji, delete it
      const existing = message.reactions?.find(r => r.user_id === user?.id && r.emoji === emoji);
      if (existing) {
        await api.delete(`/messages/${message.id}/reaction`);
      } else {
        await api.put(`/messages/${message.id}/reaction`, { emoji });
      }
    } catch (e) {
      console.error("Failed to react", e);
    }
  };

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <div className="bg-black/30 backdrop-blur text-gray-300 text-xs px-4 py-1.5 rounded-full font-medium shadow-sm border border-white/5">
          {senderName} {message.body}
        </div>
      </div>
    );
  }

  let receiptIcon = <Check className="w-3.5 h-3.5 text-gray-400" />;
  if (isMine) {
    if (message.status === "read") {
      receiptIcon = <CheckCheck className="w-4 h-4 text-[#3A82F6]" />;
    } else if (message.status === "delivered") {
      receiptIcon = <CheckCheck className="w-4 h-4 text-gray-400" />;
    }
  }

  // Group reactions by emoji
  const reactionCounts: Record<string, number> = {};
  message.reactions?.forEach(r => {
    reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1;
  });

  return (
    <div className={cn("flex flex-col mb-1 group relative", isMine ? "items-end" : "items-start")}>
      <div className={cn("flex items-center space-x-2 relative", isMine ? "flex-row-reverse space-x-reverse" : "flex-row")}>
        
        {/* Message Bubble */}
        <div className={cn(
          "max-w-xs sm:max-w-md md:max-w-lg px-3.5 py-2 relative shadow-sm z-10",
          isMine 
            ? "bg-[#2C6BED] text-white rounded-[20px] rounded-br-[4px]" 
            : "bg-[#2C2C2C] text-white rounded-[20px] rounded-bl-[4px] border border-white/5"
        )}>
          {!isMine && showAvatar && senderName && (
            <div className="text-[12px] font-bold mb-0.5 tracking-wide" style={{ color: senderColor || "#888" }}>
              {senderName}
            </div>
          )}

          {/* Quoted Reply */}
          {message.reply_to && (
            <div className={cn(
              "mb-2 p-2 rounded border-l-4 text-sm truncate opacity-90",
              isMine ? "bg-white/20 border-white/50" : "bg-black/20 border-signal-blue"
            )}>
              <span className="font-semibold block text-xs mb-0.5" style={{ color: isMine ? "white" : "#888" }}>
                { (message.reply_to as any).sender?.display_name || "message" }
              </span>
              {message.reply_to.body || "Attachment"}
            </div>
          )}

          {/* Attachment */}
          {message.attachment && (
            <div className="mb-2 rounded overflow-hidden">
              {message.attachment.content_type?.startsWith("image/") ? (
                <img 
                  src={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace("/api", "") + "/uploads/" + message.attachment.storage_name} 
                  alt={message.attachment.file_name} 
                  className="max-w-full h-auto max-h-64 object-cover"
                />
              ) : (
                <a 
                  href={(process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api").replace("/api", "") + "/uploads/" + message.attachment.storage_name}
                  target="_blank" rel="noreferrer"
                  className={cn(
                    "flex items-center space-x-2 p-3 rounded text-sm hover:opacity-80 transition-opacity",
                    isMine ? "bg-white/10" : "bg-black/20"
                  )}
                >
                  <FileText className="w-6 h-6 shrink-0" />
                  <span className="truncate">{message.attachment.file_name}</span>
                </a>
              )}
            </div>
          )}
          
          <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap">
            {message.body}
          </div>
          
          <div className="flex items-center justify-end space-x-1 mt-1 -mb-0.5 text-[10px] text-white/70 select-none">
            <span>{formatTime(message.created_at)}</span>
            {isMine && receiptIcon}
          </div>
        </div>

        {/* Action Buttons (Reply / React) */}
        {!isSystem && (
          <div className={cn(
            "opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 absolute",
            isMine ? "right-full mr-2" : "left-full ml-2"
          )}>
            <div className="relative">
              <button 
                onClick={() => setShowReactions(!showReactions)}
                className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-gray-400 hover:text-white backdrop-blur border border-white/5"
              >
                <Smile className="w-4 h-4" />
              </button>
              {/* Reaction Picker Popover */}
              {showReactions && (
                <div className={cn(
                  "absolute top-full mt-1 flex items-center space-x-1 p-1.5 bg-[#2a2a2a] border border-white/10 rounded-full shadow-xl z-50",
                  isMine ? "right-0" : "left-0"
                )}>
                  {EMOJIS.map(emoji => (
                    <button 
                      key={emoji} 
                      onClick={() => handleReact(emoji)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-full text-lg transition-transform hover:scale-125"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onReply && (
              <button 
                onClick={() => onReply(message)}
                className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-gray-400 hover:text-white backdrop-blur border border-white/5"
              >
                <Reply className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Render existing reactions below bubble */}
      {Object.keys(reactionCounts).length > 0 && (
        <div className={cn(
          "flex flex-wrap gap-1 mt-1 z-20",
          isMine ? "mr-2" : "ml-2"
        )}>
          {Object.entries(reactionCounts).map(([emoji, count]) => {
            const hasMyReaction = message.reactions?.some(r => r.user_id === user?.id && r.emoji === emoji);
            return (
              <button
                key={emoji}
                onClick={() => handleReact(emoji)}
                className={cn(
                  "flex items-center space-x-1 px-1.5 py-0.5 rounded-full text-xs font-medium border shadow-sm transition-colors",
                  hasMyReaction 
                    ? "bg-signal-blue/20 border-signal-blue/30 text-signal-blue" 
                    : "bg-[#2a2a2a] border-white/10 text-gray-300 hover:bg-[#333]"
                )}
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
