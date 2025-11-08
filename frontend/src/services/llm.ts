import axios from 'axios';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

interface DealSetupResponse {
    message: string;
    suggestedDeal?: {
        type: string;
        amount: number;
        terms: string;
        probability: number;
    };
}

export const LLMService = {
    async processDealSetup(messages: Message[]): Promise<DealSetupResponse> {
        try {
            const response = await axios.post('/api/llm/deals', { messages });
            return response.data;
        } catch (error) {
            console.error('Error processing deal setup:', error);
            throw new Error('Failed to process deal setup');
        }
    }
};