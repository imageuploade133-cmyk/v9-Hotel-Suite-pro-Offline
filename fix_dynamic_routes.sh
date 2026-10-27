#!/bin/bash
routes=(
"src/app/(protected)/active-check-ins/[id]"
"src/app/(protected)/customers/[id]"
"src/app/(protected)/expenses/[id]"
"src/app/(protected)/gym-management/[id]"
"src/app/(protected)/menu-editor/[id]"
"src/app/(protected)/pos-customers/[id]"
"src/app/(protected)/roles/[id]"
"src/app/(protected)/staff-analytics/[id]"
"src/app/(public)/booking-confirmation/[id]"
"src/app/(public)/menus/[id]"
)

for route in "${routes[@]}"; do
    dir="/home/engine/project/$route"
    file="$dir/page.tsx"
    if [ -f "$file" ]; then
        if grep -q "'use client'" "$file"; then
            echo "Processing client component $file"
            mv "$file" "$dir/page-client.tsx"
            param_name=$(echo $route | grep -o '\[.*\]' | tr -d '[]')
            cat << EOP > "$file"
import PageClient from './page-client';

export function generateStaticParams() {
  return [{ $param_name: 'view' }];
}

export default function Page() {
  return <PageClient />;
}
EOP
        else
            echo "Processing server component $file"
            if ! grep -q "generateStaticParams" "$file"; then
                param_name=$(echo $route | grep -o '\[.*\]' | tr -d '[]')
                # For server components, we might need a bit more care,
                # but let's see if we can just append it or insert it.
                # Actually, most of these are probably client components anyway.
                # If it's a server component, we'll handle it manually if it fails.
            fi
        fi
    fi
done
