import { create } from "zustand";
import { api } from "../lib/api";
import { useAuthStore, User } from "./useAuthStore";

export interface Member {
  user: User;
  role: "admin" | "member";
  joined_at: string;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number;
  kind: "text" | "system";
  body: string;
  created_at: string;
  expires_at: string | null;
  reply_to: any | null;
  attachment: any | null;
  reactions: any[];
  status: "sent" | "delivered" | "read";
  client_id?: string | null;
}

export interface Conversation {
  id: number;
  kind: "direct" | "group";
  title: string | null;
  avatar_color: string;
  disappearing_seconds: number;
  created_at: string;
  last_message_at: string;
  members: Member[];
  last_message: Message | null;
  unread_count: number;
}

interface ChatState {
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Record<number, Message[]>; // conversation_id -> messages
  typingUsers: Record<number, number[]>; // conversation_id -> user_ids
  ws: WebSocket | null;
  isLoading: boolean;
  
  // Actions
  fetchConversations: () => Promise<void>;
  setActiveConversation: (id: number | null) => void;
  fetchMessages: (conversationId: number) => Promise<void>;
  sendMessage: (conversationId: number, body: string) => Promise<void>;
  sendTyping: (conversationId: number, isTyping: boolean) => void;
  markAsRead: (conversationId: number, upToMessageId: number) => void;
  
  // WebSocket lifecycle
  connectSocket: () => void;
  disconnectSocket: () => void;
  
  // Incoming Event Handlers
  handleNewMessage: (msg: Message) => void;
  handleReceiptUpdate: (data: any) => void;
  handleTypingStatus: (data: any) => void;
  
