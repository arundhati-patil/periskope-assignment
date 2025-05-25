import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import NewChatDialog from "@/components/NewChatDialog";
import { 
  Menu, Home, MessageSquare, Edit, BarChart2, List, Megaphone, 
  Users, Calendar, Mail, Settings, Paperclip, Mic, Smile, Search,
  ChevronDown, Check, X, Image, Video, File, HelpCircle, User, Tag,
  Plus, MoreVertical, Filter, Send, MicIcon, StopCircle, Play, Pause
} from 'lucide-react';
import type { 
  ChatWithParticipants, 
  MessageWithSender, 
  User as UserType
} from "@shared/schema";

type Label = {
  id: string;
  name: string;
  color: string;
};

export default function Chat() {
  const { user } = useAuth();
  const { lastMessage, joinChat, leaveChat } = useWebSocket();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State management
  const [selectedChatId, setSelectedChatId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('');
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);

  // Labels for organizing chats
  const [labels] = useState<Label[]>([
    { id: '1', name: 'Work', color: 'bg-blue-500' },
    { id: '2', name: 'Personal', color: 'bg-green-500' },
    { id: '3', name: 'Important', color: 'bg-red-500' },
    { id: '4', name: 'Project', color: 'bg-yellow-500' }
  ]);

  // Fetch user's chats
  const { data: chats = [], isLoading: chatsLoading } = useQuery<ChatWithParticipants[]>({
    queryKey: ['/api/chats'],
    enabled: !!user,
  });

  // Fetch messages for selected chat
  const { data: messages = [], isLoading: messagesLoading } = useQuery<MessageWithSender[]>({
    queryKey: [`/api/chats/${selectedChatId}/messages`],
    enabled: !!selectedChatId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { content: string; chatId: number; messageType?: string }) => {
      return await apiRequest(`/api/chats/${data.chatId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: data.content,
          messageType: data.messageType || "text",
        }),
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/chats/${selectedChatId}/messages`] });
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
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
        console.log(`User ${lastMessage.userId} is ${lastMessage.isTyping ? 'typing' : 'not typing'}`);
        break;
    }
  }, [lastMessage, queryClient]);

  // Handle chat selection
  const handleChatSelect = (chatId: number) => {
    if (selectedChatId) {
      leaveChat(selectedChatId);
    }
    setSelectedChatId(chatId);
    joinChat(chatId);
  };

  // Filter chats based on search
  const filteredChats = chats.filter((chat: ChatWithParticipants) => {
    const chatName = getChatName(chat);
    const matchesSearch = chatName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Helper functions
  const getChatName = (chat: ChatWithParticipants) => {
    if (chat.isGroup) {
      return chat.name || "Group Chat";
    }
    const otherParticipant = chat.participants.find(p => p.userId !== user?.id)?.user;
    return otherParticipant ? `${otherParticipant.firstName || ''} ${otherParticipant.lastName || ''}`.trim() || otherParticipant.email || 'Unknown User' : 'Chat';
  };

  const getOtherParticipant = (chat: ChatWithParticipants) => {
    return chat.participants.find(p => p.userId !== user?.id)?.user;
  };

  const handleSendMessage = () => {
    if (!selectedChatId || !newMessage.trim()) return;
    
    sendMessageMutation.mutate({
      content: newMessage.trim(),
      chatId: selectedChatId,
    });
    
    setNewMessage('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatTime = (dateString: string | Date | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  };

  const selectedChat = chats.find((chat: ChatWithParticipants) => chat.id === selectedChatId);

  if (chatsLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-lg">Loading chats...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <header className="bg-green-600 text-white p-4 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Button variant="ghost" className="text-white hover:bg-green-700">
            <Menu />
          </Button>
          <h1 className="text-xl font-bold">Chat App</h1>
        </div>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input
              type="text"
              placeholder="Search chats..."
              className="pl-10 pr-4 py-2 rounded-full bg-green-500 text-white placeholder-green-200 border-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="ghost" className="text-white hover:bg-green-700">
            <HelpCircle />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <aside className="w-16 bg-gray-100 flex flex-col items-center py-4 space-y-6">
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Home className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <MessageSquare className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Edit className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <BarChart2 className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <List className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Megaphone className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Users className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Calendar className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Mail className="w-5 h-5" />
          </Button>
          <Button variant="ghost" className="text-gray-700 hover:bg-gray-200 p-2">
            <Settings className="w-5 h-5" />
          </Button>
        </aside>

        {/* Chat List */}
        <div className="w-80 bg-gray-50 border-r flex flex-col">
          <div className="p-4 border-b bg-white">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Chats</h2>
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700"
                onClick={() => setShowNewChatDialog(true)}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            
            {/* Label Filter */}
            <div className="flex flex-wrap gap-2 mb-3">
              <Button
                size="sm"
                variant={selectedLabelFilter === '' ? "default" : "outline"}
                onClick={() => setSelectedLabelFilter('')}
                className="text-xs"
              >
                All
              </Button>
              {labels.map(label => (
                <Button
                  key={label.id}
                  size="sm"
                  variant={selectedLabelFilter === label.id ? "default" : "outline"}
                  onClick={() => setSelectedLabelFilter(label.id)}
                  className={`text-xs ${selectedLabelFilter === label.id ? label.color + ' text-white' : ''}`}
                >
                  {label.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Chat List */}
          <div className="flex-1 overflow-y-auto">
            {filteredChats.map((chat: ChatWithParticipants) => {
              const chatName = getChatName(chat);
              const lastMessage = chat.messages?.[chat.messages.length - 1];
              
              return (
                <div
                  key={chat.id}
                  className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                    selectedChatId === chat.id ? 'bg-green-50 border-l-4 border-green-600' : ''
                  }`}
                  onClick={() => handleChatSelect(chat.id)}
                >
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      {chat.isGroup ? (
                        <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-white" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-300">
                          {getOtherParticipant(chat)?.profileImageUrl ? (
                            <img 
                              src={getOtherParticipant(chat)?.profileImageUrl} 
                              alt={chatName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <User className="w-6 h-6 text-gray-600" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 truncate">{chatName}</h3>
                        <span className="text-xs text-gray-500">
                          {lastMessage ? formatTime(lastMessage.createdAt) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 truncate">
                        {lastMessage ? lastMessage.content : 'No messages yet'}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {selectedChat ? (
            <>
              {/* Chat Header */}
              <div className="bg-white border-b p-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    {selectedChat.isGroup ? (
                      <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                        <Users className="w-5 h-5 text-white" />
                      </div>
                    ) : (
                      <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-gray-600" />
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-medium">{getChatName(selectedChat)}</h3>
                    <p className="text-sm text-gray-500">
                      {selectedChat.isGroup 
                        ? `${selectedChat.participants.length} members`
                        : 'Online'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Tag className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <Users className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                {messagesLoading ? (
                  <div className="text-center">Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div className="text-center text-gray-500">No messages yet. Start the conversation!</div>
                ) : (
                  messages.map((message: MessageWithSender) => {
                    const isOwn = message.sender.id === user?.id;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                            isOwn
                              ? 'bg-green-600 text-white'
                              : 'bg-white text-gray-800 border'
                          }`}
                        >
                          {!isOwn && selectedChat.isGroup && (
                            <p className="text-xs font-medium mb-1 text-green-600">
                              {message.sender.firstName || message.sender.email}
                            </p>
                          )}
                          <p className="text-sm">{message.content}</p>
                          <p className={`text-xs mt-1 ${isOwn ? 'text-green-100' : 'text-gray-500'}`}>
                            {formatTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <div className="bg-white border-t p-4">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    
                    {showAttachmentMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-2 space-y-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Image className="w-4 h-4 mr-2" />
                          Image
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Video
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <File className="w-4 h-4 mr-2" />
                          Document
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  <Input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/*,video/*,.pdf,.doc,.docx"
                  />
                  
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="rounded-full border-gray-300"
                    />
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    <Smile className="w-5 h-5" />
                  </Button>
                  
                  <Button
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim() || sendMessageMutation.isPending}
                    className="bg-green-600 hover:bg-green-700 rounded-full"
                  >
                    <Mic className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <MessageSquare className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Welcome to Chat App</h3>
                <p className="text-gray-500">Select a chat to start messaging</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* New Chat Dialog */}
      {showNewChatDialog && (
        <NewChatDialog 
          onChatCreated={(chatId) => {
            setShowNewChatDialog(false);
            handleChatSelect(chatId);
          }}
        />
      )}
    </div>
  );
}
