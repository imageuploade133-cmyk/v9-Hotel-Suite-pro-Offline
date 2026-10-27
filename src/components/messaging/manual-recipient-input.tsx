
'use client';

import * as React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ManualRecipientInputProps {
  onAdd: (numbers: string[]) => void;
}

export function ManualRecipientInput({ onAdd }: ManualRecipientInputProps) {
  const [numbersText, setNumbersText] = React.useState('');
  const { toast } = useToast();

  const handleAddNumbers = () => {
    const numbers = numbersText
      .split(/[\n,;\s]+/) // Split by newlines, commas, semicolons, or spaces
      .map(num => num.trim())
      .filter(Boolean); // Remove any empty strings

    if (numbers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No numbers entered',
        description: 'Please enter at least one phone number.',
      });
      return;
    }

    onAdd(numbers);
    setNumbersText(''); // Clear the textarea after adding
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Entry</CardTitle>
        <CardDescription>
          Paste or type phone numbers below, separated by commas, spaces, or new lines.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          placeholder="e.g., +1234567890, +44987654321..."
          rows={4}
        />
      </CardContent>
      <CardFooter>
        <Button onClick={handleAddNumbers} disabled={!numbersText.trim()}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add to Recipient List
        </Button>
      </CardFooter>
    </Card>
  );
}
