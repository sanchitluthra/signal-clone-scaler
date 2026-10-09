"use client";

import { useState, useEffect } from "react";
import { useChatStore } from "@/store/useChatStore";
import { Avatar } from "@/components/ui/Avatar";
import { Search, X, Users, UserPlus } from "lucide-react";

interface ComposeModalProps {
  onClose: () => void;
  onOpenCreateGroup: () => void;
}

export function ComposeModal({ onClose, onOpenCreateGroup }: ComposeModalProps) {
  const { contacts, fetchContacts, addContact, openDirect } = useChatStore();
  const [search, setSearch] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newContactPhone, setNewContactPhone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const filteredContacts = contacts.filter((c) =>
    (c.user.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
    c.user.phone.includes(search)
  );

  const handleAddContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContactPhone.trim()) return;
    
    const success = await addContact(newContactPhone.trim());
    if (success) {
      setNewContactPhone("");
      setIsAdding(false);
      setError("");
    } else {
      setError("User not found or already in contacts.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-[#202c33] w-full max-w-md rounded-lg shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-white/10">
        <div className="h-14 px-4 flex items-center justify-between bg-[#202c33] border-b border-white/5 shrink-0">
          <h2 className="text-white font-medium text-lg">New Chat</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-white rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
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
          {!isAdding ? (
            <div 
              onClick={() => setIsAdding(true)}
              className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-signal-blue/20 flex items-center justify-center text-signal-blue">
                <UserPlus className="w-5 h-5" />
              </div>
              <span className="ml-4 text-gray-200 font-medium">Add New Contact</span>
            </div>
          ) : (
            <form onSubmit={handleAddContact} className="px-4 py-3 bg-white/5 border-b border-white/5">
              <p className="text-xs text-gray-400 mb-2">Enter phone number (e.g. +15550000003)</p>
              <div className="flex space-x-2">
                <input
                  type="text"
                  autoFocus
                  className="flex-1 px-3 py-1.5 rounded bg-[#2a2a2a] text-white focus:outline-none focus:ring-1 focus:ring-signal-blue text-sm"
                  placeholder="Phone number"
                  value={newContactPhone}
                  onChange={(e) => setNewContactPhone(e.target.value)}
                />
                <button type="submit" className="bg-signal-blue text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-blue-600 transition-colors">
                  Add
                </button>
              </div>
              {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
            </form>
          )}

          <div 
            onClick={() => { onClose(); onOpenCreateGroup(); }}
            className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
          >
            <div className="w-10 h-10 rounded-full bg-signal-blue/20 flex items-center justify-center text-signal-blue">
              <Users className="w-5 h-5" />
            </div>
            <span className="ml-4 text-gray-200 font-medium">New Group</span>
          </div>

          <div className="px-4 py-2 mt-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacts on Signal</h3>
          </div>

          {filteredContacts.length === 0 ? (
            <div className="px-4 py-6 text-center text-gray-500 text-sm">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.user.id}
                onClick={() => {
                  openDirect(contact.user.id);
                  onClose();
                }}
                className="flex items-center px-4 py-3 cursor-pointer hover:bg-white/5 transition-colors"
              >
                <Avatar name={contact.user.display_name || contact.user.phone} color={contact.user.avatar_color} size="md" />
                <div className="ml-4 flex-1 border-b border-white/5 pb-3 -mb-3">
                  <div className="text-gray-200 font-medium">{contact.user.display_name || contact.user.phone}</div>
                  {contact.user.display_name && (
                    <div className="text-xs text-gray-500 mt-0.5">{contact.user.phone}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
