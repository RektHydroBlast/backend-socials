// Test script to check for missing fields behavior
const { createWagerGraph } = require('./dist/ai/graph.js');

async function testMissingFields() {
  console.log("🧪 Testing missing fields behavior...");
  
  const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
    // Test with your original scenario - missing prediction
  const testInput = "I want to bet with Alex on tomorrow's cricket match India vs England, 1 USDC";
  
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
    
    console.log("\n💬 MESSAGES:");
    if (result.messages && result.messages.length > 0) {
      result.messages.forEach((msg, i) => {
        console.log(`${i + 1}. ${msg}`);
      });
      
      console.log("\n✅ SUCCESS: Message is present in result");
    } else {
      console.log("❌ FAILED: No messages found in result!");
    }
    
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    console.error("Stack:", error.stack);
  }
}

testMissingFields();
