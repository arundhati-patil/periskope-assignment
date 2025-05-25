import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chats table
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }),
  isGroup: boolean("is_group").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Chat participants table
export const chatParticipants = pgTable("chat_participants", {
  id: serial("id").primaryKey(),
  chatId: serial("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  joinedAt: timestamp("joined_at").defaultNow(),
});

// Messages table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: serial("chat_id").references(() => chats.id, { onDelete: "cascade" }).notNull(),
  senderId: varchar("sender_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  chatParticipants: many(chatParticipants),
  sentMessages: many(messages),
}));

export const chatsRelations = relations(chats, ({ many }) => ({
  participants: many(chatParticipants),
  messages: many(messages),
}));

export const chatParticipantsRelations = relations(chatParticipants, ({ one }) => ({
  chat: one(chats, {
    fields: [chatParticipants.chatId],
    references: [chats.id],
  }),
  user: one(users, {
    fields: [chatParticipants.userId],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertChatSchema = createInsertSchema(chats).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatParticipantSchema = createInsertSchema(chatParticipants).omit({
  id: true,
  joinedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type ChatParticipant = typeof chatParticipants.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type InsertChatParticipant = z.infer<typeof insertChatParticipantSchema>;

// Extended types with relations
export type ChatWithParticipants = Chat & {
  participants: (ChatParticipant & { user: User })[];
  messages: Message[];
};

export type MessageWithSender = Message & {
  sender: User;
};
