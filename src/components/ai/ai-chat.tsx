
'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Loader2, Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';
import { useUser } from '@/contexts/user-context';
import { getInitials } from '@/lib/helpers';
import { ScrollArea } from '../ui/scroll-area';

interface AiChatProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  aiAction?: (prompt: string) => Promise<any>;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export function AiChat({
  open,
  onOpenChange,
  title,
  description,
  aiAction,
}: AiChatProps) {
  const [prompt, setPrompt] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [chatHistory, setChatHistory] = React.useState<ChatMessage[]>([]);
  const { userProfile } = useUser();
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [chatHistory]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isLoading) return;

    if (!aiAction) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: 'AI actions are not configured for this application.' }]);
        setIsLoading(false);
        return;
    }

    const newHistory: ChatMessage[] = [
      ...chatHistory,
      { role: 'user', content: prompt },
    ];
    setChatHistory(newHistory);
    setPrompt('');
    setIsLoading(true);

    try {
      const result = await aiAction(prompt);
      const aiResponse = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
      setChatHistory([
        ...newHistory,
        { role: 'assistant', content: aiResponse },
      ]);
    } catch (error) {
      console.error('AI action failed:', error);
      setChatHistory([
        ...newHistory,
        {
          role: 'assistant',
          content: 'Sorry, I encountered an error. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[70vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot /> {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 -mx-6" ref={scrollAreaRef}>
            <div className="px-6 space-y-6">
                {chatHistory.map((message, index) => (
                <div
                    key={index}
                    className={`flex items-start gap-4 ${
                    message.role === 'user' ? 'justify-end' : ''
                    }`}
                >
                    {message.role === 'assistant' && (
                    <Avatar className="h-8 w-8 border-2 border-primary">
                        <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                    </Avatar>
                    )}
                    <div
                    className={`max-w-md rounded-lg p-3 ${
                        message.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted'
                    }`}
                    >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                    </div>
                     {message.role === 'user' && (
                        <Avatar className="h-8 w-8">
                            <AvatarImage src={userProfile?.photoURL || ''} />
                            <AvatarFallback>{userProfile ? getInitials(userProfile.name) : 'U'}</AvatarFallback>
                        </Avatar>
                    )}
                </div>
                ))}
                 {isLoading && (
                    <div className="flex items-start gap-4">
                        <Avatar className="h-8 w-8 border-2 border-primary">
                            <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
                        </Avatar>
                        <div className="bg-muted p-3 rounded-lg">
                           <Loader2 className="h-5 w-5 animate-spin" />
                        </div>
                    </div>
                )}
            </div>
        </ScrollArea>
        <form onSubmit={handleSubmit} className="relative">
          <Textarea
            placeholder="Type your question here..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="pr-16"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="absolute bottom-2.5 right-2.5 h-9 w-12"
            disabled={isLoading || !prompt.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
