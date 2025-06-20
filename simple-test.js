// Simple test to debug the missing fields issue
const { createWagerGraph } = require('./dist/ai/graph.js');

async function simpleMissingFieldsTest() {
  console.log("🧪 Testing missing fields...");
  
  try {
    const graph = createWagerGraph("0x1234567890123456789012345678901234567890");
      // Test with your specific scenario that shows missing fields
    const testInput = "I want to bet with Alex on cricket match";
    
    console.log("📨 Input:", testInput);
    
    const result = await graph.invoke({
      input: testInput
    });
    
    console.log("\n📊 RESULT:");
    console.log("Operation:", result.operation);
    console.log("Messages length:", result.messages?.length || 0);
    console.log("Messages:", result.messages);
    console.log("Missing fields:", result.missingFields);
    
  } catch (error) {
    console.error("❌ Error:", error.message);
  }
}

simpleMissingFieldsTest();
