#!/usr/bin/env node
/**
 * Create Admin Dashboard Indexes
 * 
 * This script creates the necessary MongoDB indexes for optimal
 * admin dashboard and traces page performance.
 * 
 * Usage:
 *   node config/create-admin-indexes.js
 * 
 * Or with custom MongoDB URI:
 *   MONGO_URI="mongodb://..." node config/create-admin-indexes.js
 */

const path = require('path');
const { MongoClient } = require('mongodb');

// Load environment variables
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/LibreChat';

// Indexes to create for Messages collection
const MESSAGE_INDEXES = [
  {
    key: { isCreatedByUser: 1, createdAt: -1 },
    name: 'admin_traces_sort',
    background: true,
  },
  {
    key: { isCreatedByUser: 1, error: 1, createdAt: -1 },
    name: 'admin_traces_error_filter',
    background: true,
  },
  {
    key: { isCreatedByUser: 1, model: 1, createdAt: -1 },
    name: 'admin_traces_model_filter',
    background: true,
  },
  {
    key: { parentMessageId: 1 },
    name: 'admin_traces_parent_lookup',
    background: true,
  },
  {
    key: { user: 1, createdAt: -1 },
    name: 'admin_user_messages',
    background: true,
  },
];

// Indexes to create for Transactions collection
const TRANSACTION_INDEXES = [
  {
    key: { createdAt: 1 },
    name: 'admin_date_range',
    background: true,
  },
  {
    key: { tokenType: 1, createdAt: 1 },
    name: 'admin_token_aggregation',
    background: true,
  },
  {
    key: { conversationId: 1, createdAt: 1 },
    name: 'admin_conversation_costs',
    background: true,
  },
  {
    key: { model: 1, tokenType: 1 },
    name: 'admin_model_aggregation',
    background: true,
  },
];

// Indexes to create for Users collection
const USER_INDEXES = [
  {
    key: { role: 1, createdAt: -1 },
    name: 'admin_role_filter',
    background: true,
  },
  {
    key: { banned: 1, createdAt: -1 },
    name: 'admin_banned_filter',
    background: true,
  },
  {
    key: { updatedAt: -1 },
    name: 'admin_active_users',
    background: true,
  },
];

// Indexes to create for Sessions collection
const SESSION_INDEXES = [
  {
    key: { expiration: 1, user: 1 },
    name: 'admin_active_sessions',
    background: true,
  },
  {
    key: { user: 1, expiration: 1 },
    name: 'admin_user_sessions',
    background: true,
  },
  {
    key: { createdAt: 1 },
    name: 'admin_sessions_today',
    background: true,
  },
];

// Indexes to create for Conversations collection
const CONVERSATION_INDEXES = [
  {
    key: { user: 1, updatedAt: -1 },
    name: 'admin_user_recent_convos',
    background: true,
  },
  {
    key: { user: 1, endpoint: 1 },
    name: 'admin_user_endpoint_breakdown',
    background: true,
  },
  {
    key: { user: 1, model: 1 },
    name: 'admin_user_model_breakdown',
    background: true,
  },
];

async function createIndexesForCollection(db, collectionName, indexes) {
  console.log(`\n📋 Creating indexes on "${collectionName}" collection...`);
  const collection = db.collection(collectionName);
  
  for (const index of indexes) {
    try {
      const result = await collection.createIndex(index.key, {
        name: index.name,
        background: index.background,
      });
      console.log(`   ✅ Created index: ${result}`);
    } catch (err) {
      if (err.code === 85 || err.code === 86) {
        console.log(`   ⚠️  Index "${index.name}" already exists (skipping)`);
      } else {
        console.error(`   ❌ Failed to create index "${index.name}":`, err.message);
      }
    }
  }
}

async function createIndexes() {
  console.log('🔧 Admin Dashboard Index Creation Script');
  console.log('========================================\n');
  
  let client;
  try {
    console.log(`📡 Connecting to MongoDB...`);
    console.log(`   URI: ${MONGO_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}\n`);
    
    client = new MongoClient(MONGO_URI);
    await client.connect();
    
    const db = client.db();
    console.log(`✅ Connected to database: ${db.databaseName}`);

    // Create all indexes
    await createIndexesForCollection(db, 'messages', MESSAGE_INDEXES);
    await createIndexesForCollection(db, 'transactions', TRANSACTION_INDEXES);
    await createIndexesForCollection(db, 'users', USER_INDEXES);
    await createIndexesForCollection(db, 'sessions', SESSION_INDEXES);
    await createIndexesForCollection(db, 'conversations', CONVERSATION_INDEXES);

    // List all indexes for verification
    console.log('\n📊 Index Summary:');
    
    for (const collName of ['messages', 'transactions', 'users', 'sessions', 'conversations']) {
      const indexes = await db.collection(collName).indexes();
      const adminIndexes = indexes.filter(idx => idx.name.startsWith('admin_'));
      console.log(`   ${collName}: ${adminIndexes.length} admin indexes`);
    }

    console.log('\n✅ Index creation complete!');
    console.log('\n💡 Note: Background index creation may take a few minutes on large collections.');
    console.log('   You can monitor progress with: db.currentOp({ "command.createIndexes": { $exists: true } })');

  } catch (err) {
    console.error('\n❌ Error:', err.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('\n👋 Disconnected from MongoDB');
    }
  }
}

// Run the script
createIndexes();
