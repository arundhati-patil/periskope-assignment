import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Search, Check, MessageCircle } from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday } from "date-fns";
import type { ChatWithParticipants, User } from "@shared/schema";

interface ChatListProps {
  chats: ChatWithParticipants[];
  activeChatId: number | null;
  onChatSelect: (chatId: number) => void;
  getChatName: (chat: ChatWithParticipants) => string;
  getOtherParticipant: (chat: ChatWithParticipants) => User | undefined;
}

export default function ChatList({ 
  chats, 
  activeChatId, 
  onChatSelect, 
  getChatName, 
  getOtherParticipant 
}: ChatListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = chats.filter(chat =>
    getChatName(chat).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatMessageTime = (timestamp: string | Date) => {
    const date = new Date(timestamp);
    if (isToday(date)) {
      return format(date, 'h:mm a');
    } else if (isYesterday(date)) {
      return 'Yesterday';
    } else {
      return format(date, 'MMM d');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <div className="w-80 bg-white border-r border-wa-border flex flex-col">
      {/* Chat List Header */}
      <div className="p-4 border-b border-wa-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-wa-dark">Chats</h1>
          <Button
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-wa-hover rounded-full transition-colors"
          >
            <UserPlus className="w-5 h-5 text-wa-medium" />
          </Button>
        </div>
        
        {/* Search Bar */}
        <div className="relative">
          <Input
            type="text"
            placeholder="Search or start new chat"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-wa-bg border-wa-border focus:border-wa-accent"
          />
          <Search className="w-4 h-4 text-wa-medium absolute left-3 top-1/2 transform -translate-y-1/2" />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="p-8 text-center text-wa-medium">
            <MessageCircle className="w-12 h-12 mx-auto mb-4 text-wa-border" />
            <p>No chats yet</p>
            <p className="text-sm">Start a conversation to see your chats here</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const otherUser = getOtherParticipant(chat);
            const chatName = getChatName(chat);
            const lastMessage = chat.messages[0];
            const isActive = chat.id === activeChatId;

            return (
              <div
                key={chat.id}
                className={`flex items-center p-3 cursor-pointer transition-colors hover:bg-wa-hover ${
                  isActive ? 'border-l-4 border-wa-accent bg-wa-hover/50' : ''
                }`}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="relative mr-3">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={otherUser?.profileImageUrl || ''} />
                    <AvatarFallback className="bg-wa-primary text-white">
                      {getInitials(chatName)}
                    </AvatarFallback>
                  </Avatar>
                  {/* Online indicator - simplified for now */}
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-wa-accent rounded-full border-2 border-white"></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-wa-dark truncate">
                      {chatName}
                    </h3>
                    {lastMessage && (
                      <span className={`text-xs ${isActive ? 'text-wa-accent font-medium' : 'text-wa-medium'}`}>
                        {formatMessageTime(lastMessage.createdAt!)}
                      </span>
                    )}
                  </div>
                  
                  {lastMessage && (
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-sm text-wa-medium truncate">
                        {lastMessage.content}
                      </p>
                      {/* Read receipt for sent messages */}
                      {lastMessage.senderId === otherUser?.id && (
                        <Check className="w-4 h-4 text-blue-500 flex-shrink-0 ml-2" />
                      )}
                    </div>
                  )}
                </div>
                
                {/* Unread count - simplified for now */}
                {isActive && (
                  <div className="ml-2">
                    <Badge className="bg-wa-accent text-white text-xs">
                      1
                    </Badge>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
