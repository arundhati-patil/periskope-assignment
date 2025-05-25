import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import ChatSidebar from "@/components/ChatSidebar";
import ChatList from "@/components/ChatList";
import ChatArea from "@/components/ChatArea";
import type { ChatWithParticipants, MessageWithSender } from "@shared/schema";

export default function Chat() {
  const { user } = useAuth();
  const { lastMessage, joinChat, leaveChat } = useWebSocket();
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  // Fetch user's chats
  const { data: chats = [], isLoading } = useQuery<ChatWithParticipants[]>({
    queryKey: ['/api/chats'],
    enabled: !!user,
  });

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'new_message':
        const newMessage: MessageWithSender = lastMessage.message;
        
        // Update messages in cache
        queryClient.setQueryData(
          [`/api/chats/${newMessage.chatId}/messages`],
          (oldMessages: MessageWithSender[] = []) => [...oldMessages, newMessage]
        );

        // Update chat list to show latest message
        queryClient.setQueryData(
          ['/api/chats'],
          (oldChats: ChatWithParticipants[] = []) =>
            oldChats.map(chat =>
              chat.id === newMessage.chatId
                ? { ...chat, messages: [newMessage], updatedAt: newMessage.createdAt }
                : chat
            )
        );
        break;

      case 'user_typing':
        // Handle typing indicators
        console.log(`User ${lastMessage.userId} is ${lastMessage.isTyping ? 'typing' : 'not typing'}`);
        break;
    }
  }, [lastMessage, queryClient]);

  // Join/leave chat when active chat changes
  useEffect(() => {
    return () => {
      if (activeChatId) {
        leaveChat(activeChatId);
      }
    };
  }, [activeChatId, leaveChat]);

  const handleChatSelect = (chatId: number) => {
    if (activeChatId) {
      leaveChat(activeChatId);
    }
    setActiveChatId(chatId);
    joinChat(chatId);
  };

  const getOtherParticipant = (chat: ChatWithParticipants) => {
    return chat.participants.find(p => p.userId !== user?.id)?.user;
  };

  const getChatName = (chat: ChatWithParticipants) => {
    if (chat.isGroup) {
      return chat.name || 'Group Chat';
    }
    const otherUser = getOtherParticipant(chat);
    return otherUser ? `${otherUser.firstName || ''} ${otherUser.lastName || ''}`.trim() || otherUser.email || 'Unknown User' : 'Chat';
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-wa-medium">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-wa-bg">
      <ChatSidebar user={user} />
      <ChatList 
        chats={chats}
        activeChatId={activeChatId}
        onChatSelect={handleChatSelect}
        getChatName={getChatName}
        getOtherParticipant={getOtherParticipant}
      />
      <ChatArea 
        activeChatId={activeChatId}
        activeChat={chats.find(c => c.id === activeChatId)}
        getChatName={getChatName}
        getOtherParticipant={getOtherParticipant}
      />
    </div>
  );
}
