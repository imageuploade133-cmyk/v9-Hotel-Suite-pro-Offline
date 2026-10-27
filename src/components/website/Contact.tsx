
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

const contactSchema = z.object({
  fullName: z.string().min(1, 'Full name is required.'),
  emailAddress: z.string().email('A valid email is required.'),
  message: z.string().min(1, 'Message cannot be empty.'),
});

type ContactFormValues = z.infer<typeof contactSchema>;

export function Contact() {
    const { toast } = useToast();
    const [isSending, setIsSending] = React.useState(false);

    const form = useForm<ContactFormValues>({
        resolver: zodResolver(contactSchema),
        defaultValues: {
            fullName: '',
            emailAddress: '',
            message: '',
        }
    });

    const onSubmit = (data: ContactFormValues) => {
        setIsSending(true);
        const subject = encodeURIComponent(`Hotel Inquiry from ${data.fullName}`);
        const body = encodeURIComponent(`Name: ${data.fullName}\nEmail: ${data.emailAddress}\n\nMessage:\n${data.message}`);
        const mailtoLink = `mailto:reservations@cacidhotels.com.ng?subject=${subject}&body=${body}`;

        // Attempt to open mail client.
        window.location.href = mailtoLink;

        toast({
            title: 'Inquiry Ready to Send',
            description: "Your email client has been opened to send the message.",
            variant: 'success',
        });

        form.reset();
        setIsSending(false);
    };

    return (
        <section className="py-24 sm:py-32 px-4 sm:px-8 max-w-[1440px] mx-auto" id="contact">
            <div className="grid lg:grid-cols-2 gap-16 md:gap-24">
                <div className="space-y-12">
                    <div>
                        <span className="text-black dark:text-white uppercase tracking-[0.4em] text-[11px] font-extrabold block mb-6">Contact Us</span>
                        <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-8 leading-tight">How May We Assist You?</h2>
                        <p className="text-neutral-500 font-light max-w-md">Our dedicated team is available 24/7 to curate your perfect experience.</p>
                    </div>
                    <div className="space-y-8">
                        <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Full Name</label>
                                <input {...form.register('fullName')} className="w-full bg-transparent border-b border-neutral-200 dark:border-white/10 py-3 focus:outline-none focus:border-accent-gold transition-colors text-lg font-light" placeholder="John Doe" type="text"/>
                                {form.formState.errors.fullName && <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Email Address</label>
                                <input {...form.register('emailAddress')} className="w-full bg-transparent border-b border-neutral-200 dark:border-white/10 py-3 focus:outline-none focus:border-accent-gold transition-colors text-lg font-light" placeholder="john@example.com" type="email"/>
                                {form.formState.errors.emailAddress && <p className="text-xs text-destructive">{form.formState.errors.emailAddress.message}</p>}
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Message</label>
                            <textarea {...form.register('message')} className="w-full bg-transparent border-b border-neutral-200 dark:border-white/10 py-3 focus:outline-none focus:border-accent-gold transition-colors text-lg font-light h-32" placeholder="Tell us about your requirements..."></textarea>
                            {form.formState.errors.message && <p className="text-xs text-destructive">{form.formState.errors.message.message}</p>}
                        </div>
                        <button type="submit" disabled={isSending} className="px-12 py-4 bg-primary text-white text-[11px] font-bold uppercase tracking-widest hover:bg-accent-gold transition-all flex items-center justify-center disabled:opacity-50">
                            {isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send Inquiry
                        </button>
                    </div>
                </div>
                <div className="space-y-12">
                    <div className="aspect-square w-full bg-neutral-900 overflow-hidden rounded-2xl">
                       <iframe
                            src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3932.399587428418!2d8.52705447586526!3d9.729188079549323!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x11ae810d48880bdf%3A0x51ac1592af3f2d0c!2sCacid%20Hotels!5e0!3m2!1sen!2sng!4v1716386821266!5m2!1sen!2sng"
                            width="100%"
                            height="100%"
                            style={{ border: 0 }}
                            allowFullScreen={false}
                            loading="lazy"
                            referrerPolicy="no-referrer-when-downgrade"
                            className=""
                       ></iframe>
                    </div>
                    <div className="grid md:grid-cols-2 gap-12">
                        <div>
                            <h4 className="text-[10px] uppercase tracking-widest font-bold text-destructive mb-4">Location</h4>
                            <p className="font-bold text-black dark:text-white">Cacid Hotels, 1, by Sarki yaki, Burma Rd, Fagge, Kano 700211, Kano</p>
                        </div>
                        <div>
                            <h4 className="text-[10px] uppercase tracking-widest font-bold text-destructive mb-4">Direct Contact</h4>
                            <p className="font-bold text-black dark:text-white">T: +234 123 456 7890<br/>E: reservations@cacidhotels.com.ng</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
