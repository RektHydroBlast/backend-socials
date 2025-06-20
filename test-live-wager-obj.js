const http = require('http');

function testLiveWagerObject() {
  console.log('=== Testing Live HTTP Server Wager Object ===\n');
  
  const completeWagerInput = "lets do a wager with Alex on india vs england tomorrow for 1 usdc, I think India will win";
  const url = `http://localhost:3001/api/agent?input=${encodeURIComponent(completeWagerInput)}&chat_history=[]&wallet_address=0x1234567890123456789012345678901234567890`;
  
  console.log(`Input: "${completeWagerInput}"`);
  console.log('Expected: Should create a wager object with type "wager"\n');
  
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      
      let data = '';
      const messages = [];
      
      res.on('data', (chunk) => {
        data += chunk.toString();
        
        const lines = data.split('\n');
        data = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6);
              if (jsonStr.trim()) {
                const messageData = JSON.parse(jsonStr);
                messages.push(messageData);
                
                console.log(`📨 [${messageData.type}] ${messageData.content?.substring(0, 80) || 'N/A'}...`);
                
                if (messageData.type === "wager") {
                  console.log(`\n🎯 WAGER OBJECT FOUND!`);
                  console.log(`   Wager ID: ${messageData.wager?.id}`);
                  console.log(`   Event: ${messageData.wager?.wagerDetails?.description}`);
                  console.log(`   Amount: ${messageData.wager?.asset?.amount} ${messageData.wager?.asset?.tokenSymbol}`);
                } else if (messageData.type === "message" && messageData.content?.includes('[OBJ]')) {
                  console.log(`\n⚠️  FOUND OBJ IN MESSAGE TYPE - This is the problem!`);
                  console.log(`   Full message length: ${messageData.content.length}`);
                  console.log(`   First 200 chars: ${messageData.content.substring(0, 200)}`);
                }
                
                if (messageData.type === "end") {
                  resolve(messages);
                  return;
                }
              }
            } catch (error) {
              console.log(`⚠️  Parse error: ${error.message}`);
            }
          }
        }
      });
      
      res.on('end', () => resolve(messages));
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.setTimeout(15000, () => {
      req.destroy();
      resolve(messages);
    });
  });
}

testLiveWagerObject().then(messages => {
  console.log(`\n📊 Summary:`);
  console.log(`   Total messages: ${messages.length}`);
  console.log(`   Message types: ${messages.map(m => m.type).join(', ')}`);
  
  const hasWagerType = messages.some(m => m.type === "wager");
  const hasObjInMessage = messages.some(m => m.type === "message" && m.content?.includes('[OBJ]'));
  
  console.log(`   Has wager type: ${hasWagerType}`);
  console.log(`   Has [OBJ] in message: ${hasObjInMessage}`);
  
  if (!hasWagerType && hasObjInMessage) {
    console.log(`\n❌ ISSUE IDENTIFIED: The wager object is being sent as "message" type instead of "wager" type!`);
    console.log(`   This means the server.ts parsing logic needs to be fixed.`);
  } else if (hasWagerType) {
    console.log(`\n✅ SUCCESS: Wager object is properly sent as "wager" type!`);
  } else {
    console.log(`\n❌ PROBLEM: No wager object found at all!`);
  }
}).catch(console.error);
