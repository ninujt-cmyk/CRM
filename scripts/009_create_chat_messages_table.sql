-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content TEXT NOT NULL,
    sender_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Enable RLS (Row Level Security)
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for chat messages
-- Users can read all chat messages
CREATE POLICY "Users can read all chat messages" 
ON chat_messages FOR SELECT 
TO authenticated 
USING (true);

-- Users can insert their own chat messages
CREATE POLICY "Users can insert their own chat messages" 
ON chat_messages FOR INSERT 
TO authenticated 
WITH CHECK (sender_id = auth.uid());

-- Users can update their own chat messages
CREATE POLICY "Users can update their own chat messages" 
ON chat_messages FOR UPDATE 
TO authenticated 
USING (sender_id = auth.uid());

-- Users can delete their own chat messages
CREATE POLICY "Users can delete their own chat messages" 
ON chat_messages FOR DELETE 
TO authenticated 
USING (sender_id = auth.uid());

-- Grant permissions
GRANT ALL ON TABLE chat_messages TO authenticated;