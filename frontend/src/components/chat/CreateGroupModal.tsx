"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { Avatar } from "@/components/ui/Avatar";
import { X, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateGroupModalProps {
  onClose: () => void;
}

export function CreateGroupModal({ onClose }: CreateGroupModalProps) {
  const { contacts, fetchContacts, createGroup } = useChatStore();
  const [title, setTitle] = useState("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = contacts.filter((c) =>
    (c.user.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
    c.user.phone.includes(search)
  );

  const toggleContact = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || selectedIds.length === 0) return;
    await createGroup(title.trim(), selectedIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#202c33] w-full max-w-md rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/10">
        <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] border-b border-white/5 shrink-0">
          <h2 className="text-white font-medium text-lg">Create Group</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleCreate} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-4 shrink-0 border-b border-white/5">
            <input
              type="text"
              autoFocus
              className="block w-full px-3 py-2 border-b-2 border-signal-blue bg-transparent text-white placeholder-gray-500 focus:outline-none transition-colors"
              placeholder="Group Subject"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="p-3 shrink-0">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border-transparent rounded-lg leading-5 bg-[#2a2a2a] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-signal-blue transition-colors sm:text-sm"
                placeholder="Search contacts"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pb-2">
            <div className="px-4 py-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Members</h3>
            </div>

            {filteredContacts.length === 0 ? (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No contacts found
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div
                  key={contact.user.id}
                  onClick={() => toggleContact(contact.user.id)}
                  className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
                >
                  <div className="w-5 h-5 mr-4 border border-gray-400 rounded-sm flex items-center justify-center">
                    {selectedIds.includes(contact.user.id) && (
                      <div className="w-3 h-3 bg-signal-blue rounded-sm" />
                    )}
                  </div>
                  <Avatar name={contact.user.display_name || contact.user.phone} color={contact.user.avatar_color} size="md" />
                  <div className="ml-4 flex-1">
                    <div className="text-gray-200 font-medium">{contact.user.display_name || contact.user.phone}</div>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-4 bg-[#202c33] border-t border-white/5 shrink-0 flex justify-end">
            <button 
              type="submit" 
              disabled={!title.trim() || selectedIds.length === 0}
              className="bg-signal-blue disabled:opacity-50 text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-blue-600 transition-colors shadow-lg shadow-signal-blue/20"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
