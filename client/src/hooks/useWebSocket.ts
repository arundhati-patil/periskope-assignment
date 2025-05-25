import { useEffect, useRef, useState } from "react";
import { useAuth } from "./useAuth";

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

export function useWebSocket() {
  const { user, isAuthenticated } = useAuth();
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        setLastMessage(message);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [isAuthenticated, user]);

  const sendMessage = (message: WebSocketMessage) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const joinChat = (chatId: number) => {
    if (user) {
      sendMessage({
        type: 'join_chat',
        chatId,
        userId: user.id,
      });
    }
  };

  const leaveChat = (chatId: number) => {
    sendMessage({
      type: 'leave_chat',
      chatId,
    });
  };

  const sendTyping = (chatId: number, isTyping: boolean) => {
    sendMessage({
      type: 'typing',
      chatId,
      isTyping,
    });
  };

  return {
    isConnected,
    lastMessage,
    sendMessage,
    joinChat,
    leaveChat,
    sendTyping,
  };
}
