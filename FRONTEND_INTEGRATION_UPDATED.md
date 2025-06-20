# Frontend Integration Guide

## ✅ BACKEND STATUS: READY FOR FRONTEND INTEGRATION

The backend has been thoroughly tested and is working correctly with the following behavior:

### Server Endpoint
- **URL**: `http://localhost:3001/api/agent`
- **Method**: `GET` with query parameters
- **Response**: EventSource stream (Server-Sent Events)

### Request Parameters
```
GET /api/agent?input=USER_MESSAGE&chat_history=[]&wallet_address=0x123...
```

- `input` (required): User's message
- `chat_history` (optional): JSON array of previous messages `[["human", "message"], ["assistant", "response"]]`
- `wallet_address` (optional): User's wallet address (42 chars, starts with 0x)

### Response Format
The server streams messages in this exact format:

```javascript
// Loading indicator (first message)
{
  "type": "loading",
  "content": "Processing your request...",
  "wager": null
}

// Regular message (asking for more info) - NOW WITH MARKDOWN & EMOJIS!
{
  "type": "message", 
  "content": "**Cricket Match 🏏**: We're off to a great start! 👍\n**Next Step**: **Who is Player B?** 👥 I need to know who you're betting against so I can set up the wager properly. You can share the wager link with them later!",
  "wager": null
}

// Wager created (final message when complete)
{
  "type": "wager",
  "content": "Wager created successfully!",
  "wager": {
    "id": "wager_1750424273445_se2k7wvyb",
    "participants": {
      "playerA": {
        "name": "You",
        "address": "0x1234567890123456789012345678901234567890",
        "prediction": "india",
        "isInitiator": true,
        "isDeposited": false
      },
      "playerB": {
        "name": "Alex",
        "address": null,
        "prediction": null,
        "isInitiator": false,
        "isDeposited": false
      }
    },
    "wagerDetails": {
      "description": "india vs england",
      "eventDate": "tomorrow",
      "category": "sports",
      "createdAt": "2025-06-20T12:57:21.086Z"
    },
    "asset": {
      "tokenAddress": "0xc86fed58edf0981e927160c50ecb8a8b05b32fed",
      "tokenSymbol": "USDC",
      "tokenDecimals": 6,
      "amount": 1,
      "totalPot": 2,
      "amountPerPlayer": 1
    },
    "oracle": {
      "provider": "Perplexity",
      "endpoint": "https://api.perplexity.ai/chat/completions",
      "query": "What was the result of india vs england on tomorrow? What was the outcome?",
      "resolvedResult": null,
      "isResolved": false
    },
    "blockchain": {
      "chain": "NERO",
      "chainId": "nero-testnet",
      "features": {
        "accountAbstraction": true,
        "gaslessTransactions": true,
        "paymasterEnabled": true
      }
    },
    "status": "created",
    "contractAddress": null,
    "createdAt": "2025-06-20T12:57:21.086Z",
    "expiresAt": "2025-06-27T12:57:21.086Z"
  }
}

// Stream end (always sent last)
{
  "type": "end"
}
```

### ✨ **Enhanced AI Responses**

The backend now provides **rich, helpful responses** with:

- **📝 Markdown formatting** - Bold text, headers, and structured content
- **🎨 Emojis** - Visual indicators and engaging symbols  
- **📚 Detailed guidance** - Clear explanations of what information is needed
- **💡 Examples** - Specific examples to help users provide the right information
- **🤝 Conversational tone** - Friendly, helpful communication

### Example Enhanced Responses

**When missing participant:**
```
**Cricket Match 🏏**: We're off to a great start! 👍 
**Next Step**: **Who is Player B?** 👥 I need to know who you're betting against so I can set up the wager properly. You can share the wager link with them later!
```

**When missing prediction:**
```
**Almost there! 🎉** 
**What's your prediction?** 🎲 Who do you think will win or what outcome are you betting on? For example: 'India will win', 'England will win', or 'Draw' if you think it'll be a stalemate.
```

### Frontend Implementation

