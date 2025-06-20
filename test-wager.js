// Quick test for wager flow
const { createWagerGraph } = require('./dist/ai/graph.js');

async function testWagerFlow() {
  console.log("🧪 Testing wager flow...");
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
  
  // Test with complete wager info
  const testInput = "I want to bet with Alex on tomorrow's cricket match India vs England, 1 USDC, I think India will win";
  
  try {
    const result = await graph.invoke({
      input: testInput
    });
    
    console.log("📊 Result:");
    console.log("Messages:", result.messages);
    console.log("Operation:", result.operation);
    console.log("Current Step:", result.currentStep);
    
    // Check if we get the OBJ format
    if (result.messages && result.messages.length > 0) {
      const lastMessage = result.messages[result.messages.length - 1];
      if (lastMessage.includes('[OBJ]') && lastMessage.includes('[/OBJ]')) {
        console.log("✅ SUCCESS: Got OBJ format!");
        
        // Extract and parse the object
        const objStart = lastMessage.indexOf('[OBJ]') + 5;
        const objEnd = lastMessage.indexOf('[/OBJ]');
        const objStr = lastMessage.substring(objStart, objEnd);
        
        try {
          const wagerObj = JSON.parse(objStr);
          console.log("📋 Wager Object Generated:");
          console.log("- ID:", wagerObj.id);
          console.log("- Player A:", wagerObj.participants.playerA.name);
          console.log("- Player A Prediction:", wagerObj.participants.playerA.prediction);
          console.log("- Player B:", wagerObj.participants.playerB.name);
          console.log("- Event:", wagerObj.wagerDetails.description);
          console.log("- Amount:", wagerObj.asset.amount, wagerObj.asset.tokenSymbol);
        } catch (e) {
          console.log("❌ Failed to parse wager object:", e.message);
        }
      } else {
        console.log("❌ FAILED: No OBJ format found");
        console.log("Last message:", lastMessage);
      }
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

testWagerFlow();
