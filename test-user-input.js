// Test the exact user input
const { createWagerGraph } = require('./dist/ai/graph.js');

async function testUserInput() {
  console.log("🧪 Testing exact user input...");
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
  
  // Your exact input
  const testInput = "lets do a wager on india vs england tomorrow for 1 usdc";
  
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
        console.log(`${i + 1}. ${msg}`);
      });
      
      console.log("\n✅ SUCCESS: Message is present for frontend");
    } else {
      console.log("❌ FAILED: No messages found!");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testUserInput();
