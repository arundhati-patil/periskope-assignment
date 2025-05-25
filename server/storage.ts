import {
  users,
  chats,
  messages,
  chatParticipants,
  type User,
  type UpsertUser,
  type Chat,
  type Message,
  type ChatParticipant,
  type InsertChat,
  type InsertMessage,
  type InsertChatParticipant,
  type ChatWithParticipants,
  type MessageWithSender,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Chat operations
  getUserChats(userId: string): Promise<ChatWithParticipants[]>;
  createChat(chat: InsertChat, participantIds: string[]): Promise<Chat>;
  getChatById(chatId: number): Promise<ChatWithParticipants | undefined>;
  
  // Message operations
  getChatMessages(chatId: number): Promise<MessageWithSender[]>;
  createMessage(message: InsertMessage): Promise<MessageWithSender>;
  
  // Chat participant operations
  addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant>;
  getChatParticipants(chatId: number): Promise<(ChatParticipant & { user: User })[]>;
  
  // Get or create direct chat between two users
  getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getUserChats(userId: string): Promise<ChatWithParticipants[]> {
    const userChats = await db
      .select({
        chat: chats,
        participant: chatParticipants,
        user: users,
      })
      .from(chats)
      .innerJoin(chatParticipants, eq(chats.id, chatParticipants.chatId))
      .innerJoin(users, eq(chatParticipants.userId, users.id))
      .where(
        sql`${chats.id} IN (
          SELECT ${chatParticipants.chatId} 
          FROM ${chatParticipants} 
          WHERE ${chatParticipants.userId} = ${userId}
        )`
      )
      .orderBy(desc(chats.updatedAt));

    // Group by chat
    const chatMap = new Map<number, ChatWithParticipants>();
    
    for (const row of userChats) {
      if (!chatMap.has(row.chat.id)) {
        chatMap.set(row.chat.id, {
          ...row.chat,
          participants: [],
          messages: [],
        });
      }
      
      const chat = chatMap.get(row.chat.id)!;
      chat.participants.push({
        ...row.participant,
        user: row.user,
      });
    }

    // Get latest message for each chat
    const chatsWithMessages = Array.from(chatMap.values());
    for (const chat of chatsWithMessages) {
      const latestMessages = await db
        .select({
          message: messages,
          sender: users,
        })
        .from(messages)
        .innerJoin(users, eq(messages.senderId, users.id))
        .where(eq(messages.chatId, chat.id))
        .orderBy(desc(messages.createdAt))
        .limit(1);

      if (latestMessages.length > 0) {
        chat.messages = [latestMessages[0].message];
      }
    }

    return chatsWithMessages;
  }

  async createChat(chat: InsertChat, participantIds: string[]): Promise<Chat> {
    const [newChat] = await db.insert(chats).values(chat).returning();
    
    // Add participants
    for (const userId of participantIds) {
      await db.insert(chatParticipants).values({
        chatId: newChat.id,
        userId,
      });
    }
    
    return newChat;
  }

  async getChatById(chatId: number): Promise<ChatWithParticipants | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, chatId));
    
    if (!chat) return undefined;

    const participants = await this.getChatParticipants(chatId);
    const latestMessages = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.chatId, chatId))
      .orderBy(desc(messages.createdAt))
      .limit(10);

    return {
      ...chat,
      participants,
      messages: latestMessages.map(row => row.message),
    };
  }

  async getChatMessages(chatId: number): Promise<MessageWithSender[]> {
    const result = await db
      .select({
        message: messages,
        sender: users,
      })
      .from(messages)
      .innerJoin(users, eq(messages.senderId, users.id))
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);

    return result.map(row => ({
      ...row.message,
      sender: row.sender,
    }));
  }

  async createMessage(message: InsertMessage): Promise<MessageWithSender> {
    const [newMessage] = await db.insert(messages).values(message).returning();
    
    // Update chat updated_at
    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, newMessage.chatId));
    
    // Get sender info
    const [sender] = await db.select().from(users).where(eq(users.id, message.senderId));
    
    return {
      ...newMessage,
      sender,
    };
  }

  async addChatParticipant(participant: InsertChatParticipant): Promise<ChatParticipant> {
    const [newParticipant] = await db
      .insert(chatParticipants)
      .values(participant)
      .returning();
    return newParticipant;
  }

  async getChatParticipants(chatId: number): Promise<(ChatParticipant & { user: User })[]> {
    const result = await db
      .select({
        participant: chatParticipants,
        user: users,
      })
      .from(chatParticipants)
      .innerJoin(users, eq(chatParticipants.userId, users.id))
      .where(eq(chatParticipants.chatId, chatId));

    return result.map(row => ({
      ...row.participant,
      user: row.user,
    }));
  }

  async getOrCreateDirectChat(user1Id: string, user2Id: string): Promise<Chat> {
    // Check if direct chat already exists between these users
    const existingChat = await db
      .select({ chat: chats })
      .from(chats)
      .innerJoin(chatParticipants, eq(chats.id, chatParticipants.chatId))
      .where(
        and(
          eq(chats.isGroup, false),
          sql`${chats.id} IN (
            SELECT cp1.${chatParticipants.chatId}
            FROM ${chatParticipants} cp1
            INNER JOIN ${chatParticipants} cp2 ON cp1.${chatParticipants.chatId} = cp2.${chatParticipants.chatId}
            WHERE cp1.${chatParticipants.userId} = ${user1Id} 
            AND cp2.${chatParticipants.userId} = ${user2Id}
            AND cp1.${chatParticipants.userId} != cp2.${chatParticipants.userId}
          )`
        )
      )
      .limit(1);

    if (existingChat.length > 0) {
      return existingChat[0].chat;
    }

    // Create new direct chat
    return this.createChat({ isGroup: false }, [user1Id, user2Id]);
  }
}

export const storage = new DatabaseStorage();
