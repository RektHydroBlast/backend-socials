import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import dotenv from 'dotenv';

dotenv.config();

// Define the state interface for our graph
interface AgentState {
  input: string;
  chat_history?: BaseMessage[];
  messages?: any[] | null;
  operation?: string;
  result?: string;
  isWager?: boolean;
}

// Initialize the LLM
// Initialize the LLM
const llm = new ChatGroq({ // Changed to ChatGroq
  model: "llama3-8b-8192", // Using a common Groq model
  temperature: 0.7,
  streaming: true,
  apiKey: process.env.GROQ_API_KEY, // Ensure GROQ_API_KEY is set in your environment
});

export function nodegraph() {

  // @ts-ignore - The StateGraph type definition is complex and not properly inferred
  const graph = new StateGraph({
    channels: {
      messages: { value: (x: any[], y: any[]) => x.concat(y) },
      input: { value: null },
      result: { value: null },
      chat_history: { value: null },
      operation: { value: null },
      isWager: { value: false },
    }
  });

  // Initial Routing Node 
  graph.addNode("initial_node", async (state: AgentState) => { 
    // Internal classification template - not shown to user
    const CLASSIFICATION_TEMPLATE = `You are an internal classifier for SocialSlice platform.\n\n` 
      + `Analyze the user request and respond ONLY with one of these options:\n` 
      + `- "social_wager_node" if the request involves creating a wager between exactly 2 participants on a verifiable event\n` 
      + `- "conversation" for any other request\n\n` 
      + `Respond with ONLY ONE WORD, either "social_wager_node" or "conversation". No explanation.`; 

    const classificationPrompt = ChatPromptTemplate.fromMessages([ 
      ["system", CLASSIFICATION_TEMPLATE], 
      new MessagesPlaceholder({ variableName: "chat_history", optional: true }), 
      ["human", "{input}"] 
    ]); 

    const classificationResponse = await classificationPrompt.pipe(llm).invoke({ 
      input: state.input, 
      chat_history: state.chat_history 
    }); 

    const classification = classificationResponse.content as string; 
    
    if (classification.includes("social_wager_node")) {
      // User-facing template for wager requests
      const WAGER_TEMPLATE = `You are an AI assistant for SocialSlice, a platform for trustless social wagers.\n\n` 
        + `Help the user create a wager between exactly 2 participants on a verifiable event.\n\n` 
        + `Ask for any missing information needed to create a complete wager:\n` 
        + `- Names of both participants\n` 
        + `- The specific verifiable event/outcome\n` 
        + `- Wager terms (amount, deadline, etc.)\n\n` 
        + `Keep responses conversational and helpful.`;

      const wagerPrompt = ChatPromptTemplate.fromMessages([ 
        ["system", WAGER_TEMPLATE], 
        new MessagesPlaceholder({ variableName: "chat_history", optional: true }), 
        ["human", "{input}"] 
      ]);

      const wagerResponse = await wagerPrompt.pipe(llm).invoke({ 
        input: state.input, 
        chat_history: state.chat_history 
      });

      return { 
        messages: [wagerResponse.content], 
        operation: "social_wager_node" 
      };
    } else {
      // User-facing template for conversational requests
      const CONVERSATIONAL_TEMPLATE = `You are an AI assistant for SocialSlice, a platform for trustless social wagers.\n\n` 
        + `Respond conversationally to the user's request. If their request is not related to creating a wager, politely explain that SocialSlice currently focuses on facilitating wagers between two participants on verifiable events.\n\n` 
        + `Suggest they try creating a wager by specifying two participants and a verifiable event.\n\n` 
        + `Keep responses helpful and concise.`;

      const conversationalPrompt = ChatPromptTemplate.fromMessages([
        ["system", CONVERSATIONAL_TEMPLATE],
        new MessagesPlaceholder({ variableName: "chat_history", optional: true }),
        ["human", "{input}"]
      ]);

      const conversationalResponse = await conversationalPrompt.pipe(llm).invoke({ 
        input: state.input, 
        chat_history: state.chat_history 
      });

      return { 
        result: conversationalResponse.content as string, 
        messages: [conversationalResponse.content] 
      }; 
    }
  });   // Social Wager Node 
  graph.addNode("social_wager_node", async (state: AgentState) => { 
    const WAGER_TEMPLATE = `Continue with your process and Information About Gas Fees:\n\n` 
      + `Note: Only First 2 daily transactions are gas-free (0.1 NERO limit)\n[/WAGER_NODE]`
      ; 

    return { 
      messages: [WAGER_TEMPLATE] 
    }; 
  });

  // Graph Flow Configuration 
  // @ts-ignore - Conditional edges are valid
  graph.addConditionalEdges("initial_node", (state) => 
    (state as AgentState).operation === "social_wager_node" ? "social_wager_node" : "end", {
    social_wager_node: "social_wager_node", 
    end: END 
  }); 
  // @ts-ignore - Conditional edges are valid
  graph.addEdge("social_wager_node", END);

  // @ts-ignore - START and END are valid node names
  graph.addEdge(START, "initial_node");
  // @ts-ignore - END is a valid node name
  graph.addEdge("social_wager_node", END);

  return graph.compile();
}