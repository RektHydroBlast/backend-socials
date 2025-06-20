// Test script to debug why the event_details_extraction_node is asking for more info
const { createWagerGraph } = require('./dist/ai/graph');

async function debugEventExtractionNode() {
  console.log('=== Testing Event Extraction Logic ===\n');
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
  
  const testCases = [
    {
      name: "Complete wager with prediction",
      input: "I want to bet on India vs England cricket match, my prediction is India will win, betting 10 USDC with friend named Bob"
    },
    {
      name: "Incomplete wager",
      input: "I want to bet on a cricket match"
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n--- Testing: ${testCase.name} ---`);
    console.log(`Input: "${testCase.input}"`);
    
    try {
      const initialState = {
        input: testCase.input,
        chat_history: []
      };
      
      const stream = await graph.stream(initialState, {
        streamMode: "updates",
        recursionLimit: 100,
      });
      
      for await (const value of stream) {
        for (const [nodeName, nodeOutput] of Object.entries(value)) {
          console.log(`\n🔄 Node: ${nodeName}`);
          
          if (nodeOutput.messages && nodeOutput.messages.length > 0) {
            console.log(`📝 Message: ${nodeOutput.messages[0]}`);
          }
          
          // Show detailed state when we reach event_details_extraction_node
          if (nodeName === "event_details_extraction_node") {
            console.log("🔍 State Details:");
            console.log("  playerA:", nodeOutput.playerA);
            console.log("  playerB:", nodeOutput.playerB);
            console.log("  wagerDetails:", nodeOutput.wagerDetails);
            console.log("  userPrediction:", nodeOutput.userPrediction);
            console.log("  asset:", nodeOutput.asset);
            console.log("  operation:", nodeOutput.operation);
            console.log("  currentStep:", nodeOutput.currentStep);
            
            // Check the condition from line 416-423
            const hasBasicInfo = nodeOutput.wagerDetails?.description && 
                               nodeOutput.wagerDetails?.eventDate && 
                               nodeOutput.userPrediction && 
                               nodeOutput.playerB?.name && 
                               nodeOutput.asset?.amount;
            console.log("  hasBasicInfo:", hasBasicInfo);
          }
          
          if (nodeName === "wager_validation_node") {
            console.log("🎯 Reached validation node!");
          }
        }
      }
      
    } catch (error) {
      console.error(`❌ Error: ${error.message}`);
    }
  }
}

debugEventExtractionNode().catch(console.error);
