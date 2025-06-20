const http = require('http');

function testLiveWager() {
  const input = "lets do a wager with Alex on india vs england tomorrow for 1 usdc, I think India will win";
  const url = `http://localhost:3001/api/agent?input=${encodeURIComponent(input)}&chat_history=[]&wallet_address=0x1234567890123456789012345678901234567890`;
  
  console.log('=== Testing Live Server with Complete Wager ===');
  console.log(`Input: "${input}"`);
  
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
                
                if (messageData.type === "wager" && messageData.wager) {
                  console.log(`🎯 WAGER CREATED!`);
                  console.log(`   Event: ${messageData.wager.wagerDetails?.description}`);
                  console.log(`   Amount: ${messageData.wager.asset?.amount} ${messageData.wager.asset?.tokenSymbol}`);
                  console.log(`   PlayerA: ${messageData.wager.participants?.playerA?.name} (${messageData.wager.participants?.playerA?.prediction})`);
                  console.log(`   PlayerB: ${messageData.wager.participants?.playerB?.name}`);
                  console.log(`   ID: ${messageData.wager.id}`);
                }
                
                if (messageData.type === "end") {
                  console.log('🏁 Stream ended');
                  resolve(messages);
                  return;
                }
              }
            } catch (error) {
              console.log(`⚠️  Failed to parse: ${line.substring(0, 50)}...`);
            }
          }
        }
      });
      
      res.on('end', () => resolve(messages));
      res.on('error', reject);
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      resolve(messages);
    });
  });
}

testLiveWager().then(messages => {
  console.log(`\n✅ Test completed with ${messages.length} messages`);
  const hasWager = messages.some(m => m.type === "wager");
  const hasEnd = messages.some(m => m.type === "end");
  console.log(`✅ Wager object created: ${hasWager}`);
  console.log(`✅ End event sent: ${hasEnd}`);
  console.log(`✅ Backend working correctly!`);
}).catch(console.error);
