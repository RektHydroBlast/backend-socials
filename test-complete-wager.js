// Test with COMPLETE wager information to verify final node output
const { createWagerGraph } = require('./dist/ai/graph.js');

async function testCompleteWager() {
  console.log("🧪 Testing COMPLETE wager input...");
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
  
  // Complete input with ALL required fields
  const testInput = "lets do a wager with Alex on india vs england tomorrow for 1 usdc, I think India will win";
  
  try {
    console.log("📨 Complete Input:", testInput);
    
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
        console.log(`${i + 1}. Length: ${msg.length} chars`);
        if (msg.includes('[OBJ]') && msg.includes('[/OBJ]')) {
          console.log(`   ✅ CONTAINS OBJ FORMAT!`);
          
          // Extract and validate the object
          const objStart = msg.indexOf('[OBJ]') + 5;
          const objEnd = msg.indexOf('[/OBJ]');
          const objStr = msg.substring(objStart, objEnd);
          
          try {
            const wagerObj = JSON.parse(objStr);
            console.log("\n🎯 EXTRACTED WAGER OBJECT:");
            console.log("- ID:", wagerObj.id);
            console.log("- Player A:", wagerObj.participants.playerA.name);
            console.log("- Player A Prediction:", wagerObj.participants.playerA.prediction);
            console.log("- Player B:", wagerObj.participants.playerB.name);
            console.log("- Event:", wagerObj.wagerDetails.description);
            console.log("- Amount:", wagerObj.asset.amount, wagerObj.asset.tokenSymbol);
            console.log("- Status:", wagerObj.status);
          } catch (e) {
            console.log("❌ Failed to parse object:", e.message);
          }
        } else {
          console.log(`   ❌ NO OBJ FORMAT - starts with: ${msg.substring(0, 50)}...`);
        }
      });
      
      if (result.operation === "completed") {
        console.log("\n✅ SUCCESS: Flow completed successfully!");
      } else {
        console.log("\n❌ ISSUE: Flow did not complete - operation:", result.operation);
      }
    } else {
      console.log("❌ CRITICAL: No messages found in result!");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

testCompleteWager();
