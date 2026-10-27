import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFoodImageOutputSchema = z.object({
  url: z.string().describe("A data URI of the generated image."),
});

export type GenerateFoodImageOutput = z.infer<typeof GenerateFoodImageOutputSchema>;

// Define the flow first to avoid temporal dead zone
const generateFoodImageFlow = ai.defineFlow(
  {
    name: 'generateFoodImageFlow',
    inputSchema: z.string(),
    outputSchema: GenerateFoodImageOutputSchema,
  },
  async (prompt) => {
    const { media } = await ai.generate({
      model: 'googleai/imagen-4.0-fast-generate-001',
      prompt: `A high-quality, professional food photography shot of ${prompt}, appetizing, well-lit, on a clean background.`,
    });

    if (!media.url) {
        throw new Error('Image generation failed to return a URL.');
    }

    return { url: media.url };
  }
);

export async function generateFoodImage(prompt: string): Promise<GenerateFoodImageOutput> {
  return generateFoodImageFlow(prompt);
}
