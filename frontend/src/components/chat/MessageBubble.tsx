import { useAuthStore } from "@/store/useAuthStore";
import { Message } from "@/store/useChatStore";
import { formatTime, cn } from "@/lib/utils";
import { Check, CheckCheck } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  senderName?: string;
  senderColor?: string;
}

export function MessageBubble({ message, showAvatar, senderName, senderColor }: MessageBubbleProps) {
  const { user } = useAuthStore();
  const isMine = message.sender_id === user?.id;
  const isSystem = message.kind === "system";

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

  return (
    <div className={cn("flex flex-col mb-1 group relative", isMine ? "items-end" : "items-start")}>
      <div className={cn(
        "max-w-[75%] sm:max-w-[65%] px-3.5 py-2 relative shadow-sm",
        isMine 
          ? "bg-[#2C6BED] text-white rounded-[20px] rounded-br-[4px]" 
          : "bg-[#2C2C2C] text-white rounded-[20px] rounded-bl-[4px] border border-white/5"
      )}>
        {!isMine && showAvatar && senderName && (
          <div className="text-[12px] font-bold mb-0.5 tracking-wide" style={{ color: senderColor || "#888" }}>
            {senderName}
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
    </div>
  );
}
