
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background primary-hover",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "primary-hover",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, children, onClick, ...props }, ref) => {
    const [autoLoading, setAutoLoading] = React.useState(false);
    const [promiseLoading, setPromiseLoading] = React.useState(false);
    const loadingTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isLoading = Boolean(loading || autoLoading);
    const isDisabled = Boolean(loading || props.disabled || promiseLoading);

    const clearAutoLoading = React.useCallback(() => {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setAutoLoading(false);
      setPromiseLoading(false);
    }, []);

    React.useEffect(() => {
      return () => {
        if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      };
    }, []);

    const handleClick: React.MouseEventHandler<HTMLButtonElement> = (event) => {
      if (isDisabled || autoLoading) return;

      setAutoLoading(true);
      try {
        // Preserve the original handler. If it returns a promise, keep the
        // loading indicator visible until the action completes.
        const result = onClick?.(event) as unknown;
        if (result && typeof (result as { then?: unknown }).then === "function") {
          setPromiseLoading(true);
          Promise.resolve(result).then(clearAutoLoading, clearAutoLoading);
        } else {
          // Synchronous actions receive brief feedback without changing their
          // normal click or form-submit behavior.
          loadingTimerRef.current = setTimeout(clearAutoLoading, 500);
        }
      } catch (error) {
        clearAutoLoading();
        throw error;
      }
    };

    const childContent = isLoading ? (
      <>
        <Loader2 className="animate-spin" aria-hidden="true" />
        {children}
      </>
    ) : (
      children
    );

    const hoverStyle = props.style?.['--primary-hover']
      ? { '--primary-hover-bg': props.style['--primary-hover'] }
      : {};

    if (asChild) {
      return (
        <Slot
          className={cn(buttonVariants({ variant, size, className }), promiseLoading && "pointer-events-none")}
          ref={ref}
          {...props}
          onClick={handleClick}
          aria-busy={isLoading || undefined}
          aria-disabled={isDisabled || undefined}
          tabIndex={isDisabled ? -1 : props.tabIndex}
          style={{ ...props.style, ...hoverStyle }}
        >
          {childContent}
        </Slot>
      );
    }

    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        onClick={handleClick}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        style={{ ...props.style, ...hoverStyle }}
      >
        {childContent}
      </button>
    );
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
