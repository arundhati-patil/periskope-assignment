import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Video, 
  Phone, 
  MoreVertical, 
  Paperclip, 
  Smile, 
  Send,
  MessageCircle,
  Image,
  FileText,
  Camera,
  Mic
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import MessageBubble from "./MessageBubble";
import { apiRequest } from "@/lib/queryClient";
import type { ChatWithParticipants, MessageWithSender, User } from "@shared/schema";

interface ChatAreaProps {
  activeChatId: number | null;
  activeChat: ChatWithParticipants | undefined;
  getChatName: (chat: ChatWithParticipants) => string;
  getOtherParticipant: (chat: ChatWithParticipants) => User | undefined;
}

export default function ChatArea({ 
  activeChatId, 
  activeChat, 
  getChatName, 
  getOtherParticipant 
}: ChatAreaProps) {
  const { user } = useAuth();
  const { sendTyping } = useWebSocket();
  const [messageText, setMessageText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showAttachments, setShowAttachments] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  // Fetch messages for active chat
  const { data: messages = [] } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/chats/${activeChatId}/messages`],
    enabled: !!activeChatId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest('POST', `/api/chats/${activeChatId}/messages`, {
        content,
        messageType: 'text',
      });
      return response.json();
    },
    onSuccess: () => {
      setMessageText("");
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${activeChatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
    onError: (error) => {
      console.error('Failed to send message:', error);
    },
  });

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle typing indicators
  const handleTyping = (typing: boolean) => {
    if (activeChatId && user) {
      sendTyping(activeChatId, typing);
      setIsTyping(typing);
      
      if (typing) {
        // Clear previous timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set new timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          sendTyping(activeChatId, false);
          setIsTyping(false);
        }, 3000);
      }
    }
  };

  const handleMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = messageText.trim();
    if (content && activeChatId) {
      sendMessageMutation.mutate(content);
      handleTyping(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageText(e.target.value);
    if (e.target.value && !isTyping) {
      handleTyping(true);
    } else if (!e.target.value && isTyping) {
      handleTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleMessageSubmit(e);
    }
  };

  if (!activeChatId || !activeChat) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-wa-chat-bg text-wa-medium">
        <MessageCircle className="w-16 h-16 mb-4 text-wa-border" />
        <h2 className="text-xl font-medium mb-2">Welcome to Chat</h2>
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  const otherUser = getOtherParticipant(activeChat);
  const chatName = getChatName(activeChat);

  return (
    <div className="flex-1 flex flex-col bg-wa-chat-bg">
      {/* Chat Header */}
      <div className="bg-wa-bg border-b border-wa-border p-4 flex items-center justify-between">
        <div className="flex items-center">
          <Avatar className="w-10 h-10 mr-3">
            <AvatarImage src={otherUser?.profileImageUrl || ''} />
            <AvatarFallback className="bg-wa-primary text-white">
              {chatName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-medium text-wa-dark">{chatName}</h2>
            <p className="text-sm text-wa-medium">online</p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-wa-hover rounded-full transition-colors"
          >
            <Video className="w-5 h-5 text-wa-medium" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-wa-hover rounded-full transition-colors"
          >
            <Phone className="w-5 h-5 text-wa-medium" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-wa-hover rounded-full transition-colors"
          >
            <MoreVertical className="w-5 h-5 text-wa-medium" />
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-wa-medium py-8">
            <p>No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === user?.id}
              senderAvatar={message.sender.profileImageUrl}
              senderName={`${message.sender.firstName || ''} ${message.sender.lastName || ''}`.trim() || message.sender.email || 'Unknown'}
            />
          ))
        )}
        
        {/* Typing Indicator */}
        {isTyping && (
          <div className="flex items-start space-x-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={otherUser?.profileImageUrl || ''} />
              <AvatarFallback className="bg-wa-primary text-white text-xs">
                {chatName.split(' ').map(n => n[0]).join('').slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-wa-medium rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-wa-medium rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-wa-medium rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="bg-wa-bg border-t border-wa-border p-4">
        {/* Attachment Options */}
        {showAttachments && (
          <div className="mb-4 p-4 bg-white rounded-lg shadow-lg border border-wa-border">
            <div className="grid grid-cols-4 gap-4">
              <Button
                variant="ghost"
                className="flex flex-col items-center p-4 hover:bg-wa-hover rounded-lg transition-colors"
                onClick={() => setShowAttachments(false)}
              >
                <div className="w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center mb-2">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-wa-medium">Document</span>
              </Button>
              
              <Button
                variant="ghost"
                className="flex flex-col items-center p-4 hover:bg-wa-hover rounded-lg transition-colors"
                onClick={() => setShowAttachments(false)}
              >
                <div className="w-12 h-12 bg-pink-500 rounded-full flex items-center justify-center mb-2">
                  <Image className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-wa-medium">Photos</span>
              </Button>
              
              <Button
                variant="ghost"
                className="flex flex-col items-center p-4 hover:bg-wa-hover rounded-lg transition-colors"
                onClick={() => setShowAttachments(false)}
              >
                <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center mb-2">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-wa-medium">Camera</span>
              </Button>
              
              <Button
                variant="ghost"
                className="flex flex-col items-center p-4 hover:bg-wa-hover rounded-lg transition-colors"
                onClick={() => setShowAttachments(false)}
              >
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center mb-2">
                  <Mic className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-wa-medium">Audio</span>
              </Button>
            </div>
          </div>
        )}
        
        <form onSubmit={handleMessageSubmit} className="flex items-center space-x-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="p-2 hover:bg-wa-hover rounded-full transition-colors"
            onClick={() => setShowAttachments(!showAttachments)}
          >
            <Paperclip className="w-5 h-5 text-wa-medium" />
          </Button>
          
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Type a message..."
              value={messageText}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              className="pr-12 py-3 bg-white rounded-full border-wa-border focus:border-wa-accent"
              disabled={sendMessageMutation.isPending}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-wa-hover rounded-full transition-colors"
            >
              <Smile className="w-5 h-5 text-wa-medium" />
            </Button>
          </div>
          
          <Button
            type="submit"
            size="icon"
            className="p-3 bg-wa-accent hover:bg-wa-secondary rounded-full transition-colors"
            disabled={!messageText.trim() || sendMessageMutation.isPending}
          >
            <Send className="w-5 h-5 text-white" />
          </Button>
        </form>
      </div>
    </div>
  );
}