```javascript
function connectToWagerAgent(userInput, chatHistory = [], walletAddress = null) {
  const params = new URLSearchParams({
    input: userInput,
    chat_history: JSON.stringify(chatHistory)
  });
  
  if (walletAddress) {
    params.append('wallet_address', walletAddress);
  }
  
  const eventSource = new EventSource(`http://localhost:3001/api/agent?${params}`);
  
  eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'loading':
        // Show loading indicator
        showLoadingMessage(data.content);
        break;
        
      case 'message':
        // Display regular message WITH MARKDOWN SUPPORT
        addChatMessage('assistant', data.content, { 
          parseMarkdown: true,  // Enable markdown parsing
          allowEmojis: true     // Preserve emojis
        });
        break;
        
      case 'wager':
        // Show wager receipt modal
        addChatMessage('assistant', data.content);
        showWagerReceiptModal(data.wager);
        break;
        
      case 'end':
        // Close connection
        eventSource.close();
        break;
        
      case 'error':
        // Handle error
        console.error('Error:', data.payload.message);
        eventSource.close();
        break;
    }
  };
  
  eventSource.onerror = function(error) {
    console.error('EventSource error:', error);
    eventSource.close();
  };
  
  return eventSource;
}

// Example markdown rendering function
function addChatMessage(sender, content, options = {}) {
  const messageElement = document.createElement('div');
  messageElement.className = `chat-message ${sender}`;
  
  if (options.parseMarkdown) {
    // Simple markdown parsing for bold text
    content = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }
  
  messageElement.innerHTML = content;
  document.querySelector('.chat-container').appendChild(messageElement);
}
```

### 🎨 **Frontend Styling Recommendations**

To make the most of the enhanced responses, consider:

```css
.chat-message.assistant {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 18px;
  padding: 16px;
  margin: 8px 0;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.chat-message strong {
  color: #ffd700; /* Gold for important text */
  font-weight: 600;
}

.chat-message {
  font-size: 16px;
  line-height: 1.5;
  max-width: 80%;
}

/* Emoji support */
.chat-message {
  font-family: 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif;
}
```

### Guaranteed Behavior

✅ **The backend ALWAYS sends a message** - never leaves frontend hanging  
✅ **Loading indicator** - Shows processing state immediately  
✅ **End event** - Always sent to close the stream properly  
✅ **Consistent format** - Every message has `type`, `content`, and `wager` fields  
✅ **Error handling** - Graceful error messages if something goes wrong  
✅ **Rich responses** - Markdown formatting, emojis, and detailed guidance  
✅ **Helpful examples** - AI provides specific examples to guide user input  
✅ **Conversational tone** - Friendly, engaging communication style  

### 🎯 **AI Response Examples**

**Initial wager creation:**
```markdown
## 🎉 **Let's Create Your Wager!**

**Your Connected Wallet**: 0x123... ✅  
**You are Player A** (the wager initiator)

## 📋 **What I Need to Set Up Your Wager**
To create a secure, trustless wager, I'll need these details:

1. **👥 Player B**: Who are you betting against?
2. **🏆 Event**: What are you betting on?
3. **📅 Timing**: When is this event happening?
4. **💰 Amount**: How much do you want to wager?
5. **🎲 Your Prediction**: What outcome are you betting on?

**Ready?** Please provide as much information as you can!
```

**Missing information requests:**
```markdown
**Cricket Match 🏏**: We're off to a great start! 👍 
**Next Step**: **Who is Player B?** 👥 I need to know who you're betting against so I can set up the wager properly.
```

### Test Examples

**Complete wager input:**
```
"lets do a wager with Alex on india vs england tomorrow for 1 usdc, I think India will win"
```
**Response:** Loading → Wager object → End

**Incomplete wager input:**
```
"I want to bet on a cricket match"
```
**Response:** Loading → "Who is playing against you in this cricket match?" → End

### Development Commands

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Start server
pnpm start

# Development mode
pnpm dev
```

### Port Configuration
- Default port: `3001`
- Can be changed via `PORT` environment variable

The backend is now fully ready for frontend integration with reliable EventSource streaming!
