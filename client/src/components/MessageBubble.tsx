import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import type { MessageWithSender } from "@shared/schema";

interface MessageBubbleProps {
  message: MessageWithSender;
  isOwn: boolean;
  senderAvatar?: string | null;
  senderName: string;
}

export default function MessageBubble({ 
  message, 
  isOwn, 
  senderAvatar, 
  senderName 
}: MessageBubbleProps) {
  const formatTime = (timestamp: string | Date) => {
    return format(new Date(timestamp), 'h:mm a');
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (isOwn) {
    return (
      <div className="flex items-end justify-end space-x-2">
        <div className="bg-wa-light-green rounded-lg p-3 max-w-xs lg:max-w-md shadow-sm">
          <p className="text-wa-dark">{message.content}</p>
          <div className="flex items-center justify-end mt-1 space-x-1">
            <span className="text-xs text-wa-medium">
              {formatTime(message.createdAt!)}
            </span>
            <CheckCheck className="w-4 h-4 text-blue-500" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start space-x-2">
      <Avatar className="w-8 h-8 flex-shrink-0">
        <AvatarImage src={senderAvatar || ''} />
        <AvatarFallback className="bg-wa-primary text-white text-xs">
          {getInitials(senderName)}
        </AvatarFallback>
      </Avatar>
      <div className="bg-white rounded-lg p-3 max-w-xs lg:max-w-md shadow-sm">
        <p className="text-wa-dark">{message.content}</p>
        <span className="text-xs text-wa-medium mt-1 block">
          {formatTime(message.createdAt!)}
        </span>
      </div>
    </div>
  );
}
