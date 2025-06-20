import { StateGraph, START, END } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";
import { ChatPromptTemplate, MessagesPlaceholder } from "@langchain/core/prompts";
import { ChatGroq } from "@langchain/groq";
import dotenv from 'dotenv';
import { 
  CLASSIFICATION_TEMPLATE,
  WAGER_CREATION_TEMPLATE, 
  INQUIRY_TEMPLATE,
  CONVERSATIONAL_TEMPLATE,
  EXTRACTION_TEMPLATE,
  formatTemplate,
  type ExtractionData
} from './templates';
import { 
  perplexitySearchTool, 
  timeCalculatorTool 
} from './tools';
import { 
  TESTNET_TOKEN_ADDRESSES, 
  TOKEN_METADATA, 
  DEFAULT_TOKEN, 
  DEFAULT_TOKEN_SYMBOL,
  getTestnetTokensList,
  NERO_CHAIN_INFO,
  ORACLE_PROVIDERS 
} from '../constants/tokens';

dotenv.config();

// Define the state interface for our graph
interface AgentState {
  input: string;
  chat_history?: BaseMessage[];
  messages: string[];
  operation?: string;
  currentStep?: string;
  playerA?: {
    name?: string;
    address?: string;
  };
  playerB?: {
    name?: string;
    address?: string;
  };
  userPrediction?: string;
  wagerDetails?: {
    description?: string;
    eventDate?: string;
    category?: string;
    bettingOptions?: any[];
    bettingDeadline?: string;
    venue?: string;
    timeUntilEvent?: string;
    wagerDuration?: string; // Time until the wager is open for acceptance
    wagerResolution?: string; // Time when the wager outcome is determined
  };
  asset?: {
    amount?: number;
    type?: string;
    totalPot?: number;
  };
  oracle?: {
    provider?: string;
    endpoint?: string;
    query?: string;
  };
  needsMoreInfo?: boolean;
  missingFields?: string[];
  wagerObject?: any;
}

// Create the LLM instances
const llm = new ChatGroq({
  model: "llama3-70b-8192",
  temperature: 0.3,
});

// Separate LLM for tool calls
const toolLLM = new ChatGroq({
  model: "llama-3.1-8b-instant",
  temperature: 0.1,
});

