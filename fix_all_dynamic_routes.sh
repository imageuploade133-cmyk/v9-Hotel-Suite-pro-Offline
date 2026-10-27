#!/bin/bash
find src/app -name "page.tsx" | grep "\[" | while read -r file; do
    dir=$(dirname "$file")
    # Extract ALL dynamic segments in the path, e.g. [id] or [status]
    # If there are multiple, we need all of them for generateStaticParams
    segments=$(echo "$file" | grep -o '\[[^]]*\]' | tr -d '[]')

    if grep -q "'use client'" "$file"; then
        echo "Processing client component $file"
        mv "$file" "$dir/page-client.tsx"

        # Build the return object for generateStaticParams
        param_obj=""
        for seg in $segments; do
            if [ -n "$param_obj" ]; then param_obj="$param_obj, "; fi
            param_obj="$param_obj$seg: 'view'"
        done

        cat << EOP > "$file"
import PageClient from './page-client';

export function generateStaticParams() {
  return [{ $param_obj }];
}

export default function Page() {
  return <PageClient />;
}
EOP
    else
        echo "Processing server component $file"
        if ! grep -q "generateStaticParams" "$file"; then
            # Build the return object for generateStaticParams
            param_obj=""
            for seg in $segments; do
                if [ -n "$param_obj" ]; then param_obj="$param_obj, "; fi
                param_obj="$param_obj$seg: 'view'"
            done
            # Append generateStaticParams to the end of the file if it's not there
            # This is a bit risky for server components, but let's see.
            # Actually, most server components in this project seem to be simple wrappers.
            cat << EOP >> "$file"

export function generateStaticParams() {
  return [{ $param_obj }];
}
EOP
        fi
    fi
done
