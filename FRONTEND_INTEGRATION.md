## Frontend Integration Guide for Wager Object

### How to Extract the Wager Object

The system outputs messages in this format when a wager is complete:

```javascript
{
  messages: [
    "conversational response...",  // May contain multiple conversational messages
    "[OBJ]{...wager object...}[/OBJ]"  // Final message with wager object
  ],
  operation: "completed",
  currentStep: "completed"
}
```

### Frontend Processing

To extract the wager object:

```javascript
function extractWagerObject(result) {
  // Check if operation is completed
  if (result.operation !== "completed") {
    return null; // Still in progress, show last message
  }
  
  // Find the last message containing [OBJ]...[/OBJ]
  for (let i = result.messages.length - 1; i >= 0; i--) {
    const message = result.messages[i];
    if (message.includes('[OBJ]') && message.includes('[/OBJ]')) {
      // Extract the JSON object
      const objStart = message.indexOf('[OBJ]') + 5;
      const objEnd = message.indexOf('[/OBJ]');
      const objStr = message.substring(objStart, objEnd);
      
      try {
        return JSON.parse(objStr);
      } catch (e) {
        console.error('Failed to parse wager object:', e);
        return null;
      }
    }
  }
  
  return null;
}

// Usage in frontend
const wagerObject = extractWagerObject(aiResponse);
if (wagerObject) {
  // Display wager object UI
  console.log('Wager created:', wagerObject);
  // Show wager details, generate share link, etc.
} else {
  // Show conversational messages
  const lastMessage = aiResponse.messages[aiResponse.messages.length - 1];
  displayMessage(lastMessage);
}
```

### Expected Wager Object Structure

```typescript
interface WagerObject {
  id: string;
  participants: {
    playerA: {
      name: string;
      address: string;
      prediction: string;
      isInitiator: boolean;
      isDeposited: boolean;
    };
    playerB: {
      name: string;
      address: null;
      prediction: null;
      isInitiator: boolean;
      isDeposited: boolean;
    };
  };
  wagerDetails: {
    description: string;
    eventDate: string;
    category: string;
    createdAt: string;
  };
  asset: {
    tokenAddress: string;
    tokenSymbol: string;
    tokenDecimals: number;
    amount: number;
    totalPot: number;
    amountPerPlayer: number;
  };
  oracle: {
    provider: string;
    endpoint: string;
    query: string;
    resolvedResult: null;
    isResolved: boolean;
  };
  blockchain: {
    chain: string;
    chainId: string;
    features: {
      accountAbstraction: boolean;
      gaslessTransactions: boolean;
      paymasterEnabled: boolean;
    };
  };
  status: string;
  contractAddress: null;
  createdAt: string;
  expiresAt: string;
}
```

### Test Cases

✅ **Working Test Case:**
```
Input: "I want to bet with Alex on tomorrow's cricket match India vs England, 1 USDC, I think India will win"
Output: [OBJ]{...wager object...}[/OBJ]
```

The system correctly:
- Extracts all required fields (participant, event, amount, prediction)
- Skips intermediate steps when all info is present
- Outputs final wager object in the correct format
- Includes user's prediction ("india")
- Sets up proper token details (USDC)
- Generates unique wager ID
- Sets expiration date (7 days)