// Define the graph creation function with wallet address parameter
export function createWagerGraph(walletAddress?: string) {
  // Define graph configuration with proper channel annotations
  const graphConfig: any = {
    channels: {
      input: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      chat_history: { reducer: (x: any[], y: any[]) => y ?? x ?? [], default: () => [] },
      messages: { reducer: (x: any[], y: any[]) => (x ?? []).concat(y ?? []), default: () => [] },
      operation: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      currentStep: { reducer: (x: any, y: any) => y ?? x, default: () => "initial" },
      playerA: { 
        reducer: (x: any, y: any) => y ?? x, 
        default: () => walletAddress ? { address: walletAddress, name: "You" } : null 
      },      playerB: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      userPrediction: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      wagerDetails: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      asset: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      oracle: { reducer: (x: any, y: any) => y ?? x, default: () => null },
      missingFields: { reducer: (x: any[], y: any[]) => y ?? x ?? [], default: () => [] },
      needsMoreInfo: { reducer: (x: any, y: any) => y ?? x, default: () => false },
      wagerObject: { reducer: (x: any, y: any) => y ?? x, default: () => null },
    }
  };

  // Create the graph
  const graph = new StateGraph(graphConfig);

  // Initial Classification Node 
  graph.addNode("initial_node", async (state: AgentState) => { 
    const classificationPrompt = ChatPromptTemplate.fromMessages([ 
      ["system", CLASSIFICATION_TEMPLATE], 
      new MessagesPlaceholder({ variableName: "chat_history", optional: true }), 
      ["human", "{input}"] 
    ]); 

    const classificationResponse = await classificationPrompt.pipe(llm).invoke({ 
      input: state.input, 
      chat_history: state.chat_history 
    }); 

    const classification = (classificationResponse.content as string).toLowerCase().trim(); 
      if (classification.includes("wager_creation")) {
      // Skip AI response - go directly to extraction
      return { 
        operation: "wager_creation",
        currentStep: "info_extraction",
        messages: [] // No initial message - let extraction node handle it
      };
    } else if (classification.includes("wager_inquiry")) {
      // Use AI to generate dynamic educational response
      const inquiryPrompt = ChatPromptTemplate.fromMessages([
        ["system", INQUIRY_TEMPLATE],
        new MessagesPlaceholder({ variableName: "chat_history", optional: true }),
        ["human", "{input}"]
      ]);

      const inquiryResponse = await inquiryPrompt.pipe(llm).invoke({
        input: state.input,
        wallet_address: state.playerA?.address || "Connected",
        chat_history: state.chat_history
      });

      return { 
        operation: "educational",
        messages: [inquiryResponse.content as string],
        currentStep: "awaiting_wager_details"
      };
    } else {
      // Use AI to generate dynamic conversational response
      const conversationalPrompt = ChatPromptTemplate.fromMessages([
        ["system", CONVERSATIONAL_TEMPLATE],
        new MessagesPlaceholder({ variableName: "chat_history", optional: true }),
        ["human", "{input}"]
      ]);

      const conversationalResponse = await conversationalPrompt.pipe(llm).invoke({
        input: state.input,
        wallet_address: state.playerA?.address || "Connected",
        chat_history: state.chat_history
      });

      return { 
        operation: "conversational",
        messages: [conversationalResponse.content as string],
        currentStep: "conversational"
      }; 
    }
  });

  // Wager Information Extraction Node
  graph.addNode("wager_info_extraction_node", async (state: AgentState) => {
    // Enhanced extraction logic with persistent state
    const extractedData = {
      playerA: state.playerA?.name || null,
      playerB: state.playerB?.name || null,
      eventDescription: state.wagerDetails?.description || null,
      eventTimeframe: state.wagerDetails?.eventDate || null,
      amount: state.asset?.amount || null,
      assetType: state.asset?.type || "USDC"
    };

    const input = state.input.toLowerCase();
      // Extract player names with better patterns
    if (!extractedData.playerB) {
      // Pattern 1: "Alex and Bob", "me and Sarah", "John and I"
      const andPattern = /(?:^|[^a-z])([a-z]+)\s+and\s+([a-z]+)(?:[^a-z]|$)/i;
      const andMatch = state.input.match(andPattern);
      if (andMatch) {
        // Since wallet is connected, determine which is playerB
        if (andMatch[1].toLowerCase() !== "you" && andMatch[1].toLowerCase() !== "i") {
          extractedData.playerB = extractedData.playerB || andMatch[1];
        }
        if (andMatch[2].toLowerCase() !== "you" && andMatch[2].toLowerCase() !== "i") {
          extractedData.playerB = extractedData.playerB || andMatch[2];
        }
      }

      // Pattern 2: "with Alex", "bet with Bob"
      const withPattern = /(?:with|against)\s+([a-z]+)/i;
      const withMatch = state.input.match(withPattern);
      if (withMatch && !['india', 'england', 'lakers', 'warriors', 'tomorrow', 'today', 'tonight'].includes(withMatch[1].toLowerCase())) {
        extractedData.playerB = withMatch[1];
      }
    }// Extract events with comprehensive patterns
    if (!extractedData.eventDescription) {
      const eventPatterns = [
        // Team vs Team patterns (most specific first)
        /([a-z]+)\s+vs\s+([a-z]+)/gi,
        /([a-z]+)\s+v\s+([a-z]+)/gi,
        /([a-z]+)\s+versus\s+([a-z]+)/gi,
        /([a-z]+)\s+against\s+([a-z]+)/gi,
        // Sport types
        /(ipl|cricket|soccer|football|basketball|tennis|baseball|hockey)\s*(?:match|game|final|championship)?/gi,
        /(election|vote|politics|president|election\s+results?)/gi,
        /(lakers?|warriors?|chiefs?|cowboys?|yankees?|dodgers?)\s*(?:vs?\.?\s*)?(?:game|match)?/gi,
        // Generic event words
        /(?:match|game|event|championship|final|tournament)/gi
      ];

      for (const pattern of eventPatterns) {
        const match = state.input.match(pattern);
        if (match) {
          extractedData.eventDescription = match[0];
          break;
        }
      }
    }    // Extract timeframe with better patterns
    if (!extractedData.eventTimeframe) {
      const timePatterns = [
        /(tomorrow|today|tonight)/gi,
        /(this\s+(?:weekend|week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday))/gi,
        /(next\s+(?:week|month|sunday|monday|tuesday|wednesday|thursday|friday|saturday))/gi,
        /(january|february|march|april|may|june|july|august|september|october|november|december)\s*\d+/gi,
        /(\d{1,2}\/\d{1,2}\/?\d{0,4})/gi,
        /(in\s+\d+\s+(?:days?|weeks?|months?))/gi
      ];

      for (const pattern of timePatterns) {
        const match = state.input.match(pattern);
        if (match) {
          extractedData.eventTimeframe = match[0];
          break;
        }
      }
      
      // If we have a specific event (like "India vs England") but no timeframe,
      // assume it's a near-future event for basic wager creation
      if (!extractedData.eventTimeframe && extractedData.eventDescription) {
        const hasSpecificEvent = /\w+\s+vs?\s+\w+/i.test(state.input) || 
                                /cricket|football|basketball|soccer|tennis|baseball|hockey/i.test(state.input);
        if (hasSpecificEvent) {
          extractedData.eventTimeframe = "upcoming"; // Generic placeholder for validation
        }
      }
    }// Extract amounts and tokens with better patterns
    if (!extractedData.amount) {
      const amountPatterns = [
        /(\d+(?:\.\d{2})?)\s*(usdt|dai|usdc|exusdt|slice)/gi,
        /\$(\d+(?:\.\d{2})?)/gi,
        /(\d+)\s*(?:dollars?|bucks?|usd)/gi,
        /(\d+)\s*each/gi,
        /(\d+)\s*per\s*(?:person|player)/gi
      ];

      for (const pattern of amountPatterns) {
        const match = state.input.match(pattern);
        if (match) {
          const numStr = match[1] || match[0].replace(/[\$a-z\s]/gi, '');
          extractedData.amount = parseFloat(numStr);
          
          // Extract token if mentioned
          if (match[2]) {
            extractedData.assetType = match[2].toUpperCase();
          }
          break;
        }
      }
    }

    // Extract token selection separately
    if (!extractedData.assetType || extractedData.assetType === "USDC") {
      const tokenPatterns = [
        /(usdt|tether)/gi,
        /(dai|stablecoin)/gi,
        /(usdc|usd\s*coin)/gi,
        /(exusdt|example\s*usdt)/gi,
        /(slice|socialslice)/gi
      ];

      for (const pattern of tokenPatterns) {
        const match = state.input.match(pattern);
        if (match) {
          const token = match[0].toLowerCase();
          if (token.includes('usdt') && !token.includes('ex')) extractedData.assetType = "USDT";
          else if (token.includes('dai')) extractedData.assetType = "DAI";
          else if (token.includes('usdc')) extractedData.assetType = "USDC";
          else if (token.includes('exusdt') || token.includes('example')) extractedData.assetType = "exUSDT";
          else if (token.includes('slice')) extractedData.assetType = "SLICE";
          break;
        }
      }
    }    // Extract user's prediction/choice if mentioned - enhanced patterns
    let userPrediction = state.userPrediction; // Keep existing prediction
    
    if (!userPrediction) {
      const predictionPatterns = [
        // Team names
        /(lakers|warriors|celtics|heat|nuggets|suns|bucks|nets|clippers|mavs|mavericks|chiefs|cowboys|yankees|dodgers)/i,
        // "I bet/think X wins"
        /(?:i\s+(?:bet|think|believe)\s+)?(\w+)\s+(?:wins?|will\s+win|to\s+win)/i,
        // "betting on X"
        /bet(?:ting)?\s+on\s+(\w+)/i,
        // "X will win"
        /(\w+)\s+will\s+win/i,
        // "going with X"
        /going\s+with\s+(\w+)/i,
        // "my pick is X"
        /(?:my\s+)?pick\s+(?:is\s+)?(\w+)/i,
        // "I choose X"
        /i\s+choose\s+(\w+)/i
      ];

      for (const pattern of predictionPatterns) {
        const match = input.match(pattern);
        if (match && match[1]) {
          userPrediction = match[1];
          break;
        }
      }
    }

    // Determine what's still missing (playerA is always available via wallet)
    const missingFields = [];
    if (!extractedData.playerB) missingFields.push("participants");
    if (!extractedData.eventDescription) missingFields.push("event");
    if (!extractedData.eventTimeframe) missingFields.push("timeframe");
    if (!extractedData.amount) missingFields.push("amount");
    if (!userPrediction) missingFields.push("prediction");

    // Update extracted info in state first
    const newState: Partial<AgentState> = {
      currentStep: "info_extraction",
      needsMoreInfo: missingFields.length > 0,
      missingFields: missingFields
    };

    if (extractedData.playerB) {
      newState.playerB = { name: extractedData.playerB };
    }

    if (extractedData.eventDescription || extractedData.eventTimeframe) {
      newState.wagerDetails = {
        ...state.wagerDetails,
        description: extractedData.eventDescription ?? state.wagerDetails?.description,
        eventDate: extractedData.eventTimeframe ?? state.wagerDetails?.eventDate,
        category: "sports"
      };
    }    if (extractedData.amount) {
      newState.asset = {
        amount: extractedData.amount,
        type: extractedData.assetType,
        totalPot: extractedData.amount * 2
      };
    }

    if (userPrediction) {
      newState.userPrediction = userPrediction;    }    // If all information is complete, skip AI response and go straight to event extraction
    if (missingFields.length === 0) {
      console.log("ALL WAGER FIELDS COMPLETE - BYPASSING AI RESPONSE");
      return {
        ...state,
        ...newState,
        operation: "event_details_extraction",
        currentStep: "event_extraction",
        messages: [], // NO MESSAGES - PROCEED DIRECTLY TO OBJECT GENERATION
        needsMoreInfo: false
      };
    }

    console.log("MISSING FIELDS:", missingFields, "- ASKING USER FOR MORE INFO");

    // Only if fields are missing, generate AI response to ask for them
    const templateData: ExtractionData = {
      input: state.input,
      wallet_address: state.playerA?.address || "Connected",
      playerA_name: state.playerA?.name || "You",
      playerB_name: extractedData.playerB || "Missing",
      event_description: extractedData.eventDescription || "Missing",
      event_timeframe: extractedData.eventTimeframe || "Missing",
      amount_info: extractedData.amount ? `${extractedData.amount}` : "Missing",
      selected_token: extractedData.assetType || "Missing",
      user_prediction: userPrediction || state.userPrediction || "Missing",
      missing_fields: missingFields.join(', ')
    };

    const formattedTemplate = formatTemplate(EXTRACTION_TEMPLATE, templateData as Record<string, string>);

    const extractionPrompt = ChatPromptTemplate.fromMessages([
      ["system", formattedTemplate],
      new MessagesPlaceholder({ variableName: "chat_history", optional: true }),
      ["human", "{input}"]
    ]);    const extractionResponse = await extractionPrompt.pipe(llm).invoke({
      input: state.input,
      chat_history: state.chat_history
    });

    // Return complete state with the AI response message
    return {
      ...state,
      ...newState,
      messages: [extractionResponse.content as string],
      operation: "END", // Stop flow when asking questions
      currentStep: "awaiting_user_response",
      needsMoreInfo: true
    };
  });  // Event Details Extraction Node - Must get complete event information through tool calls
  graph.addNode("event_details_extraction_node", async (state: AgentState) => {
    console.log("ENTERING EVENT EXTRACTION NODE");
    
    // For simple sports bets with basic info, skip tool calls and go straight to validation
    if (state.wagerDetails?.description && 
        state.wagerDetails?.eventDate && 
        state.userPrediction && 
        state.playerB?.name && 
        state.asset?.amount) {
      console.log("ALL BASIC WAGER INFO COMPLETE - PROCEEDING DIRECTLY TO VALIDATION");
      return {
        ...state,
        currentStep: "validation_ready",
        operation: "validation_ready",
        messages: [] // Clear messages array - NO AI RESPONSES
      };
    }
    
    const llmWithTools = toolLLM.bindTools([perplexitySearchTool, timeCalculatorTool]);
    
    const currentDetails = JSON.stringify({
      playerA: state.playerA?.name || "Connected wallet user",
      playerB: state.playerB?.name || "Not specified",
      event: state.wagerDetails?.description || "Not specified",
      timeframe: state.wagerDetails?.eventDate || "Not specified",
      amount: state.asset?.amount || "Not specified"
    });

    const SEARCH_TEMPLATE = `You are SocialSlice AI. Your task is to gather complete and accurate event details for a wager using your tools.

User query: "{input}"
Current wager details: {current_details}

MANDATORY: You must use your tools to answer.
1. Use 'perplexity_search' for event details (name, venue, date).
2. Use 'time_calculator' for precise timing (deadlines, etc.).

If the user is asking about an event, you MUST call tools. Do not answer from memory. If you don't call tools, the user will be asked to provide more information.`;

    const searchPrompt = ChatPromptTemplate.fromMessages([
      ["system", SEARCH_TEMPLATE],
      new MessagesPlaceholder({ variableName: "chat_history", optional: true }),
      ["human", "{input}"]
    ]);

    try {
      const toolCallResponse = await searchPrompt.pipe(llmWithTools).invoke({
        input: state.input,
        chat_history: state.chat_history,
        current_details: currentDetails
      });

      let toolOutput = [];
      if (toolCallResponse.tool_calls && toolCallResponse.tool_calls.length > 0) {
        for (const toolCall of toolCallResponse.tool_calls) {
          try {
            let toolResult;
            if (toolCall.name === "perplexity_search") {
              toolResult = await perplexitySearchTool.call(JSON.stringify(toolCall.args));
            } else if (toolCall.name === "time_calculator") {
              toolResult = await timeCalculatorTool.call(JSON.stringify(toolCall.args));
            } else {
              continue;
            }
            toolOutput.push({ tool_call_id: toolCall.id, name: toolCall.name, output: toolResult });
          } catch (toolError: any) {
            console.error(`Error executing tool ${toolCall.name}:`, toolError);
            toolOutput.push({ tool_call_id: toolCall.id, name: toolCall.name, output: `Error: ${toolError.message}` });
          }
        }
      } else {
        // Fallback if LLM doesn't use tools
        return {
          ...state,
          messages: ["I need more specific information to find the event details. Could you please provide more context, like the teams involved or the date?"],
          currentStep: "awaiting_user_response",
          operation: "END"
        };
      }

      // Process tool outputs
      const eventSearchOutput = toolOutput.find(o => o.name === 'perplexity_search')?.output;
      const timeSearchOutput = toolOutput.find(o => o.name === 'time_calculator')?.output;

      let eventDetails = null;
      let timeDetails = null;

      if (eventSearchOutput) {
        try { eventDetails = JSON.parse(eventSearchOutput); } catch (e) { console.error("Error parsing event details:", e); }
      }
      if (timeSearchOutput) {
        try { timeDetails = JSON.parse(timeSearchOutput); } catch (e) { console.error("Error parsing time details:", e); }
      }

      // Update wager details with extracted information
      const updatedWagerDetails = { ...state.wagerDetails };
      
      if (eventDetails?.success && eventDetails.results) {
        updatedWagerDetails.description = eventDetails.results.event_name || eventDetails.results;
        updatedWagerDetails.category = eventDetails.category || "sports";
        updatedWagerDetails.venue = eventDetails.results.venue;
        updatedWagerDetails.bettingOptions = eventDetails.results.betting_options;
      }

      if (timeDetails?.success) {
        updatedWagerDetails.eventDate = timeDetails.event_datetime;
        updatedWagerDetails.bettingDeadline = timeDetails.betting_deadline;
        updatedWagerDetails.timeUntilEvent = timeDetails.time_until_event;
        const eventDateTime = new Date(timeDetails.event_datetime);
        updatedWagerDetails.wagerDuration = eventDateTime.toISOString();
        const resolutionTime = new Date(eventDateTime.getTime() + 5 * 60 * 60 * 1000);
        updatedWagerDetails.wagerResolution = resolutionTime.toISOString();
      }      const hasCompleteDetails = updatedWagerDetails.eventDate && 
                                  updatedWagerDetails.description && 
                                  state.userPrediction; // Ensure prediction is also present

      console.log("Checking complete details:", {
        eventDate: !!updatedWagerDetails.eventDate,
        description: !!updatedWagerDetails.description,
        userPrediction: !!state.userPrediction,
        hasCompleteDetails
      });

      if (hasCompleteDetails) {
        console.log("Moving to validation node");
        return {
          ...state,
          wagerDetails: updatedWagerDetails,
          currentStep: "validation_ready",
          operation: "validation_ready"
        };
      } else {
        let missingMessage = "I couldn't find all the event details.";
        if (!state.userPrediction) {
          missingMessage += " Also, please tell me your prediction or which side you're betting on.";
        }
        return {
          ...state,
          wagerDetails: updatedWagerDetails,
          messages: [missingMessage + " Please provide more specific information."],
          currentStep: "awaiting_user_response",
          operation: "END"
        };
      }

    } catch (error) {
      console.error("Error in event details extraction:", error);
      return {
        ...state,
        messages: ["Failed to extract event details. Please try again."],
        currentStep: "info_extraction",
        operation: "wager_creation"
      };
    }
  });  // Wager Validation Node - ONLY outputs structured object
  graph.addNode("wager_validation_node", async (state: AgentState) => {
    console.log("ENTERING VALIDATION NODE - Creating final wager object");
    
    // Generate oracle query for the event
    const generateOracleQuery = (eventDesc: string, eventDate: string) => {
      if (eventDesc.toLowerCase().includes('ipl') || eventDesc.toLowerCase().includes('cricket')) {
        return `What was the result of the IPL cricket match on ${eventDate}? Who won?`;
      } else if (eventDesc.toLowerCase().includes('election')) {
        return `What was the result of the ${eventDesc} on ${eventDate}? Who won?`;
      } else if (eventDesc.toLowerCase().includes('lakers') || eventDesc.toLowerCase().includes('warriors') || eventDesc.toLowerCase().includes('basketball')) {
        return `What was the result of the ${eventDesc} basketball game on ${eventDate}? Which team won?`;
      } else {
        return `What was the result of ${eventDesc} on ${eventDate}? What was the outcome?`;
      }
    };

    // Token details
    const selectedToken = state.asset?.type || DEFAULT_TOKEN_SYMBOL;
    const tokenAddress = TESTNET_TOKEN_ADDRESSES[selectedToken as keyof typeof TESTNET_TOKEN_ADDRESSES];
    const tokenMetadata = TOKEN_METADATA[tokenAddress];

    // Generate wager ID
    const wagerID = `wager_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Generate oracle query
    const oracleQuery = generateOracleQuery(
      state.wagerDetails?.description || "",
      state.wagerDetails?.eventDate || ""
    );    // Create final wager object for frontend
    const wagerObject = {
      id: wagerID,
      participants: {
        playerA: {
          name: state.playerA?.name || "You",
          address: state.playerA?.address,
          prediction: state.userPrediction || "Not specified",
          isInitiator: true,
          isDeposited: false
        },
        playerB: {
          name: state.playerB?.name,
          address: null, // Will be set when player B joins
          prediction: null, // Will be set when player B joins
          isInitiator: false,
          isDeposited: false
        }
      },
      wagerDetails: {
        description: state.wagerDetails?.description,
        eventDate: state.wagerDetails?.eventDate,
        category: state.wagerDetails?.category || "sports",
        venue: state.wagerDetails?.venue,
        bettingOptions: state.wagerDetails?.bettingOptions,
        bettingDeadline: state.wagerDetails?.bettingDeadline,
        timeUntilEvent: state.wagerDetails?.timeUntilEvent,
        wagerDuration: state.wagerDetails?.wagerDuration,
        wagerResolution: state.wagerDetails?.wagerResolution,
        createdAt: new Date().toISOString()
      },
      asset: {
        tokenAddress: tokenAddress,
        tokenSymbol: selectedToken,
        tokenDecimals: tokenMetadata?.decimals || 18,
        amount: state.asset?.amount,
        totalPot: state.asset?.totalPot,
        amountPerPlayer: state.asset?.amount
      },
      oracle: {
        provider: "Perplexity",
        endpoint: "https://api.perplexity.ai/chat/completions",
        query: oracleQuery,
        resolvedResult: null,
        isResolved: false
      },
      blockchain: {
        chain: "NERO",
        chainId: "nero-testnet",
        features: {
          accountAbstraction: true,
          gaslessTransactions: true,
          paymasterEnabled: true
        }
      },
      status: "created",
      contractAddress: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
    };
      // ONLY return the structured object - no AI-generated text
    const finalOutput = `[OBJ]${JSON.stringify(wagerObject)}[/OBJ]`;

    console.log("VALIDATION NODE: Final output:", finalOutput);

    return {
      input: state.input,
      chat_history: state.chat_history,
      messages: [finalOutput], // Replace entire array with just the OBJ message
      operation: "completed",
      currentStep: "completed",
      playerA: state.playerA,
      playerB: state.playerB,
      userPrediction: state.userPrediction,
      wagerDetails: state.wagerDetails,
      asset: state.asset,
      oracle: state.oracle,
      needsMoreInfo: false,
      missingFields: [],
      wagerObject: wagerObject
    };
  });

  // Define edges
  //@ts-ignore
  graph.addEdge(START, "initial_node");
  //@ts-ignore
  graph.addConditionalEdges(
    //@ts-ignore
    "initial_node",
    (state: AgentState) => {
      if (state.operation === "wager_creation") {
        return "wager_info_extraction_node";
      } else {
        return END;
      }
    }
  );  graph.addConditionalEdges(
    //@ts-ignore
    "wager_info_extraction_node",
    (state: AgentState) => {
      console.log("Routing from extraction node - operation:", state.operation);
      if (state.operation === "event_details_extraction") {
        return "event_details_extraction_node"; // First extract complete event details
      } else {
        return END;
      }
    }
  );
    //@ts-ignore
  graph.addConditionalEdges(
    //@ts-ignore
    "event_details_extraction_node",
    (state: AgentState) => {
      console.log("Routing from event extraction node - operation:", state.operation);
      if (state.operation === "validation_ready") {
        return "wager_validation_node";
      } else {
        // This will happen if we need more info from the user or an error occurred.
        return END;
      }
    }
  );
  //@ts-ignore
  graph.addEdge("wager_validation_node", END);

  return graph.compile();
}
