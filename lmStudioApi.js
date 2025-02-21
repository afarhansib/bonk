import axios from 'axios';

const LM_STUDIO_API_URL = 'http://localhost:1234/v1/chat/completions';

/**
 * Sends a message to the LM Studio API and returns the AI-generated response.
 * @param {string} message - The user's input message.
 * @returns {Promise<string>} - The AI-generated response.
 */
export async function sendToLmStudio(message) {
    try {
        const fullPrompt = `
            You are a bot named Sayaafk in a Minecraft Bedrock server.
            The server name is Laughtale.
            You are created by a human named yotbu.
            Your responses should be fun, conversational, and not too formal. 
            Include some personality and avoid sounding robotic, but don't use special characters/emojis.
            Question: ${message}
            Answer directly and keep it concise:
        `.trim();

        const response = await axios.post(LM_STUDIO_API_URL, {
            messages: [{ role: 'user', content: fullPrompt }], // Add instruction for direct answers
            max_tokens: 50, // Limit the response length
            temperature: 0.7 // Make the output more deterministic
        });
        let reply = response.data.choices[0].message.content.trim();

        // Post-process to remove "thinking" or intermediate steps
        if (reply.includes('<think>')) {
            reply = reply.split('<think>')[1]?.split('</think>')?.pop()?.trim() || reply;
        }

        console.log(reply)
        return reply.split('\n')[0]; // Ensure only the first line is returned
    } catch (error) {
        console.error('Error communicating with LM Studio API:', error.message);
        return 'Sorry, I encountered an error while processing your request.';
    }
}