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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showLabelMenu, setShowLabelMenu] = useState(false);
  const [showMemberMenu, setShowMemberMenu] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  
  // Recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

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
      const response = await fetch(`/api/chats/${data.chatId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: data.content,
          messageType: data.messageType || "text",
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
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

  // Filter chats based on search
  const filteredChats = chats.filter((chat: ChatWithParticipants) => {
    const chatName = getChatName(chat);
    const matchesSearch = chatName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

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

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      const chunks: BlobPart[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const audioUrl = URL.createObjectURL(blob);
        
        // Send voice message
        sendMessageMutation.mutate({
          content: `🎤 Voice message (${recordingDuration}s)`,
          chatId: selectedChatId!,
          messageType: 'audio'
        });
        
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);
      
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  // File upload handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && selectedChatId) {
      const file = e.target.files[0];
      let messageContent = '';
      let messageType = 'text';
      
      if (file.type.startsWith('image/')) {
        messageContent = `📷 Image: ${file.name}`;
        messageType = 'image';
      } else if (file.type.startsWith('video/')) {
        messageContent = `🎥 Video: ${file.name}`;
        messageType = 'video';
      } else {
        messageContent = `📄 Document: ${file.name}`;
        messageType = 'document';
      }

      sendMessageMutation.mutate({
        content: messageContent,
        chatId: selectedChatId,
        messageType
      });
      
      setShowAttachmentMenu(false);
    }
  };

  // Emoji data
  const emojis = [
    '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
    '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
    '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
    '👍', '👎', '👌', '🤞', '✌️', '🤟', '🤘', '👊', '✊', '🤛',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '🔥', '⭐', '🌟', '✨', '💥', '💯', '💢', '💨', '💫', '🎉'
  ];

  const addEmoji = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  // Label management functions
  const toggleLabel = (chatId: number, labelId: string) => {
    // In a real app, this would call an API to add/remove labels
    console.log(`Toggle label ${labelId} for chat ${chatId}`);
  };

  // Member management functions
  const addMemberToChat = (chatId: number, userId: string) => {
    // In a real app, this would call an API to add a member
    console.log(`Add user ${userId} to chat ${chatId}`);
    setShowMemberMenu(false);
  };

  const removeMemberFromChat = (chatId: number, userId: string) => {
    // In a real app, this would call an API to remove a member
    console.log(`Remove user ${userId} from chat ${chatId}`);
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
            
            {/* Advanced Filter Controls */}
            <div className="space-y-3">
              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search conversations..."
                  className="pl-9 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              
              {/* Label Filter */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedLabelFilter === '' ? "default" : "outline"}
                  onClick={() => setSelectedLabelFilter('')}
                  className="text-xs"
                >
                  All Chats
                </Button>
                {labels.map(label => (
                  <Button
                    key={label.id}
                    size="sm"
                    variant={selectedLabelFilter === label.id ? "default" : "outline"}
                    onClick={() => setSelectedLabelFilter(label.id)}
                    className={`text-xs ${selectedLabelFilter === label.id ? 'bg-blue-600 text-white' : ''}`}
                  >
                    <div className={`w-2 h-2 rounded-full ${label.color} mr-1`}></div>
                    {label.name}
                  </Button>
                ))}
              </div>
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
                      
                      {/* Chat Labels */}
                      <div className="flex items-center space-x-1 mt-1">
                        {/* Show sample labels for demonstration */}
                        {chat.id === 1 && (
                          <>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                              Work
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800">
                              Important
                            </span>
                          </>
                        )}
                        {chat.id === 6 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800">
                            Project
                          </span>
                        )}
                        {chat.isGroup && (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 text-green-800">
                            Group
                          </span>
                        )}
                      </div>
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
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-300">
                        {getOtherParticipant(selectedChat)?.profileImageUrl ? (
                          <img 
                            src={getOtherParticipant(selectedChat)?.profileImageUrl || ''} 
                            alt={getChatName(selectedChat)}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <User className="w-5 h-5 text-gray-600" />
                          </div>
                        )}
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
                  {/* Label Management */}
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowLabelMenu(!showLabelMenu)}
                      className="hover:bg-gray-100"
                    >
                      <Tag className="w-4 h-4" />
                    </Button>
                    
                    {showLabelMenu && (
                      <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg p-3 z-10 w-64">
                        <h4 className="font-medium mb-3">Manage Labels</h4>
                        <div className="space-y-2">
                          {labels.map(label => (
                            <div key={label.id} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className={`w-3 h-3 rounded-full ${label.color}`}></div>
                                <span className="text-sm">{label.name}</span>
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => toggleLabel(selectedChatId!, label.id)}
                                className="text-xs"
                              >
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Member Management */}
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowMemberMenu(!showMemberMenu)}
                      className="hover:bg-gray-100"
                    >
                      <Users className="w-4 h-4" />
                    </Button>
                    
                    {showMemberMenu && (
                      <div className="absolute top-full right-0 mt-2 bg-white border rounded-lg shadow-lg p-3 z-10 w-72">
                        <h4 className="font-medium mb-3">Chat Members</h4>
                        
                        {/* Current Members */}
                        <div className="space-y-2 mb-4">
                          {selectedChat.participants.map(participant => (
                            <div key={participant.userId} className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-300">
                                  {participant.user.profileImageUrl ? (
                                    <img 
                                      src={participant.user.profileImageUrl} 
                                      alt={participant.user.firstName || ''}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <User className="w-4 h-4 text-gray-600" />
                                    </div>
                                  )}
                                </div>
                                <span className="text-sm">
                                  {participant.user.firstName} {participant.user.lastName}
                                </span>
                              </div>
                              {participant.userId !== user?.id && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => removeMemberFromChat(selectedChatId!, participant.userId)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                >
                                  Remove
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Add Member Button */}
                        <Button
                          size="sm"
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => setShowAddMemberDialog(true)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Member
                        </Button>
                      </div>
                    )}
                  </div>
                  
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
                  {/* Attachment Menu */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
                      className="text-gray-500 hover:text-green-600"
                    >
                      <Paperclip className="w-5 h-5" />
                    </Button>
                    
                    {showAttachmentMenu && (
                      <div className="absolute bottom-full left-0 mb-2 bg-white border rounded-lg shadow-lg p-2 space-y-1 z-10">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start hover:bg-blue-50"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'image/*';
                            input.onchange = handleFileUpload;
                            input.click();
                          }}
                        >
                          <Image className="w-4 h-4 mr-2 text-blue-500" />
                          Photo
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start hover:bg-purple-50"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = 'video/*';
                            input.onchange = handleFileUpload;
                            input.click();
                          }}
                        >
                          <Video className="w-4 h-4 mr-2 text-purple-500" />
                          Video
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full justify-start hover:bg-orange-50"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.accept = '.pdf,.doc,.docx,.txt';
                            input.onchange = handleFileUpload;
                            input.click();
                          }}
                        >
                          <File className="w-4 h-4 mr-2 text-orange-500" />
                          Document
                        </Button>
                      </div>
                    )}
                  </div>
                  
                  {/* Message Input */}
                  <div className="flex-1 relative">
                    <Input
                      type="text"
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="rounded-full border-gray-300 pr-12"
                    />
                  </div>
                  
                  {/* Emoji Picker */}
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="text-gray-500 hover:text-yellow-500"
                    >
                      <Smile className="w-5 h-5" />
                    </Button>
                    
                    {showEmojiPicker && (
                      <div className="absolute bottom-full right-0 mb-2 bg-white border rounded-lg shadow-lg p-3 z-10 w-64">
                        <div className="grid grid-cols-8 gap-2 max-h-48 overflow-y-auto">
                          {emojis.map((emoji, index) => (
                            <button
                              key={index}
                              onClick={() => addEmoji(emoji)}
                              className="text-xl hover:bg-gray-100 rounded p-1 transition-colors"
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Voice Recording / Send Button */}
                  {isRecording ? (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-red-500 font-medium">
                        {recordingDuration}s
                      </span>
                      <Button
                        onClick={stopRecording}
                        className="bg-red-500 hover:bg-red-600 rounded-full animate-pulse"
                      >
                        <StopCircle className="w-5 h-5" />
                      </Button>
                    </div>
                  ) : newMessage.trim() ? (
                    <Button
                      onClick={handleSendMessage}
                      disabled={sendMessageMutation.isPending}
                      className="bg-green-600 hover:bg-green-700 rounded-full"
                    >
                      <Send className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      className="bg-green-600 hover:bg-green-700 rounded-full"
                    >
                      <MicIcon className="w-5 h-5" />
                    </Button>
                  )}
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
