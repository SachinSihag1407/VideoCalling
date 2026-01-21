import React, { useState, useEffect, useRef } from 'react';
import { Send, MessageCircle, X } from 'lucide-react';
import { ChatMessage } from '../types/chat';

interface ChatPanelProps {
    messages: ChatMessage[];
    currentUserId: string;
    onSendMessage: (message: string) => void;
    isOpen: boolean;
    onToggle: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
    messages,
    currentUserId,
    onSendMessage,
    isOpen,
    onToggle,
}) => {
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (newMessage.trim()) {
            onSendMessage(newMessage.trim());
            setNewMessage('');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const unreadCount = messages.filter(msg => msg.sender_id !== currentUserId && !msg.error).length;

    if (!isOpen) {
        return (
            <button
                onClick={onToggle}
                className="fixed bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-full shadow-lg hover:bg-indigo-700 transition-all z-50 flex items-center justify-center"
                title="Open Chat"
            >
                <MessageCircle className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
                        {unreadCount}
                    </span>
                )}
            </button>
        );
    }

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col z-50 max-h-[600px]">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-indigo-50 rounded-t-2xl">
                <div className="flex items-center space-x-2">
                    <MessageCircle className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-semibold text-gray-900">Chat</h3>
                    <span className="text-xs text-gray-500">({messages.length})</span>
                </div>
                <button
                    onClick={onToggle}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[400px] max-h-[450px]">
                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <MessageCircle className="w-12 h-12 mb-2 opacity-50" />
                        <p className="text-sm">No messages yet</p>
                        <p className="text-xs">Start the conversation!</p>
                    </div>
                ) : (
                    messages.map((msg, index) => {
                        const isOwnMessage = msg.sender_id === currentUserId;
                        const roleLabel = msg.sender_role === 'doctor' ? 'Dr.' : 'Patient';

                        return (
                            <div
                                key={msg.id || index}
                                className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${isOwnMessage
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-gray-100 text-gray-900'
                                        }`}
                                >
                                    {/* Always show sender label for clarity */}
                                    <p className="text-xs opacity-75 mb-1 font-medium">
                                        {isOwnMessage ? 'You' : roleLabel}
                                    </p>
                                    <p className="text-sm break-words">{msg.message}</p>
                                    <p
                                        className={`text-xs mt-1 ${isOwnMessage ? 'text-indigo-200' : 'text-gray-500'
                                            }`}
                                    >
                                        {new Date(msg.created_at).toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </p>
                                    {msg.error && (
                                        <p className="text-xs mt-1 text-red-300 italic">
                                            {msg.error}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
                <div className="flex items-end space-x-2">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Type a message..."
                        rows={2}
                        maxLength={1000}
                        className="flex-1 px-4 py-2 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                    />
                    <button
                        onClick={handleSend}
                        disabled={!newMessage.trim()}
                        className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                        title="Send message"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                    Press Enter to send, Shift+Enter for new line
                </p>
            </div>
        </div>
    );
};

export default ChatPanel;
