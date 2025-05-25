import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertMessageSchema, insertChatSchema } from "@shared/schema";
import { z } from "zod";

interface WebSocketWithUserId extends WebSocket {
  userId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Get user's chats
  app.get('/api/chats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const chats = await storage.getUserChats(userId);
      res.json(chats);
    } catch (error) {
      console.error("Error fetching chats:", error);
      res.status(500).json({ message: "Failed to fetch chats" });
    }
  });

  // Get chat messages
  app.get('/api/chats/:chatId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const userId = req.user.claims.sub;
      
      // Check if user is participant in this chat
      const chat = await storage.getChatById(chatId);
      if (!chat || !chat.participants.some(p => p.userId === userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const messages = await storage.getChatMessages(chatId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  // Send message
  app.post('/api/chats/:chatId/messages', isAuthenticated, async (req: any, res) => {
    try {
      const chatId = parseInt(req.params.chatId);
      const userId = req.user.claims.sub;
      
      // Validate request body
      const messageData = insertMessageSchema.parse({
        ...req.body,
        chatId,
        senderId: userId,
      });

      // Check if user is participant in this chat
      const chat = await storage.getChatById(chatId);
      if (!chat || !chat.participants.some(p => p.userId === userId)) {
        return res.status(403).json({ message: "Access denied" });
      }

      const message = await storage.createMessage(messageData);
      
      // Broadcast message to WebSocket clients
      broadcastToChat(chatId, {
        type: 'new_message',
        message,
      });

      res.json(message);
    } catch (error) {
      console.error("Error sending message:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid message data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  // Create or get direct chat
  app.post('/api/chats/direct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { otherUserId } = req.body;

      if (!otherUserId) {
        return res.status(400).json({ message: "otherUserId is required" });
      }

      const chat = await storage.getOrCreateDirectChat(userId, otherUserId);
      const chatWithDetails = await storage.getChatById(chat.id);
      
      res.json(chatWithDetails);
    } catch (error) {
      console.error("Error creating/getting direct chat:", error);
      res.status(500).json({ message: "Failed to create or get chat" });
    }
  });

  // Get all users (for starting new chats)
  app.get('/api/users', isAuthenticated, async (req: any, res) => {
    try {
      const currentUserId = req.user.claims.sub;
      // In a real app, you'd want to filter this more intelligently
      // For now, we'll return users that have existing chats with the current user
      const chats = await storage.getUserChats(currentUserId);
      const allUsers = new Set<any>();
      
      chats.forEach(chat => {
        chat.participants.forEach(p => {
          if (p.userId !== currentUserId) {
            allUsers.add(p.user);
          }
        });
      });

      res.json(Array.from(allUsers));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  const httpServer = createServer(app);

  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const chatRooms = new Map<number, Set<WebSocketWithUserId>>();

  function broadcastToChat(chatId: number, data: any) {
    const room = chatRooms.get(chatId);
    if (room) {
      const message = JSON.stringify(data);
      room.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
        }
      });
    }
  }

  wss.on('connection', (ws: WebSocketWithUserId, req) => {
    console.log('WebSocket connection established');

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        switch (message.type) {
          case 'join_chat':
            const { chatId, userId } = message;
            ws.userId = userId;
            
            if (!chatRooms.has(chatId)) {
              chatRooms.set(chatId, new Set());
            }
            chatRooms.get(chatId)!.add(ws);
            
            console.log(`User ${userId} joined chat ${chatId}`);
            break;

          case 'leave_chat':
            const { chatId: leaveChatId } = message;
            const room = chatRooms.get(leaveChatId);
            if (room) {
              room.delete(ws);
              if (room.size === 0) {
                chatRooms.delete(leaveChatId);
              }
            }
            break;

          case 'typing':
            const { chatId: typingChatId, isTyping } = message;
            broadcastToChat(typingChatId, {
              type: 'user_typing',
              userId: ws.userId,
              isTyping,
            });
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      // Remove from all chat rooms
      chatRooms.forEach((room, chatId) => {
        room.delete(ws);
        if (room.size === 0) {
          chatRooms.delete(chatId);
        }
      });
      console.log('WebSocket connection closed');
    });
  });

  return httpServer;
}
