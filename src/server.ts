import express, { Request, Response } from 'express';
import cors from 'cors';
import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

// Import the actual nodegraph implementation
import { nodegraph as getActualLangGraph } from './ai/graph';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Helper function to convert chat history
const convertChatHistoryToMessages = (
  chat_history: [role: string, content: string][],
): BaseMessage[] => {
  return chat_history.map(([role, content]) => {
    switch (role.toLowerCase()) {
      case "human":
        return new HumanMessage(content);
      case "assistant":
      case "ai":
        return new AIMessage(content);
      default:
        console.warn(`Unknown role "${role}" in chat history. Treating as human message.`);
        return new HumanMessage(content); 
    }
  });
};

// Get the compiled graph
const getLangGraph = () => {
  return getActualLangGraph();
};

// API Endpoint for Chat Agent
app.get('/api/agent', async (req: Request, res: Response) => {
  const { input, chat_history: chatHistoryString } = req.query;

  if (typeof input !== 'string' || !input) {
    return res.status(400).json({ error: 'Input query parameter is required' });
  }

  let parsedChatHistory: [role: string, content: string][] = [];
  if (typeof chatHistoryString === 'string' && chatHistoryString) {
    try {
      parsedChatHistory = JSON.parse(chatHistoryString);
      if (!Array.isArray(parsedChatHistory)) {
        throw new Error('Chat history must be an array.');
      }
    } catch (error: any) {
      console.warn('Invalid chat_history format:', chatHistoryString, error.message);
      return res.status(400).json({ error: `Invalid chat_history format: ${error.message}` });
    }
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const sendEvent = (data: any) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };
  let lastNodeMessage = "";
  let initialNodeComplete = false;

  try {
    const graph = getLangGraph();
    // @ts-ignore - The graph stream types are not properly inferred
    const stream = await graph.stream(
      {
        input,
        chat_history: convertChatHistoryToMessages(parsedChatHistory),
      },
      {
        streamMode: "updates",
        recursionLimit: 100,
      }
    );

    let hasSentLoadingIndicator = false;

    for await (const value of stream) {
      if (process.env.NODE_ENV === 'development') {
        console.warn("LangGraph Stream Update:", JSON.stringify(value, null, 2));
      }      for (const [nodeName, nodeOutput] of Object.entries(value)) {
        const output = nodeOutput as any;

        if (nodeName === 'initial_node' && !hasSentLoadingIndicator) {
          sendEvent({ action: "append", payload: { type: "LoadingIndicator", props: {} } });
          hasSentLoadingIndicator = true;
        }

        if (output?.messages?.[0]) {
          const message = output.messages[0];
          
          if (nodeName === "social_wager_node") {
            // Store the wager node message for later
            lastNodeMessage = message;
          } else if (nodeName === "initial_node") {
            // Only stream updates from initial node
            sendEvent({
              action: "update",
              payload: { type: "AIMessageText", props: { content: message } }
            });
            initialNodeComplete = true;
          }
        }

      

       
      }
    }    // Send the final wager node message if it exists
    if (lastNodeMessage && initialNodeComplete) {
      sendEvent({
        action: "append",
        payload: { type: "AIMessageText", props: { content: lastNodeMessage } }
      });
    }
    
    sendEvent({ type: "streamEnd" });

  } catch (error: any) {
    console.error('Error during LangGraph stream:', error);
    sendEvent({ type: "error", payload: { message: error.message || "An error occurred on the server." } });
    sendEvent({ type: "streamEnd" });
  } finally {
    res.end();
  }
});

app.listen(port, () => {
  console.warn(`Backend server listening at http://localhost:${port}`);
  console.warn(`Try: http://localhost:${port}/api/agent?input=hello&chat_history=[]`);
});

// Reminder: Create a file like \`backend/src/ai/graph.ts\` for your LangGraph logic.
// Example content for backend/src/ai/graph.ts:
/*
import { StateGraph, END } from "@langchain/langgraph";
import { RunnableLambda } from "@langchain/core/runnables";
import { BaseMessage } from "@langchain/core/messages";

interface AgentState { 
  input: string; 
  chat_history?: BaseMessage[]; 
  result?: string; 
  contractData?: string; 
}

export function nodegraph() {
  const graph = new StateGraph<AgentState>({
    channels: {
      input: { value: null },
      chat_history: { value: null },
      result: { value: null },
      contractData: { value: null },
    }
  });

  graph.addNode('initial_node', new RunnableLambda({ 
    func: async (state: AgentState) => ({ result: \`Actual Graph: Processing: \${state.input}\` })
  }));
  graph.addNode('escrow_node', new RunnableLambda({ 
    func: async (state: AgentState) => ({ contractData: \`// Actual Graph: Smart Contract for \${state.input}\` })
  }));
  
  graph.setEntryPoint('initial_node');
  graph.addEdge('initial_node', 'escrow_node');
  graph.addEdge('escrow_node', END);
  
  return graph.compile();
}
*/ 