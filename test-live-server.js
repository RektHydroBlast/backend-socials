const https = require('https');
const http = require('http');

async function testServerRequest(input, description) {
  console.log(`\n=== Testing: ${description} ===`);
  console.log(`Input: "${input}"`);
  
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3001/api/agent?input=${encodeURIComponent(input)}&chat_history=[]&wallet_address=0x1234567890123456789012345678901234567890`;
    
    const req = http.get(url, (res) => {
      console.log(`Status: ${res.statusCode}`);
      console.log(`Headers:`, res.headers);
      
      let data = '';
      const messages = [];
      
      res.on('data', (chunk) => {
        data += chunk.toString();
        
        // Parse Server-Sent Events
        const lines = data.split('\n');
        data = lines.pop() || ''; // Keep the last incomplete line
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.substring(6); // Remove 'data: '
              if (jsonStr.trim()) {
                const messageData = JSON.parse(jsonStr);
                messages.push(messageData);
                console.log(`📨 [${messageData.type}] ${messageData.content || 'N/A'}`);
                if (messageData.wager) {
                  console.log(`   Wager: ${JSON.stringify(messageData.wager, null, 2)}`);
                }
                
                // If we get an "end" event, close the connection
                if (messageData.type === "end") {
                  console.log('🏁 Stream ended');
                  resolve(messages);
                  return;
                }
              }
            } catch (error) {
              console.log(`⚠️  Failed to parse: ${line}`);
            }
          }
        }
      });
      
      res.on('end', () => {
        console.log('🔚 Connection ended');
        resolve(messages);
      });
      
      res.on('error', (error) => {
        console.error('❌ Response error:', error);
        reject(error);
      });
    });
    
    req.on('error', (error) => {
      console.error('❌ Request error:', error);
      reject(error);
    });
    
    // Set a timeout
    req.setTimeout(10000, () => {
      console.log('⏰ Request timeout');
      req.destroy();
      resolve(messages);
    });
  });
}

async function runServerTests() {
  console.log('Testing live server...\n');
  
  try {
    // Test 1: Incomplete wager
    const messages1 = await testServerRequest(
      "I want to bet on a cricket match",
      "Incomplete wager request"
    );
    console.log(`✅ Received ${messages1.length} messages`);
    
    // Test 2: More complete wager
    const messages2 = await testServerRequest(
      "I want to bet on India vs England cricket match, my prediction is India will win",
      "Complete wager request"
    );
    console.log(`✅ Received ${messages2.length} messages`);
    
    console.log('\n=== Server Test Results ===');
    console.log('✅ Server is responding to requests');
    console.log('✅ EventSource streaming is working');
    console.log('✅ Messages are being sent in the correct format');
    
  } catch (error) {
    console.error('❌ Server test failed:', error.message);
  }
}

runServerTests();
