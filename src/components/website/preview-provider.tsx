
'use client';

import * as React from 'react';
import { FormProvider, useForm } from 'react-hook-form';

export function PreviewProvider({ children, pageData }: { children: React.ReactNode, pageData: any }) {
    const methods = useForm({
        defaultValues: {
            websiteData: pageData.settings.websiteData || {},
        },
    });

    React.useEffect(() => {
        if(pageData.settings.websiteData) {
            methods.reset({ websiteData: pageData.settings.websiteData });
        }
    }, [pageData.settings.websiteData, methods]);

    return (
        <FormProvider {...methods}>
            {children}
        </FormProvider>
    )
}
