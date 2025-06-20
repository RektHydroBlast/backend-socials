const EventSource = require('eventsource');

console.log('Testing new EventSource format...\n');

// Test 1: Complete wager input
function testCompleteWager() {
  return new Promise((resolve) => {
    console.log('=== Test 1: Complete Wager ===');
    
    const url = 'http://localhost:3001/api/agent?' + 
      'input=' + encodeURIComponent('I want to bet $50 USDC that India will beat Pakistan in the cricket match tomorrow at 3 PM') +
      '&chat_history=[]' +
      '&wallet_address=0x1234567890123456789012345678901234567890';
    
    const eventSource = new EventSource(url);
    const messages = [];
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', JSON.stringify(data, null, 2));
        messages.push(data);
        
        if (data.type === 'streamEnd') {
          eventSource.close();
          
          // Verify we got a wager object
          const wagerMessage = messages.find(msg => msg.type === 'wager');
          if (wagerMessage && wagerMessage.wager) {
            console.log('✅ Complete wager test PASSED - Received wager object');
            console.log('Wager ID:', wagerMessage.wager.id);
            console.log('Amount:', wagerMessage.wager.asset.amount);
            console.log('Event:', wagerMessage.wager.wagerDetails.description);
          } else {
            console.log('❌ Complete wager test FAILED - No wager object received');
          }
          resolve();
        }
      } catch (error) {
        console.error('Error parsing event data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
      resolve();
    };
    
    // Timeout after 30 seconds
    setTimeout(() => {
      eventSource.close();
      console.log('Test timed out');
      resolve();
    }, 30000);
  });
}

// Test 2: Incomplete wager input
function testIncompleteWager() {
  return new Promise((resolve) => {
    console.log('\n=== Test 2: Incomplete Wager ===');
    
    const url = 'http://localhost:3001/api/agent?' + 
      'input=' + encodeURIComponent('I want to bet on the Lakers game') +
      '&chat_history=[]' +
      '&wallet_address=0x1234567890123456789012345678901234567890';
    
    const eventSource = new EventSource(url);
    const messages = [];
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received:', JSON.stringify(data, null, 2));
        messages.push(data);
        
        if (data.type === 'streamEnd') {
          eventSource.close();
          
          // Verify we got a message asking for more info
          const messageRequests = messages.filter(msg => msg.type === 'message' && msg.content);
          if (messageRequests.length > 0) {
            console.log('✅ Incomplete wager test PASSED - Received request for more info');
            console.log('Message:', messageRequests[messageRequests.length - 1].content);
          } else {
            console.log('❌ Incomplete wager test FAILED - No message request received');
          }
          resolve();
        }
      } catch (error) {
        console.error('Error parsing event data:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      eventSource.close();
      resolve();
    };
    
    // Timeout after 30 seconds
    setTimeout(() => {
      eventSource.close();
      console.log('Test timed out');
      resolve();
    }, 30000);
  });
}

// Run tests sequentially
async function runTests() {
  try {
    await testCompleteWager();
    await testIncompleteWager();
    console.log('\n=== All tests completed ===');
  } catch (error) {
    console.error('Test error:', error);
  }
}

runTests();
