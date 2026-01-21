export interface ChatMessage {
    id: string;
    sender_id: string;
    sender_role?: string;
    message: string;
    created_at: string;
    error?: string;
}

export interface ChatMessageCreate {
    interview_id: string;
    message: string;
}
