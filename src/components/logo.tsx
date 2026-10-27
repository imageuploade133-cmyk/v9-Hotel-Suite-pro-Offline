
import { cn } from "@/lib/utils";
import Image from 'next/image';
import { useSettings } from "@/contexts/settings-context";

export const Logo = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => {
    const { settings } = useSettings();
    const logoUrl = settings?.businessLogoUrl;

    if (logoUrl) {
        return (
            <Image
                src={logoUrl}
                alt={settings?.businessName || "Logo"}
                width={32}
                height={32}
                className={cn("object-contain", className)}
            />
        );
    }

    // Fallback Icon
    return (
       <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn("h-6 w-6", className)}
            {...props}
        >
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
        </svg>
    );
};