  // Contacts and Groups
  contacts: any[];
  fetchContacts: () => Promise<void>;
  addContact: (query: string) => Promise<boolean>;
  openDirect: (userId: number) => Promise<void>;
  createGroup: (title: string, memberIds: number[]) => Promise<void>;
  removeGroupMember: (conversationId: number, userId: number) => Promise<void>;
  addGroupMembers: (conversationId: number, userIds: number[]) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},
  typingUsers: {},
  ws: null,
  isLoading: false,
  contacts: [],

  fetchConversations: async () => {
    set({ isLoading: true });
    try {
      const conversations = await api.get("/conversations");
      set({ conversations, isLoading: false });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id && !get().messages[id]) {
      get().fetchMessages(id);
    }
    // Clear unread count locally when opened
    if (id) {
      set((state) => ({
        conversations: state.conversations.map((c) =>
          c.id === id ? { ...c, unread_count: 0 } : c
        ),
      }));
    }
  },

  fetchMessages: async (conversationId) => {
    try {
      const msgs = await api.get(`/conversations/${conversationId}/messages`);
      set((state) => ({
        messages: {
          ...state.messages,
          [conversationId]: msgs.reverse(), // backend returns newest first
        },
      }));
      
      const lastMsg = msgs[0];
      if (lastMsg) {
        get().markAsRead(conversationId, lastMsg.id);
      }
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
  },

  sendMessage: async (conversationId, body) => {
    try {
      const msg = await api.post(`/conversations/${conversationId}/messages`, { body });
      set((state) => {
        const convMsgs = state.messages[conversationId] || [];
        const nextMessages = { ...state.messages };
        const idx = convMsgs.findIndex(m => m.id === msg.id);
        if (idx !== -1) {
          nextMessages[conversationId] = [...convMsgs];
          nextMessages[conversationId][idx] = msg;
        } else {
          nextMessages[conversationId] = [...convMsgs, msg];
        }
        return { messages: nextMessages };
      });
    } catch (e) {
      console.error("Failed to send message", e);
    }
  },

  sendTyping: (conversationId, isTyping) => {
    const ws = get().ws;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "typing",
        conversation_id: conversationId,
        is_typing: isTyping
      }));
    }
  },

  markAsRead: (conversationId, upToMessageId) => {
    try {
      api.post(`/conversations/${conversationId}/read`, { up_to_message_id: upToMessageId });
    } catch (e) {}
  },

  connectSocket: () => {
    const token = useAuthStore.getState().token;
    if (!token || get().ws) return;

    const wsUrl = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api")
      .replace("http://", "ws://")
      .replace("https://", "wss://");

    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    ws.onopen = () => console.log("WS Connected");
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        switch (data.type) {
          case "message_new":
            get().handleNewMessage(data.message);
            break;
          case "receipts":
            get().handleReceiptUpdate(data);
            break;
          case "typing":
            get().handleTypingStatus(data);
            break;
          case "conversation_changed":
            get().fetchConversations();
            break;
        }
      } catch (e) {
        console.error("Error parsing WS message", e);
      }
    };

    ws.onclose = () => {
      console.log("WS Disconnected");
      set({ ws: null });
      setTimeout(() => {
        if (useAuthStore.getState().isAuthenticated) get().connectSocket();
      }, 5000);
    };

    set({ ws });
  },

  disconnectSocket: () => {
    const ws = get().ws;
    if (ws) {
      ws.close();
      set({ ws: null });
    }
  },

  handleNewMessage: (msg) => {
    set((state) => {
      const convMsgs = state.messages[msg.conversation_id] || [];
      if (convMsgs.some(m => m.id === msg.id)) return state;
      
      const updatedMessages = [...convMsgs, msg];
      
      let found = false;
      const updatedConversations = state.conversations.map(c => {
        if (c.id === msg.conversation_id) {
          found = true;
          const isUnread = state.activeConversationId !== msg.conversation_id && msg.sender_id !== useAuthStore.getState().user?.id;
          return {
            ...c,
            last_message: msg,
            unread_count: isUnread ? c.unread_count + 1 : c.unread_count,
            last_message_at: msg.created_at
          };
        }
        return c;
      }).sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

      if (!found) {
        // If we received a message for a conversation we don't have yet (e.g., a newly created group)
        setTimeout(() => get().fetchConversations(), 50);
      }

      if (state.activeConversationId === msg.conversation_id && msg.sender_id !== useAuthStore.getState().user?.id) {
        setTimeout(() => get().markAsRead(msg.conversation_id, msg.id), 100);
      }

      return {
        messages: { ...state.messages, [msg.conversation_id]: updatedMessages },
        conversations: found ? updatedConversations : state.conversations
      };
    });
  },

  handleReceiptUpdate: (data) => {
    set((state) => {
      const updates = data.updates || [];
      const nextMessages = { ...state.messages };
      let changed = false;

      for (const u of updates) {
        const convMsgs = nextMessages[u.conversation_id];
        if (convMsgs) {
          const idx = convMsgs.findIndex(m => m.id === u.message_id);
          if (idx !== -1 && convMsgs[idx].status !== u.status) {
            if (!changed) changed = true;
            nextMessages[u.conversation_id] = [...convMsgs];
            nextMessages[u.conversation_id][idx] = { ...convMsgs[idx], status: u.status };
          }
        }
      }

      return changed ? { messages: nextMessages } : state;
    });
  },

  handleTypingStatus: (data) => {
    const { conversation_id, user_id, is_typing } = data;
    set((state) => {
      const typingUsersForConv = new Set(state.typingUsers[conversation_id] || []);
      if (is_typing) {
        typingUsersForConv.add(user_id);
      } else {
        typingUsersForConv.delete(user_id);
      }
      return {
        typingUsers: {
          ...state.typingUsers,
          [conversation_id]: Array.from(typingUsersForConv)
        }
      };
    });
  },

  fetchContacts: async () => {
    try {
      const contacts = await api.get("/contacts");
      set({ contacts });
    } catch (e) {
      console.error("Failed to fetch contacts", e);
    }
  },

  addContact: async (query) => {
    try {
      await api.post("/contacts", { query });
      get().fetchContacts();
      return true;
    } catch (e) {
      console.error("Failed to add contact", e);
      return false;
    }
  },

  openDirect: async (userId) => {
    try {
      const conv = await api.post("/conversations/direct", { user_id: userId });
      get().fetchConversations();
      get().setActiveConversation(conv.id);
    } catch (e) {
      console.error("Failed to open direct chat", e);
    }
  },

  createGroup: async (title, memberIds) => {
    try {
      const conv = await api.post("/conversations/group", { title, member_ids: memberIds });
      get().fetchConversations();
      get().setActiveConversation(conv.id);
    } catch (e) {
      console.error("Failed to create group", e);
    }
  },

  removeGroupMember: async (conversationId, userId) => {
    try {
      await api.delete(`/conversations/${conversationId}/members/${userId}`);
      get().fetchConversations();
    } catch (e) {
      console.error("Failed to remove member", e);
    }
  },

  addGroupMembers: async (conversationId, userIds) => {
    try {
      await api.post(`/conversations/${conversationId}/members`, { user_ids: userIds });
      get().fetchConversations();
    } catch (e) {
      console.error("Failed to add members", e);
    }
  }
}));
