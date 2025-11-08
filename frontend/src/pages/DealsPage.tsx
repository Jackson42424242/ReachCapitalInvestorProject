import React, { useState, useRef, useEffect } from 'react';
import { LLMService } from '../services/llm';
import '../styles/DealsPage.css';

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export const DealsPage: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isProcessing) return;

        const userMessage: Message = {
            role: 'user',
            content: inputMessage
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsProcessing(true);

        try {
            const updatedMessages = [...messages, userMessage];
            const response = await LLMService.processDealSetup(updatedMessages);

            const assistantMessage: Message = {
                role: 'assistant',
                content: response.message
            };

            setMessages(prev => [...prev, assistantMessage]);

            if (response.suggestedDeal) {
                // Handle suggested deal presentation
                const dealSummary: Message = {
                    role: 'assistant',
                    content: `Suggested Deal Summary:
                        \nType: ${response.suggestedDeal.type}
                        \nAmount: $${response.suggestedDeal.amount.toLocaleString()}
                        \nTerms: ${response.suggestedDeal.terms}
                        \nProbability: ${response.suggestedDeal.probability}%`
                };
                setMessages(prev => [...prev, dealSummary]);
            }
        } catch (error) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error while processing your request. Please try again.'
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="deals-page">
            <div className="chat-container">
                <div className="chat-messages">
                    {messages.map((message, index) => (
                        <div key={index} className={`message ${message.role}`}>
                            <div className="message-content">
                                {message.content}
                            </div>
                        </div>
                    ))}
                    {isProcessing && (
                        <div className="message assistant">
                            <div className="message-content">
                                <div className="typing-indicator">
                                    <span></span>
                                    <span></span>
                                    <span></span>
                                </div>
                            </div>
                        </div>
                    )}
                    <div ref={chatEndRef} />
                </div>
                <div className="chat-input">
                    <textarea
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        placeholder="Describe the deal you're looking for..."
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                    />
                    <button 
                        onClick={handleSendMessage}
                        disabled={isProcessing || !inputMessage.trim()}
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
};
