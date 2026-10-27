
'use client';

import * as React from 'react';
import Image from 'next/image';
import { Star } from 'lucide-react';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Autoplay from "embla-carousel-autoplay";
import { Logo } from '../logo';

export function Testimonials() {

    const testimonials = [
        {
            name: 'Adekunle Adebayo',
            location: 'Lagos, Nigeria',
            content: "From the moment I stepped in, the service was impeccable. A true oasis of luxury in the heart of the city. I'll definitely be returning."
        },
        {
            name: 'Ngozi Okonjo',
            location: 'Abuja, Nigeria',
            content: "The attention to detail is astonishing. Every corner of the hotel tells a story. A truly unforgettable experience for my family and I."
        },
        {
            name: 'Chiamaka Nwosu',
            location: 'Enugu, Nigeria',
            content: "I hosted a business conference here, and the facilities were second to none. My international clients were thoroughly impressed."
        },
        {
            name: 'Tunde Bakare',
            location: 'Port Harcourt, Nigeria',
            content: "The serene environment and top-notch spa services provided the perfect weekend getaway. I left feeling completely rejuvenated."
        },
        {
            name: 'Fatima Aliyu',
            location: 'Kano, Nigeria',
            content: "An absolutely stunning hotel. The blend of modern architecture with traditional art is breathtaking. The food was divine!"
        },
        {
            name: 'Obinna Okoro',
            location: 'Owerri, Nigeria',
            content: "As a frequent traveler, I can say with confidence that this is one of the best hotels I've stayed at. The staff goes above and beyond."
        }
    ];

    const plugin = React.useRef(
      Autoplay({ delay: 5000, stopOnInteraction: true })
    );

    return (
        <section className="py-24 sm:py-32" id="testimonials">
            <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
                <div className="text-center mb-12 sm:mb-16">
                    <span className="text-black dark:text-white uppercase tracking-[0.4em] text-[11px] font-extrabold">Testimonials</span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-white leading-none tracking-tight mt-4">Voices of Our Valued Guests</h2>
                </div>
                <Carousel
                  opts={{
                    align: "start",
                    loop: true,
                  }}
                  plugins={[plugin.current]}
                  onMouseEnter={plugin.current.stop}
                  onMouseLeave={plugin.current.reset}
                  className="w-full relative"
                >
                  <CarouselContent className="-ml-8">
                    {testimonials.map((testimonial, index) => (
                      <CarouselItem key={index} className="md:basis-1/2 lg:basis-1/3 pl-8">
                        <div className="p-8 border border-neutral-100 dark:border-white/5 rounded-2xl bg-neutral-50 dark:bg-neutral-900/50 flex flex-col h-full">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="relative size-12 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center">
                                    <Logo className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <h4 className="font-bold">{testimonial.name}</h4>
                                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                                </div>
                            </div>
                            <blockquote className="italic text-neutral-600 dark:text-neutral-300 font-light flex-1">
                                "{testimonial.content}"
                            </blockquote>
                             <div className="flex gap-0.5 mt-6 text-accent-gold">
                                {Array.from({length: 5}).map((_, i) => (
                                    <Star key={i} className="h-4 w-4 fill-current" />
                                ))}
                            </div>
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                   <div className="absolute -bottom-20 w-full flex justify-center gap-4">
                        <CarouselPrevious className="relative left-0 size-12 rounded-full bg-black text-white border border-white/20 flex items-center justify-center hover:bg-gray-800 transition-colors" />
                        <CarouselNext className="relative right-0 size-12 rounded-full bg-black text-white border border-white/20 flex items-center justify-center hover:bg-gray-800 transition-colors" />
                    </div>
                </Carousel>
            </div>
        </section>
    );
}
