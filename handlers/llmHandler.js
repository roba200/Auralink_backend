/**
 * LLM Handler Module
 * 
 * Manages interactions with OpenAI's API to:
 * - Generate literature-style motivational quotes based on sensor data
 * - Process and analyze information
 */

import { OpenAI } from 'openai';
import logger from '../utils/logger.js';

class LlmHandler {
  constructor(apiKey) {
    this.openai = new OpenAI({
      apiKey: apiKey,
    });
  }

  /**
   * Generate a literature-style motivational quote based on indoor conditions
   * @param {object} sensorData - Object containing temperature and humidity
   * @returns {Promise<string>} A generated quote
   */
  async generateQuote(sensorData) {
    try {
      // Determine environmental conditions from sensor data
      const { temperature, humidity } = sensorData;
      let condition = 'neutral';
      
      if (temperature > 28) condition = 'hot';
      else if (temperature < 16) condition = 'cold';
      else if (temperature >= 22 && temperature <= 25 && humidity >= 40 && humidity <= 60) condition = 'ideal';
      
      if (humidity > 65) condition += ' and humid';
      else if (humidity < 30) condition += ' and dry';
      
      // Create a prompt for the OpenAI API
      const prompt = `Generate a short, poetic, literature-style motivational quote (maximum 120 characters) 
      about being in a ${condition} indoor environment with temperature ${temperature}°C and 
      humidity ${humidity}%. The quote should be uplifting and suitable for display on a smart home device.`;

      logger.debug('Sending prompt to OpenAI:', prompt);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: "You are a poetic assistant that creates short literary quotes about indoor environments."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 60
      });

      const quote = response.choices[0].message.content.trim();
      logger.info(`Generated quote: "${quote}"`);
      return quote;
      
    } catch (error) {
      logger.error('Error generating quote:', error);
      // Return a fallback quote in case of API failure
      return "The present moment is a gift, regardless of the weather outside or in.";
    }
  }

  /**
   * Summarize email content using the LLM
   * @param {Array} emails - Array of email objects with subject and body
   * @returns {Promise<string>} A concise summary
   */
  async summarizeEmails(emails) {
    if (!emails || emails.length === 0) {
      return "No new emails to summarize.";
    }
    
    try {
      // Construct a prompt with email data
      let emailText = emails.map((email, index) => {
        return `Email ${index + 1}: Subject: ${email.subject}\nExcerpt: ${email.snippet}`;
      }).join('\n\n');
      
      const prompt = `Summarize these ${emails.length} unread emails very concisely in 120 characters or less, 
      highlighting only the most important information that needs attention:\n\n${emailText}`;
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: "You are a concise assistant that summarizes email content into minimal text for small displays."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 60
      });

      const summary = response.choices[0].message.content.trim();
      logger.info(`Generated email summary (${summary.length} chars)`);
      return summary;
      
    } catch (error) {
      logger.error('Error summarizing emails:', error);
      return `${emails.length} new email(s). Unable to summarize.`;
    }
  }

  /**
   * Determine priority level based on sensor data and emails
   * @param {object} sensorData - The current sensor readings
   * @param {Array} emails - Array of email objects
   * @returns {Promise<string>} Priority level (normal/warning/urgent)
   */
  async determinePriority(sensorData, emails) {
    try {
      // Extract important keywords from emails
      let emailContent = emails.map(email => `Subject: ${email.subject}\nExcerpt: ${email.snippet}`).join('\n\n');
      
      // Create a prompt for priority determination
      const prompt = `Given these sensor readings and emails, determine if the overall situation is "normal", "warning", or "urgent".
      
      Temperature: ${sensorData.temperature}°C
      Humidity: ${sensorData.humidity}%
      
      Email information:
      ${emailContent}
      
      Rules:
      - "normal": No urgent emails and comfortable environment (18-26°C, 30-65% humidity)
      - "warning": Potentially important emails OR environment outside comfort zone
      - "urgent": Critical emails OR extreme environmental conditions (<10°C, >35°C, <20% or >85% humidity)
      
      Return just one word: normal, warning, or urgent`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
          {
            role: "system", 
            content: "You analyze data and determine priority levels without explanation."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 10
      });

      const priority = response.choices[0].message.content.trim().toLowerCase();
      
      // Validate the response is one of the expected values
      const validResponses = ['normal', 'warning', 'urgent'];
      if (!validResponses.includes(priority)) {
        return 'normal'; // Default to normal if invalid response
      }
      
      logger.info(`Determined priority: ${priority}`);
      return priority;
      
    } catch (error) {
      logger.error('Error determining priority:', error);
      return 'normal'; // Default to normal in case of errors
    }
  }
}

export default LlmHandler;