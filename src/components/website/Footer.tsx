
'use client';

import * as React from 'react';
import { Instagram, Linkedin, Twitter, Youtube, Mail, Loader2 } from 'lucide-react';
import { useSettings } from '@/contexts/settings-context';
import Image from 'next/image';
import { useFirestore } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useFormContext } from 'react-hook-form';

export function Footer() {
    const { settings } = useSettings();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [email, setEmail] = React.useState('');
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    const { watch } = useFormContext();

    const footerData = watch('websiteData.footer', {
        description: "Experience unparalleled hospitality and comfort. Your perfect getaway in the heart of the city.",
        newsletterTitle: "Stay updated with our latest offers.",
        copyrightText: `© ${new Date().getFullYear()} CACID HOTEL. All rights reserved.`,
        publicBankName: '',
        publicAccountName: '',
        publicAccountNumber: '',
        publicBankLogoUrl: '',
    });

    const socialData = watch('websiteData.socialAndBranding', {
        instagramUrl: '#',
        twitterUrl: '#',
        youtubeUrl: '#'
    });


    const handleNewsletterSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !firestore) {
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'newsletterSignups'), {
                email: email,
                subscribedAt: serverTimestamp(),
            });
            toast({
                title: 'Subscription Successful!',
                description: "You've been added to our newsletter.",
                variant: 'success',
            });
            setEmail('');
        } catch (error: any) {
            toast({
                title: 'Subscription Failed',
                description: error.message || 'An unexpected error occurred.',
                variant: 'destructive',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const NavLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
        <a
            href={href}
            className="relative text-white/70 hover:text-black transition-colors duration-300 group"
        >
            {children}
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
        </a>
    );

    return (
        <footer className="relative text-white/70 py-24 px-4 sm:px-8 font-website-body overflow-hidden" style={{ backgroundColor: '#9D8634' }}>
             <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                <span className="text-white/5 font-black text-[10vw] md:text-[15vw] lg:text-[20vw] whitespace-nowrap">{settings?.websiteName || 'CACID HOTEL'}</span>
            </div>
            <div className="relative z-10 max-w-[1440px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 sm:gap-16 mb-24">
                    <div className="space-y-8">
                        <div>
                          {settings?.websiteData?.socialAndBranding?.websiteLogoUrl ? (
                              <Image src={settings.websiteData.socialAndBranding.websiteLogoUrl} alt={settings.websiteName || 'Logo'} width={140} height={40} className="object-contain h-10" />
                          ) : (
                              <span className="text-3xl font-website-display font-medium tracking-tighter text-white">{settings?.websiteName || 'CACID HOTEL'}</span>
                          )}
                        </div>
                        <p className="text-sm font-light leading-relaxed max-w-xs">
                            {footerData?.description}
                        </p>
                        <div className="flex gap-4">
                            {socialData.instagramUrl && <a className="hover:text-black transition-colors" href={socialData.instagramUrl} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><Instagram className="h-5 w-5" /></a>}
                            {socialData.twitterUrl && <a className="hover:text-black transition-colors" href={socialData.twitterUrl} target="_blank" rel="noopener noreferrer" aria-label="Twitter"><Twitter className="h-5 w-5" /></a>}
                            {socialData.youtubeUrl && <a className="hover:text-black transition-colors" href={socialData.youtubeUrl} target="_blank" rel="noopener noreferrer" aria-label="Youtube"><Youtube className="h-5 w-5" /></a>}
                        </div>
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-white font-extrabold uppercase tracking-[0.2em] text-sm font-website-display">Navigation</h4>
                        <ul className="space-y-4 text-[13px] font-medium">
                            <li><NavLink href="#accommodations">Accommodations</NavLink></li>
                            <li><NavLink href="#gallery">Gallery</NavLink></li>
                            <li><NavLink href="#testimonials">Testimonials</NavLink></li>
                            <li><NavLink href="#contact">Contact</NavLink></li>
                        </ul>
                    </div>
                     <div className="space-y-6">
                        <h4 className="text-white font-extrabold uppercase tracking-[0.2em] text-sm font-website-display">Payment Info</h4>
                        {footerData?.publicBankName || footerData?.publicAccountName || footerData?.publicAccountNumber ? (
                            <div className="text-[13px] font-medium space-y-3">
                                {footerData.publicBankName && <p><strong>Bank:</strong> {footerData.publicBankName}</p>}
                                {footerData.publicAccountName && <p><strong>Name:</strong> {footerData.publicAccountName}</p>}
                                {footerData.publicAccountNumber && <p><strong>Acct No:</strong> {footerData.publicAccountNumber}</p>}
                                {footerData.publicBankLogoUrl && (
                                    <div className="mt-2">
                                        <Image src={footerData.publicBankLogoUrl} alt="Bank Logo" width={80} height={40} className="object-contain" />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <p className="text-[13px] font-light">Bank details for direct deposits are available upon request.</p>
                        )}
                    </div>
                    <div className="space-y-6">
                        <h4 className="text-white font-extrabold uppercase tracking-[0.2em] text-sm font-website-display">Newsletter</h4>
                        <p className="text-[13px] font-light">{footerData?.newsletterTitle}</p>
                        <form className="relative" onSubmit={handleNewsletterSubmit}>
                            <input
                                className="w-full bg-white/10 border-2 border-white/20 rounded-full py-3 pl-5 pr-12 text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-black/80 focus:border-black transition-all text-sm"
                                placeholder="Email address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isSubmitting}
                            />
                            <button
                                type="submit"
                                onClick={handleNewsletterSubmit}
                                className="absolute inset-y-0 right-0 flex items-center pr-3 text-white/50 hover:text-black transition-colors disabled:opacity-50"
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Mail className="h-5 w-5"/>}
                            </button>
                        </form>
                    </div>
                </div>
                <div className="pt-12 border-t border-white/5 flex flex-col md:flex-row justify-between gap-8 text-[10px] uppercase tracking-[0.3em] font-extrabold">
                    <p>{footerData?.copyrightText}</p>
                    <div className="flex flex-col sm:flex-row gap-4 sm:gap-12">
                         <a href="#" className="relative text-white/70 hover:text-black transition-colors duration-300 group">
                            Privacy Policy
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
                        </a>
                        <a href="#" className="relative text-white/70 hover:text-black transition-colors duration-300 group">
                            Terms of Service
                            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-black transition-all duration-300 group-hover:w-full"></span>
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
