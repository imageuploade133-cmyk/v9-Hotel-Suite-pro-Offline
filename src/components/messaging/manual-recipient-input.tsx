
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
      .split(/[\n,;\t]+/) // Split by newlines, commas, semicolons, or tabs
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
          Paste or type phone numbers below, one per line or separated by commas or semicolons. Spaces inside a formatted phone number are allowed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Textarea
          value={numbersText}
          onChange={(e) => setNumbersText(e.target.value)}
          placeholder="e.g. +234 801 234 5678, +44 9876 54321"
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
