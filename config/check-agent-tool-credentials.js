const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const mongoose = require('mongoose');
const connect = require('./connect');

const checkAgentToolCredentials = async () => {
  try {
    await connect();
    
    // Get agent ID from command line or use default
    const agentId = process.argv[2] || 'agent_example';
    
    console.log(`🔍 Checking tool credentials for agent: ${agentId}`);
    
    // Find the agent
    const agent = await mongoose.connection.db.collection('agents').findOne({
      id: agentId
    });
    
    if (!agent) {
      console.log(`❌ Agent not found: ${agentId}`);
      console.log('\nUsage: node config/check-agent-tool-credentials.js <agent_id>');
      process.exit(1);
    }
    
    console.log(`✅ Agent found: "${agent.name}"`);
    console.log(`📋 Agent tools: ${JSON.stringify(agent.tools)}`);
    
    if (agent.tool_credentials) {
      console.log(`🔑 Agent has tool_credentials field:`, Object.keys(agent.tool_credentials));
      
      for (const [toolName, credentials] of Object.entries(agent.tool_credentials)) {
        console.log(`\n📦 Tool: ${toolName}`);
        console.log(`   Credential fields: ${JSON.stringify(Object.keys(credentials))}`);
        
        // Show credential field lengths (not values for security)
        for (const [field, value] of Object.entries(credentials)) {
          console.log(`   - ${field}: ${value ? `${value.length} chars (encrypted)` : 'empty'}`);
        }
      }
    } else {
      console.log(`❌ Agent does not have tool_credentials field`);
    }

    process.exit(0);
  } catch (err) {
    console.error('Error checking agent credentials:', err);
    process.exit(1);
  }
};

checkAgentToolCredentials();
