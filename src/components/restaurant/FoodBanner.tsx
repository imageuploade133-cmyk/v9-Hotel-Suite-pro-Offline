'use client';

import React from 'react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Card, CardContent } from "@/components/ui/card";
import Image from "next/image";

export function FoodBanner() {
  const plugin = React.useRef(
    Autoplay({ delay: 4000, stopOnInteraction: true })
  );

  const foodImages = [
    {
      id: "food-banner-1",
      description: "Delicious gourmet burger on a wooden board.",
      imageUrl: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?auto=format&fit=crop&q=80&w=1920",
      imageHint: "gourmet burger",
      title: "Gourmet Burgers",
      subtitle: "Juicy, handcrafted burgers made with the finest ingredients."
    },
    {
      id: "food-banner-2",
      description: "Fresh and colorful salad in a white bowl.",
      imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=1920",
      imageHint: "fresh salad",
      title: "Fresh Salads",
      subtitle: "Crisp, vibrant salads for a healthy and refreshing meal."
    },
    {
      id: "food-banner-3",
      description: "A steaming bowl of pasta with fresh basil.",
      imageUrl: "https://images.unsplash.com/photo-1589227365533-5f5f6b0015f3?auto=format&fit=crop&q=80&w=1920",
      imageHint: "pasta bowl",
      title: "Artisanal Pasta",
      subtitle: "Authentic pasta dishes that transport you to Italy."
    }
  ];

  return (
    <Carousel
      plugins={[plugin.current]}
      className="w-full"
      onMouseEnter={plugin.current.stop}
      onMouseLeave={plugin.current.reset}
    >
      <CarouselContent>
        {foodImages.map((image) => (
          <CarouselItem key={image.id}>
            <Card className="overflow-hidden rounded-lg">
              <CardContent className="relative flex aspect-[2.4/1] items-center justify-center p-6">
                <Image
                  src={image.imageUrl}
                  alt={image.description}
                  fill
                  className="object-cover"
                  data-ai-hint={image.imageHint}
                />
                <div className="absolute inset-0 bg-black/50" />
                <div className="relative text-center text-white p-4 max-w-2xl">
                  <h3 className="text-3xl font-bold">{image.title}</h3>
                  <p className="text-base mt-2 font-light">{image.subtitle}</p>
                </div>
              </CardContent>
            </Card>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="absolute left-4 top-1/2 -translate-y-1/2 hidden sm:flex" />
      <CarouselNext className="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:flex" />
    </Carousel>
  );
}
