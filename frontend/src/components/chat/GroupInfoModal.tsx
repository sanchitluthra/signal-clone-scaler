"use client";

import { useState } from "react";
import { useChatStore, Member } from "@/store/useChatStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Avatar } from "@/components/ui/Avatar";
import { X, UserMinus, UserPlus, Settings } from "lucide-react";

interface GroupInfoModalProps {
  conversationId: number;
  onClose: () => void;
}

export function GroupInfoModal({ conversationId, onClose }: GroupInfoModalProps) {
  const { user } = useAuthStore();
  const { conversations, contacts, addGroupMembers, removeGroupMember } = useChatStore();
  
  const conversation = conversations.find(c => c.id === conversationId);
  const [showAddMember, setShowAddMember] = useState(false);

  if (!conversation) return null;

  const myMember = conversation.members.find(m => m.user.id === user?.id);
  const isAdmin = myMember?.role === "admin";
  const memberIds = conversation.members.map(m => m.user.id);
  
  // Contacts not already in the group
  const availableContacts = contacts.filter(c => !memberIds.includes(c.user.id));

  const handleAddMember = async (userId: number) => {
    await addGroupMembers(conversationId, [userId]);
    setShowAddMember(false);
  };

  const handleRemoveMember = async (userId: number) => {
    if (confirm("Are you sure you want to remove this member?")) {
      await removeGroupMember(conversationId, userId);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#202c33] w-full max-w-md rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/10">
        <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] border-b border-white/5 shrink-0">
          <h2 className="text-white font-medium text-lg">Group Info</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col items-center border-b border-white/5 shrink-0">
          <Avatar name={conversation.title!} color={conversation.avatar_color || "#2c6bed"} size="lg" className="w-24 h-24 text-3xl mb-4" />
          <h2 className="text-2xl text-white font-medium">{conversation.title}</h2>
          <p className="text-gray-400 mt-1">Group • {conversation.members.length} members</p>
        </div>

        {!showAddMember ? (
          <div className="flex-1 overflow-y-auto no-scrollbar pb-2">
            <div className="px-4 py-3 flex items-center justify-between bg-white/5">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{conversation.members.length} Members</h3>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddMember(true)}
                  className="flex items-center text-signal-blue text-sm font-medium hover:text-blue-400 transition-colors"
                >
                  <UserPlus className="w-4 h-4 mr-1" />
                  Add
                </button>
              )}
            </div>

            {conversation.members.map((member) => (
              <div
                key={member.user.id}
                className="flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center flex-1">
                  <Avatar name={member.user.display_name || member.user.phone} color={member.user.avatar_color} size="md" />
                  <div className="ml-4 flex-1">
                    <div className="text-gray-200 font-medium">
                      {member.user.display_name || member.user.phone} {member.user.id === user?.id && "(You)"}
                    </div>
                    {member.role === "admin" && (
                      <div className="text-xs text-signal-blue mt-0.5">Group Admin</div>
                    )}
                  </div>
                </div>
                {isAdmin && member.user.id !== user?.id && (
                  <button 
                    onClick={() => handleRemoveMember(member.user.id)}
                    className="p-2 text-gray-500 hover:text-red-400 rounded-full transition-colors"
                    title="Remove member"
                  >
                    <UserMinus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 py-3 flex items-center bg-white/5 border-b border-white/5 shrink-0">
              <button 
                onClick={() => setShowAddMember(false)}
                className="text-signal-blue text-sm font-medium hover:text-blue-400 transition-colors mr-3"
              >
                Back
              </button>
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1 text-center pr-8">Add Member</h3>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar pb-2">
              {availableContacts.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-500 text-sm">
                  No other contacts available.
                </div>
              ) : (
                availableContacts.map((contact) => (
                  <div
                    key={contact.user.id}
                    onClick={() => handleAddMember(contact.user.id)}
                    className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <Avatar name={contact.user.display_name || contact.user.phone} color={contact.user.avatar_color} size="md" />
                    <div className="ml-4 flex-1">
                      <div className="text-gray-200 font-medium">{contact.user.display_name || contact.user.phone}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
