const { Pool } = require('pg');

async function createSampleChats() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    // Get current user ID (from the logs I can see it's "43093782")
    const currentUserId = "43093782";
    
    // Create direct chats with sample users
    const sampleUsers = ['sample-user-1', 'sample-user-2', 'sample-user-3', 'sample-user-4'];
    
    for (let i = 0; i < sampleUsers.length; i++) {
      const otherUserId = sampleUsers[i];
      
      // Create chat
      const chatResult = await pool.query(
        'INSERT INTO chats (name, is_group, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
        [null, false]
      );
      const chatId = chatResult.rows[0].id;
      
      // Add participants
      await pool.query(
        'INSERT INTO chat_participants (chat_id, user_id, joined_at) VALUES ($1, $2, NOW()), ($3, $4, NOW())',
        [chatId, currentUserId, chatId, otherUserId]
      );
      
      // Add sample messages
      const messages = [
        [`Hey! How are you doing?`, currentUserId],
        [`I'm good, thanks! How about you?`, otherUserId],
        [`Doing well! Working on this amazing chat app`, currentUserId],
        [`That's awesome! The real-time messaging is so smooth`, otherUserId],
        [`Thanks! The WhatsApp-like design turned out great`, currentUserId]
      ];
      
      for (let j = 0; j < messages.length; j++) {
        const [content, senderId] = messages[j];
        await pool.query(
          'INSERT INTO messages (chat_id, sender_id, content, message_type, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW() - INTERVAL \'' + (messages.length - j) + ' minutes\', NOW())',
          [chatId, senderId, content, 'text']
        );
      }
      
      // Update chat timestamp
      await pool.query(
        'UPDATE chats SET updated_at = NOW() - INTERVAL \'' + (sampleUsers.length - i) + ' minutes\' WHERE id = $1',
        [chatId]
      );
    }
    
    // Create a group chat
    const groupChatResult = await pool.query(
      'INSERT INTO chats (name, is_group, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id',
      ['Team Chat', true]
    );
    const groupChatId = groupChatResult.rows[0].id;
    
    // Add all users to group
    const allUsers = [currentUserId, ...sampleUsers.slice(0, 3)];
    for (const userId of allUsers) {
      await pool.query(
        'INSERT INTO chat_participants (chat_id, user_id, joined_at) VALUES ($1, $2, NOW())',
        [groupChatId, userId]
      );
    }
    
    // Add group messages
    const groupMessages = [
      [`Welcome to our team chat!`, currentUserId],
      [`Thanks for adding me!`, 'sample-user-1'],
      [`Great to be here 👋`, 'sample-user-2'],
      [`Let's collaborate on this project`, 'sample-user-3'],
      [`This group chat feature is perfect for team communication`, currentUserId]
    ];
    
    for (let j = 0; j < groupMessages.length; j++) {
      const [content, senderId] = groupMessages[j];
      await pool.query(
        'INSERT INTO messages (chat_id, sender_id, content, message_type, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW() - INTERVAL \'' + (groupMessages.length - j) + ' minutes\', NOW())',
        [groupChatId, senderId, content, 'text']
      );
    }
    
    console.log('Sample chats and messages created successfully!');
    
  } catch (error) {
    console.error('Error creating sample chats:', error);
  } finally {
    await pool.end();
  }
}

createSampleChats();
