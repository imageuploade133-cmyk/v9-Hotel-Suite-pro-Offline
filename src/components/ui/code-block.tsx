
'use client';

import * as React from 'react';
import { Check, Copy } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './button';

interface CodeBlockProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  code: string;
  language: string;
}

export function CodeBlock({ title, code, language, ...props }: CodeBlockProps) {
  const { toast } = useToast();
  const [hasCopied, setHasCopied] = React.useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(code.trim());
    setHasCopied(true);
    toast({
      title: 'Copied to clipboard',
      description: 'The code block has been copied.',
    });
    setTimeout(() => setHasCopied(false), 2000);
  };

  return (
    <div className="relative rounded-lg border bg-muted" {...props}>
      <div className="flex items-center justify-between border-b px-4 py-2">
        <p className="text-sm font-semibold">{title}</p>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2"
          onClick={copyToClipboard}
        >
          {hasCopied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
          Copy
        </Button>
      </div>
      <div className="p-4">
        <pre className="overflow-x-auto rounded-md bg-background p-4 text-sm">
          <code className={`language-${language}`}>{code.trim()}</code>
        </pre>
      </div>
    </div>
  );
}
