"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useChatStore, Member } from "@/store/useChatStore";
import { Avatar } from "@/components/ui/Avatar";
import { Edit, MoreVertical, Search, Settings, X } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { ComposeModal } from "./ComposeModal";
import { CreateGroupModal } from "./CreateGroupModal";

export function Sidebar() {
  const { user } = useAuthStore();
  const { conversations, fetchConversations, activeConversationId, setActiveConversation } = useChatStore();
  const [search, setSearch] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  const filteredConversations = conversations.filter(c => {
    const isGroup = c.kind === "group";
    if (isGroup) {
      return c.title?.toLowerCase().includes(search.toLowerCase());
    }
    const otherMember = c.members.find(m => m.user.id !== user?.id)?.user;
    return (
      otherMember?.display_name.toLowerCase().includes(search.toLowerCase()) ||
      otherMember?.phone.includes(search)
    );
  });

  return (
    <div className={cn(
      "w-full md:w-80 lg:w-[400px] flex-col bg-[#111b21] border-r border-white/5 h-full transition-all duration-300",
      activeConversationId ? "hidden md:flex" : "flex"
    )}>
      {/* Header */}
      <div className="h-16 px-4 flex items-center justify-between sticky top-0 bg-[#202c33] z-10">
        <div className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity">
          <Avatar name={user?.display_name || user?.phone || "User"} color={user?.avatar_color} size="sm" />
          <h2 className="font-semibold text-white tracking-tight truncate max-w-[120px]">{user?.display_name || user?.phone}</h2>
        </div>
        <div className="flex items-center space-x-2 text-gray-400">
          <button 
            onClick={() => useAuthStore.getState().logout()}
            className="text-xs font-semibold px-2 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/40 rounded transition-colors"
          >
            Logout
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowCompose(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block"
            title="New Chat"
          >
            <Edit className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-full transition-colors hidden sm:block">
            <MoreVertical className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-gray-500" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border-transparent rounded-xl leading-5 bg-[#2a2a2a] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-signal-blue focus:bg-[#333] transition-colors sm:text-sm"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {filteredConversations.map((conv) => {
          const isGroup = conv.kind === "group";
          const otherMember = conv.members.find(m => m.user.id !== user?.id)?.user || conv.members[0]?.user;
          const displayName = isGroup ? conv.title : (otherMember?.display_name || otherMember?.phone || "Unknown");
          const avatarColor = isGroup ? conv.avatar_color || "#2c6bed" : otherMember?.avatar_color;
          
          const isSelected = activeConversationId === conv.id;
          const isUnread = conv.unread_count > 0;
          const lastMsg = conv.last_message;

          const typingUsers = useChatStore.getState().typingUsers[conv.id] || [];
          const isSomeoneTyping = typingUsers.length > 0;

          return (
            <div
              key={conv.id}
              onClick={() => setActiveConversation(conv.id)}
              className={cn(
                "flex items-center px-4 py-3 cursor-pointer transition-colors group",
                isSelected ? "bg-signal-blue/10" : "hover:bg-white/5"
              )}
            >
              <Avatar name={displayName!} color={avatarColor} size="md" />
              
              <div className="ml-3 flex-1 overflow-hidden">
                <div className="flex justify-between items-baseline">
                  <span className={cn(
                    "text-[15px] truncate font-medium",
                    isUnread ? "text-white" : "text-gray-200"
                  )}>
                    {displayName}
                  </span>
                  {lastMsg && (
                    <span className={cn(
                      "text-xs ml-2 shrink-0",
                      isUnread ? "text-signal-blue font-semibold" : "text-gray-500"
                    )}>
                      {formatDate(lastMsg.created_at)}
                    </span>
                  )}
                </div>
                
                <div className="flex justify-between items-center mt-0.5">
                  <div className="truncate text-[13px] text-gray-400">
                    {isSomeoneTyping ? (
                      <span className="text-signal-blue italic animate-pulse">typing...</span>
                    ) : lastMsg ? (
                      <span className={cn(isUnread && "text-gray-300 font-medium")}>
                        {lastMsg.sender_id === user?.id && <span className="mr-1">You:</span>}
                        {lastMsg.body || (lastMsg.attachment ? "Sent an attachment" : "")}
                      </span>
                    ) : (
                      <span className="italic">No messages yet</span>
                    )}
                  </div>
                  {isUnread && (
                    <div className="ml-2 bg-signal-blue text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {conv.unread_count}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showCompose && (
        <ComposeModal 
          onClose={() => setShowCompose(false)} 
          onOpenCreateGroup={() => setShowCreateGroup(true)} 
        />
      )}
      {showCreateGroup && (
        <CreateGroupModal onClose={() => setShowCreateGroup(false)} />
      )}

      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#202c33] w-full max-w-sm rounded-lg shadow-2xl flex flex-col overflow-hidden border border-white/10">
            <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] border-b border-white/5 shrink-0">
              <h2 className="text-white font-medium text-lg">Settings</h2>
              <button onClick={() => setShowSettings(false)} className="p-2 text-gray-400 hover:text-white rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col space-y-4">
               <div className="text-white border-b border-white/10 pb-4 cursor-pointer hover:opacity-80">Privacy <span className="text-xs text-signal-blue block">Coming Soon</span></div>
               <div className="text-white border-b border-white/10 pb-4 cursor-pointer hover:opacity-80">Notifications <span className="text-xs text-signal-blue block">Coming Soon</span></div>
               <div className="text-white pb-2 cursor-pointer hover:opacity-80">Appearance <span className="text-xs text-signal-blue block">Coming Soon</span></div>
               <div className="text-white pb-2 cursor-pointer hover:opacity-80">Linked Devices <span className="text-xs text-signal-blue block">Coming Soon</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
