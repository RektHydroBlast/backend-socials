const http = require('http');

function testUpdatedTemplates() {
  console.log('=== Testing Updated Templates ===\n');
  
  const testCases = [
    {
      name: "Incomplete wager (missing participants)",
      input: "I want to bet on a cricket match"
    },
    {
      name: "Missing prediction",
      input: "I want to bet with Alex on India vs England tomorrow for 10 USDC"
    }
  ];
  
  return Promise.all(testCases.map(testCase => {
    return new Promise((resolve, reject) => {
      console.log(`\n--- ${testCase.name} ---`);
      console.log(`Input: "${testCase.input}"`);
      
      const url = `http://localhost:3001/api/agent?input=${encodeURIComponent(testCase.input)}&chat_history=[]&wallet_address=0x1234567890123456789012345678901234567890`;
      
      const req = http.get(url, (res) => {
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
                  
                  if (messageData.type === "message") {
                    console.log(`\n📝 Response Message:`);
                    console.log(messageData.content);
                    console.log(`\n📊 Length: ${messageData.content.length} characters`);
                    console.log(`✅ Has markdown formatting: ${messageData.content.includes('##') || messageData.content.includes('**')}`);
                    console.log(`✅ Has emojis: ${/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(messageData.content)}`);
                  }
                  
                  if (messageData.type === "end") {
                    resolve(messages);
                    return;
                  }
                }
              } catch (error) {
                // Skip parse errors
              }
            }
          }
        });
        
        res.on('end', () => resolve(messages));
        res.on('error', reject);
      });
      
      req.on('error', reject);
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(messages);
      });
    });
  }));
}

testUpdatedTemplates().then(results => {
  console.log(`\n✅ Template testing completed!`);
  console.log(`📝 The AI responses should now be more helpful and detailed`);
  console.log(`🎨 Responses should include markdown formatting and emojis`);
  console.log(`📚 Users should get clearer guidance on what information is needed`);
}).catch(console.error);
