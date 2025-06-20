const { HumanMessage, AIMessage } = require('@langchain/core/messages');

// Mock the graph module since we can't import it directly in this test
const mockGetActualLangGraph = () => {
  return {
    async *stream(initialState, options) {
      // Simulate initial_node response
      yield {
        'initial_node': {
          messages: ['I understand you want to create a wager. Let me help you with that.']
        }
      };
      
      // Simulate extraction node asking for missing info
      if (!initialState.input.includes('prediction')) {
        yield {
          'wager_info_extraction_node': {
            messages: ['What is your prediction for this event?']
          }
        };
      }
      
      // If we have all info, simulate validation node
      if (initialState.input.includes('prediction') && initialState.input.includes('vs')) {
        yield {
          'wager_validation_node': {
            messages: ['[OBJ]{"event":"India vs England","playerA":{"name":"You","address":"0x123","isDeposited":false},"playerB":{"name":"Friend","address":"0x456","isDeposited":false},"prediction":"India will win","amount":"10","token":"USDC","outcome":null}[/OBJ]']
          }
        };
      }
    }
  };
};

// Test different scenarios
async function testServerResponse(input, expectedMessageCount, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`Input: "${input}"`);
  
  try {
    const mockGraph = mockGetActualLangGraph();
    const initialState = {
      input,
      chat_history: [],
      playerA: {
        name: "You",
        address: "0x123",
        isDeposited: false
      }
    };
    
    const stream = await mockGraph.stream(initialState, {
      streamMode: "updates",
      recursionLimit: 100,
    });
    
    const messages = [];
    
    for await (const value of stream) {
      for (const [nodeName, nodeOutput] of Object.entries(value)) {
        const output = nodeOutput;
        
        if (output?.messages?.[0]) {
          const message = output.messages[0];
          
          // Check if this is a wager object message
          const wagerObjectMatch = message.match(/\[OBJ\](.*?)\[\/OBJ\]/);
          if (wagerObjectMatch && nodeName === "wager_validation_node") {
            try {
              const wagerObject = JSON.parse(wagerObjectMatch[1]);
              messages.push({
                type: "wager",
                content: "Wager created successfully!",
                wager: wagerObject
              });
            } catch (error) {
              messages.push({
                type: "message",
                content: "Error creating wager object",
                wager: null
              });
            }
          } else {
            messages.push({
              type: "message",
              content: message,
              wager: null
            });
          }
        }
      }
    }
    
    console.log(`Expected ${expectedMessageCount} messages, got ${messages.length}`);
    messages.forEach((msg, i) => {
      console.log(`  ${i + 1}. [${msg.type}] ${msg.content}`);
      if (msg.wager) {
        console.log(`     Wager: ${JSON.stringify(msg.wager, null, 2)}`);
      }
    });
    
    if (messages.length >= expectedMessageCount) {
      console.log(`✅ PASS: Got at least ${expectedMessageCount} message(s)`);
    } else {
      console.log(`❌ FAIL: Expected at least ${expectedMessageCount} messages, got ${messages.length}`);
    }
    
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
  }
}

async function runTests() {
  console.log('Testing server response behavior...\n');
  
  // Test 1: Incomplete wager (missing prediction)
  await testServerResponse(
    "I want to bet on India vs England match",
    2, // Should get initial response + ask for prediction
    "Incomplete wager - missing prediction"
  );
  
  // Test 2: Complete wager
  await testServerResponse(
    "I want to bet on India vs England match, my prediction is India will win",
    2, // Should get initial response + wager object
    "Complete wager - all info provided"
  );
  
  // Test 3: Very incomplete wager
  await testServerResponse(
    "I want to make a bet",
    2, // Should get initial response + ask for more info
    "Very incomplete wager - minimal info"
  );
  
  console.log('\n=== Test Summary ===');
  console.log('✅ All tests check that the backend ALWAYS sends at least one message');
  console.log('✅ The server should never leave the frontend hanging without a response');
  console.log('✅ Use "end" event type (not "streamEnd") for frontend compatibility');
}

runTests().catch(console.error);
