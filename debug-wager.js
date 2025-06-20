// Debug script to trace wager flow execution
const { createWagerGraph } = require('./dist/ai/graph.js');

async function debugWagerFlow() {
  console.log("🔍 Debugging wager flow...");
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");  // Test with complete wager info
  const testInput = "I want to bet with Alex on tomorrow's cricket match India vs England, 1 USDC, I think India will win";
  
  try {
    console.log("📨 Input:", testInput);
    
    const result = await graph.invoke({
      input: testInput
    });
    
    console.log("\n📊 FINAL RESULT:");
    console.log("Operation:", result.operation);
    console.log("Current Step:", result.currentStep);
    console.log("Need More Info:", result.needsMoreInfo);
    console.log("Missing Fields:", result.missingFields);
    console.log("User Prediction:", result.userPrediction);
    console.log("Player B:", result.playerB?.name);
    console.log("Event:", result.wagerDetails?.description);
    console.log("Amount:", result.asset?.amount);
    
    console.log("\n💬 MESSAGES:");
    if (result.messages && result.messages.length > 0) {
      result.messages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg.substring(0, 200)}...`);
      });
      
      const lastMessage = result.messages[result.messages.length - 1];
      
      if (lastMessage.includes('[OBJ]') && lastMessage.includes('[/OBJ]')) {
        console.log("\n✅ SUCCESS: Got OBJ format!");
      } else {
        console.log("\n❌ FAILED: No OBJ format found");
        console.log("Last message starts with:", lastMessage.substring(0, 100));
        
        // Check if it's a conversational response instead
        if (lastMessage.includes("Wager Summary") || 
            lastMessage.includes("You're all set") ||
            lastMessage.includes("Event Details")) {
          console.log("🚨 ISSUE: AI generated conversational response instead of OBJ format");
          console.log("This means the flow didn't reach the validation node properly!");
        }
      }
    } else {
      console.log("No messages found!");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

debugWagerFlow();
