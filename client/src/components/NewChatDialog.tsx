import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { UserPlus, Users, MessageCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";

interface NewChatDialogProps {
  onChatCreated: (chatId: number) => void;
}

export default function NewChatDialog({ onChatCreated }: NewChatDialogProps) {
  const [open, setOpen] = useState(false);
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Fetch available users
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    enabled: open,
  });

  // Create sample users mutation
  const createSampleUsersMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/create-sample-users', {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  // Create direct chat mutation
  const createDirectChatMutation = useMutation({
    mutationFn: async (otherUserId: string) => {
      const response = await apiRequest('POST', '/api/chats/direct', { otherUserId });
      return response.json();
    },
    onSuccess: (chat) => {
      setOpen(false);
      onChatCreated(chat.id);
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });

  // Create group chat mutation
  const createGroupChatMutation = useMutation({
    mutationFn: async ({ name, participantIds }: { name: string; participantIds: string[] }) => {
      const response = await apiRequest('POST', '/api/chats/group', { name, participantIds });
      return response.json();
    },
    onSuccess: (chat) => {
      setOpen(false);
      setGroupName("");
      setSelectedUsers([]);
      setIsGroupChat(false);
      onChatCreated(chat.id);
      queryClient.invalidateQueries({ queryKey: ['/api/chats'] });
    },
  });

  const handleUserSelect = (userId: string) => {
    if (isGroupChat) {
      setSelectedUsers(prev => 
        prev.includes(userId) 
          ? prev.filter(id => id !== userId)
          : [...prev, userId]
      );
    } else {
      createDirectChatMutation.mutate(userId);
    }
  };

  const handleCreateGroup = () => {
    if (groupName.trim() && selectedUsers.length > 0) {
      createGroupChatMutation.mutate({
        name: groupName.trim(),
        participantIds: selectedUsers,
      });
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-wa-hover rounded-full transition-colors"
        >
          <UserPlus className="w-5 h-5 text-wa-medium" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Start New Chat</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Chat Type Toggle */}
          <div className="flex space-x-2">
            <Button
              variant={!isGroupChat ? "default" : "outline"}
              size="sm"
              onClick={() => setIsGroupChat(false)}
              className="flex items-center space-x-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Direct Chat</span>
            </Button>
            <Button
              variant={isGroupChat ? "default" : "outline"}
              size="sm"
              onClick={() => setIsGroupChat(true)}
              className="flex items-center space-x-2"
            >
              <Users className="w-4 h-4" />
              <span>Group Chat</span>
            </Button>
          </div>

          {/* Group Name Input */}
          {isGroupChat && (
            <Input
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="border-wa-border focus:border-wa-accent"
            />
          )}

          {/* Users List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {users.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-wa-medium mb-4">No users available</p>
                <Button
                  onClick={() => createSampleUsersMutation.mutate()}
                  disabled={createSampleUsersMutation.isPending}
                  className="bg-wa-accent hover:bg-wa-secondary"
                >
                  {createSampleUsersMutation.isPending ? 'Creating...' : 'Create Sample Users'}
                </Button>
              </div>
            ) : (
              users.map((user) => {
                const userName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
                const isSelected = selectedUsers.includes(user.id);
                
                return (
                  <div
                    key={user.id}
                    className={`flex items-center p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected ? 'bg-wa-accent/10 border border-wa-accent' : 'hover:bg-wa-hover'
                    }`}
                    onClick={() => handleUserSelect(user.id)}
                  >
                    <Avatar className="w-10 h-10 mr-3">
                      <AvatarImage src={user.profileImageUrl || ''} />
                      <AvatarFallback className="bg-wa-primary text-white">
                        {getInitials(userName)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <h3 className="font-medium text-wa-dark">{userName}</h3>
                      <p className="text-sm text-wa-medium">{user.email}</p>
                    </div>
                    
                    {isGroupChat && (
                      <Checkbox
                        checked={isSelected}
                        onChange={() => handleUserSelect(user.id)}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Create Group Button */}
          {isGroupChat && selectedUsers.length > 0 && (
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || createGroupChatMutation.isPending}
              className="w-full bg-wa-accent hover:bg-wa-secondary"
            >
              {createGroupChatMutation.isPending ? 'Creating...' : `Create Group (${selectedUsers.length} members)`}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}