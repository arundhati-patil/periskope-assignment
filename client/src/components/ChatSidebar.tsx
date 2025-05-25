import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MessageCircle, Users, Phone, Settings } from "lucide-react";
import type { User } from "@shared/schema";

interface ChatSidebarProps {
  user: User | null;
}

export default function ChatSidebar({ user }: ChatSidebarProps) {
  const handleLogout = () => {
    window.location.href = '/api/logout';
  };

  return (
    <div className="w-16 bg-wa-primary flex flex-col items-center py-4 space-y-4">
      {/* User Avatar */}
      <Avatar className="w-10 h-10 border-2 border-white/20">
        <AvatarImage src={user?.profileImageUrl || ''} />
        <AvatarFallback className="bg-white/10 text-white text-sm">
          {user?.firstName?.[0] || user?.email?.[0] || 'U'}
        </AvatarFallback>
      </Avatar>
      
      {/* Navigation Icons */}
      <div className="flex flex-col space-y-4 text-white/70">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
        >
          <MessageCircle className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
        >
          <Users className="w-5 h-5" />
        </Button>
        
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
        >
          <Phone className="w-5 h-5" />
        </Button>
      </div>
      
      {/* Settings at bottom */}
      <div className="mt-auto">
        <Button
          variant="ghost"
          size="icon"
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-white/70 hover:text-white"
          onClick={handleLogout}
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
