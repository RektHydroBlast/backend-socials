import { Tool } from "@langchain/core/tools";
import dotenv from 'dotenv';
dotenv.config();

/**
 * Tool to interact with Perplexity API for search and chat completions
 */
export class PerplexitySearchTool extends Tool {
  name = "perplexity_search";
  description = "Search for sports events, match details, and betting information using Perplexity API";

  constructor() {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const parsed = JSON.parse(input);
      const { query, category = "sports" } = parsed;

      console.log("Perplexity search tool called with:", { query, category });

      const enhancedQuery = `Today is ${new Date().toLocaleDateString()}. ${query}`;

      const options = {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.PERPLEXITY_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          search_mode: "web",
          reasoning_effort: "medium",
          temperature: 0.2,
          top_p: 0.9,
          return_images: false,
          return_related_questions: false,
          top_k: 0,
          stream: false,
          presence_penalty: 0,
          frequency_penalty: 0,
          web_search_options: {
            search_context_size: "low"
          },
          model: "sonar",
          messages: [
            { role: "system", content: "You are an AI assistant that helps find information about upcoming events. Be precise and concise." },
            { role: "user", content: enhancedQuery }
          ]
        })
      };

      const response = await fetch('https://api.perplexity.ai/chat/completions', options);

      if (!response.ok) {
        throw new Error(`API call failed with status ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Extract the relevant information from the response
      const assistantResponse = data.choices[0].message.content;

      return JSON.stringify({
        success: true,
        query,
        category,
        results: assistantResponse, // Return the text response from the assistant
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error("Error in Perplexity search tool:", error);
      return JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
        query: input
      });
    }
  }
}

/**
 * Tool to get current time and calculate time until event
 */
export class TimeCalculatorTool extends Tool {
  name = "time_calculator";
  description = "Calculate time until event and determine betting deadlines";

  constructor() {
    super();
  }

  async _call(input: string): Promise<string> {
    try {
      const parsed = JSON.parse(input);
      const { event_date, event_time } = parsed;
      
      const now = new Date();
      const eventDateTime = this.parseEventDateTime(event_date, event_time);
      
      const timeUntilEvent = eventDateTime.getTime() - now.getTime();
      const hoursUntil = Math.floor(timeUntilEvent / (1000 * 60 * 60));
      const daysUntil = Math.floor(hoursUntil / 24);
      
      // Calculate betting deadline (e.g., 2 hours before event)
      const bettingDeadline = new Date(eventDateTime.getTime() - (2 * 60 * 60 * 1000));
      
      return JSON.stringify({
        success: true,
        current_time: now.toISOString(),
        event_datetime: eventDateTime.toISOString(),
        time_until_event: {
          total_hours: hoursUntil,
          days: daysUntil,
          hours: hoursUntil % 24,
          human_readable: this.formatTimeUntil(hoursUntil)
        },
        betting_deadline: bettingDeadline.toISOString(),
        is_betting_open: now < bettingDeadline
      });
    } catch (error) {
      console.error("Error in time calculation:", error);
      return JSON.stringify({
        success: false,
        error: (error as { message?: string }).message || "Unknown error",
        input
      });
    }
  }

  private parseEventDateTime(dateStr: string, timeStr?: string): Date {
    const now = new Date();
    
    // Handle relative dates
    if (dateStr.toLowerCase() === 'tomorrow') {
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':');
        tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        tomorrow.setHours(19, 30, 0, 0); // Default to 7:30 PM
      }
      return tomorrow;
    }
    
    if (dateStr.toLowerCase() === 'today') {
      const today = new Date(now);
      if (timeStr) {
        const [hours, minutes] = timeStr.split(':');
        today.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      } else {
        today.setHours(19, 30, 0, 0);
      }
      return today;
    }
    
    // Try to parse as ISO date or standard format
    return new Date(dateStr + (timeStr ? ` ${timeStr}` : ' 19:30'));
  }

  private formatTimeUntil(hours: number): string {
    if (hours < 0) return "Event has passed";
    if (hours < 24) return `${hours} hours`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} days${remainingHours > 0 ? ` and ${remainingHours} hours` : ''}`;
  }
}

export const perplexitySearchTool = new PerplexitySearchTool();
export const timeCalculatorTool = new TimeCalculatorTool();
