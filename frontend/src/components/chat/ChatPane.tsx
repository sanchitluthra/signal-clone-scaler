"use client";

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Avatar } from "@/components/ui/Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { Phone, Video, MoreVertical, ArrowLeft } from "lucide-react";
import { GroupInfoModal } from "./GroupInfoModal";
import { cn } from "@/lib/utils";

export function ChatPane() {
  const { user } = useAuthStore();
  const { activeConversationId, conversations, messages, typingUsers, setActiveConversation } = useChatStore();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);

  const conversation = conversations.find(c => c.id === activeConversationId);
  const conversationMessages = activeConversationId ? (messages[activeConversationId] || []) : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages]);

  if (!conversation) return null;

  const isGroup = conversation.kind === "group";
  const otherMember = conversation.members.find(m => m.user.id !== user?.id)?.user || conversation.members[0]?.user;
  const displayName = isGroup ? conversation.title : (otherMember?.display_name || otherMember?.phone || "Unknown");
  const avatarColor = isGroup ? conversation.avatar_color || "#2c6bed" : otherMember?.avatar_color;

  const activeTypingUsers = typingUsers[conversation.id] || [];
  const isSomeoneTyping = activeTypingUsers.length > 0;

  const myMember = conversation.members.find(m => m.user.id === user?.id);

  return (
    <div className="flex-1 flex flex-col bg-[#0b141a] relative overflow-hidden h-full">
      {/* Premium Signal-like subtle pattern background */}
      <div 
        className="absolute inset-0 opacity-[0.06] pointer-events-none" 
        style={{ 
          backgroundImage: "url('https://static.whatsapp.net/env/r/whatsapp/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')",
          backgroundRepeat: "repeat",
          backgroundSize: "400px"
        }}
      ></div>

      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between bg-[#202c33] border-b border-white/5 shadow-sm z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <button 
            className="md:hidden p-2 -ml-2 text-gray-400 hover:text-white transition-colors"
            onClick={() => setActiveConversation(null)}
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          
          <Avatar name={displayName!} color={avatarColor} size="md" />
          
          <div 
            className={cn("flex flex-col", isGroup && myMember && "cursor-pointer hover:opacity-80 transition-opacity")}
            onClick={() => isGroup && myMember && setShowGroupInfo(true)}
          >
            <span className="font-semibold text-white tracking-tight">{displayName}</span>
            <span className="text-[13px] text-gray-400">
              {isSomeoneTyping ? (
                <span className="text-signal-blue italic animate-pulse">typing...</span>
              ) : isGroup ? (
                `${conversation.members.length} members`
              ) : (
                otherMember?.is_online ? "Online" : "Offline"
              )}
            </span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 text-gray-400">
          <button onClick={() => window.alert("Voice/Video calls coming soon!")} className="p-2.5 hover:bg-white/10 rounded-full transition-colors hidden sm:block">
            <Video className="w-5 h-5" />
          </button>
          <button onClick={() => window.alert("Voice/Video calls coming soon!")} className="p-2.5 hover:bg-white/10 rounded-full transition-colors hidden sm:block">
            <Phone className="w-5 h-5" />
          </button>
          <button className="p-2.5 hover:bg-white/10 rounded-full transition-colors">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 no-scrollbar relative z-0 flex flex-col">
        {conversationMessages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center bg-[#1e1e1e] p-6 rounded-2xl max-w-sm">
              <Avatar name={displayName!} color={avatarColor} size="lg" className="mx-auto mb-4" />
              <h3 className="text-white font-medium mb-1">Start chatting with {displayName}</h3>
              <p className="text-sm text-gray-400">Messages to this chat and calls are now secured with end-to-end encryption.</p>
            </div>
          </div>
        ) : (
          conversationMessages.map((msg, idx) => {
            const prevMsg = conversationMessages[idx - 1];
            const showAvatar = isGroup && 
              msg.sender_id !== user?.id && 
              (!prevMsg || prevMsg.sender_id !== msg.sender_id);
            
            const sender = conversation.members.find(m => m.user.id === msg.sender_id)?.user;
            
            return (
              <MessageBubble 
                key={msg.id} 
                message={msg} 
                showAvatar={showAvatar}
                senderName={sender?.display_name || sender?.phone}
                senderColor={sender?.avatar_color}
              />
            );
          })
        )}
        
        {isSomeoneTyping && (
          <div className="flex flex-col mb-1 items-start group relative">
            <div className="max-w-[75%] sm:max-w-[65%] px-3.5 py-2.5 relative shadow-sm bg-[#2C2C2C] text-white rounded-[20px] rounded-bl-[4px] border border-white/5">
              <div className="flex items-center space-x-1.5 h-4">
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={bottomRef} className="h-1" />
      </div>

      {/* Input Area */}
      {myMember ? (
        <MessageInput conversationId={conversation.id} />
      ) : (
        <div className="p-4 bg-[#1e1e1e] border-t border-white/5 text-center text-gray-400 text-sm">
          You can no longer send messages to this group.
        </div>
      )}
      
      {showGroupInfo && isGroup && (
        <GroupInfoModal 
          conversationId={conversation.id} 
          onClose={() => setShowGroupInfo(false)} 
        />
      )}
    </div>
  );
}
