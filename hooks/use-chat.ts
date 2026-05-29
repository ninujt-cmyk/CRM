import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export interface ChatMessage {
  id: string;
  content: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  created_at: string;
}

export interface User {
  id: string;
  full_name: string;
  avatar_url?: string;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const supabase = createClient();

  // Fetch current user and users list
  const fetchUserData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Please sign in to access chat");
      }

      // Fetch current user details
      const { data: currentUserData, error: currentUserError } = await supabase
        .from("users")
        .select("id, full_name")
        .eq("id", user.id)
        .single();

      if (currentUserError) {
        throw new Error("Error loading user data");
      }

      setCurrentUser({
        id: currentUserData.id,
        full_name: currentUserData.full_name,
        avatar_url: undefined
      });

      // Fetch all users
      const { data: usersData, error: usersError } = await supabase
        .from("users")
        .select("id, full_name");

      if (usersError) {
        throw new Error("Error loading users");
      }

      const formattedUsers = usersData.map((user: any) => ({
        id: user.id,
        full_name: user.full_name,
        avatar_url: undefined
      }));

      setUsers(formattedUsers);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, content, sender_id, created_at, users(full_name)")
        .order("created_at", { ascending: true })
        .limit(50);

      if (error) {
        throw new Error("Error loading messages");
      }

      const formattedMessages = data.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        sender_id: msg.sender_id,
        sender_name: msg.users?.full_name || "Unknown User",
        sender_avatar: undefined,
        created_at: msg.created_at
      }));

      setMessages(formattedMessages);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      toast.error(errorMessage);
    }
  }, [currentUser, supabase]);

  // Subscribe to new messages
  useEffect(() => {
    if (!currentUser) return;

    // Initial fetch
    fetchMessages();

    // Subscribe to new messages
    const channel = supabase
      .channel("chat_messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
        },
        (payload: any) => {
          const newMessage = payload.new;
          
          // Fetch sender details
          const sender = users.find(u => u.id === newMessage.sender_id) || {
            id: newMessage.sender_id,
            full_name: "Unknown User",
            avatar_url: undefined
          };

          setMessages(prev => [
            ...prev,
            {
              id: newMessage.id,
              content: newMessage.content,
              sender_id: newMessage.sender_id,
              sender_name: sender.full_name,
              sender_avatar: sender.avatar_url,
              created_at: newMessage.created_at
            }
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, users, fetchMessages, supabase]);

  // Initial data fetch
  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || !currentUser) return false;

    try {
      const { error } = await supabase
        .from("chat_messages")
        .insert({
          content: content.trim(),
          sender_id: currentUser.id
        });

      if (error) {
        throw new Error("Failed to send message");
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An error occurred while sending message";
      toast.error(errorMessage);
      return false;
    }
  };

  return {
    messages,
    users,
    currentUser,
    loading,
    error,
    sendMessage,
    refresh: fetchUserData
  };
}