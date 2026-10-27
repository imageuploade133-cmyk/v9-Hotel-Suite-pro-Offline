
'use client';

import * as React from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { DynamicIcon } from '../ui/dynamic-icon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface SectionItem {
  id: string;
  title: string;
  icon: React.ElementType | string;
}

interface Section {
  group: string;
  items: SectionItem[];
}

interface SettingsNavigationProps {
  sections: Section[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
}

export function SettingsNavigation({ sections, searchTerm, onSearchChange }: SettingsNavigationProps) {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'business-info';
  const [openSections, setOpenSections] = React.useState<string[]>([]);

  const filteredSections = React.useMemo(() => {
    if (!searchTerm) return sections;
    return sections.map(section => ({
      ...section,
      items: section.items.filter(item => item.title.toLowerCase().includes(searchTerm.toLowerCase()))
    })).filter(section => section.items.length > 0);
  }, [sections, searchTerm]);

  React.useEffect(() => {
    if (searchTerm) {
      // Open all sections that have search results
      const sectionsWithResults = filteredSections.map(s => s.group);
      setOpenSections(sectionsWithResults);
    } else {
      // Find and open the section containing the active tab
      const activeSection = sections.find(section => section.items.some(item => item.id === activeTab));
      if (activeSection) {
        setOpenSections([activeSection.group]);
      }
    }
  }, [searchTerm, activeTab, sections, filteredSections]);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search settings..."
          className="pl-10"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <Accordion type="multiple" value={openSections} onValueChange={setOpenSections}>
        {filteredSections.map((section) => (
          <AccordionItem value={section.group} key={section.group} className="border-none">
            <AccordionTrigger className="py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline hover:bg-accent/50 rounded-md">
                {section.group}
            </AccordionTrigger>
            <AccordionContent className="pt-1">
                <div className="space-y-1 pl-4 border-l-2 ml-3">
                    {section.items.map((item) => (
                        <Link
                            key={item.id}
                            href={`/settings?tab=${item.id}`}
                            className={cn(
                                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all hover:bg-primary/10 hover:text-primary',
                                activeTab === item.id ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground'
                            )}
                            >
                            {typeof item.icon === 'string' ? <DynamicIcon iconName={item.icon} className="h-5 w-5" /> : <item.icon className="h-5 w-5" />}
                            {item.title}
                        </Link>
                    ))}
                </div>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
