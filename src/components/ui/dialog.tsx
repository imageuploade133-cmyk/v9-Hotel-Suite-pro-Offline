
"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"
import { useModalHistory } from "@/hooks/use-modal-history"

const Dialog = ({
  open,
  defaultOpen,
  onOpenChange,
  children,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) => {
  const modal = useModalHistory({ open, defaultOpen, onOpenChange });

  return (
    <DialogPrimitive.Root
      open={modal.open}
      onOpenChange={modal.onOpenChange}
      defaultOpen={undefined}
      {...props}
    >
      {children}
    </DialogPrimitive.Root>
  );
};

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80  data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, style, ...props }, ref) => {
    const isReceiptFullscreen = className?.split(/\\s+/).some(
      (name) => name === "receipt-dialog-fullscreen" || name === "receipt-reference-dialog"
    );

    // Responsive sm:* dialog utilities normally center and constrain desktop dialogs.
    // Receipt dialogs must instead stay anchored to the browser viewport at every zoom.
    const receiptViewportStyle: React.CSSProperties | undefined = isReceiptFullscreen
      ? {
          position: "fixed",
          inset: 0,
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          width: "100vw",
          height: "100dvh",
          minWidth: 0,
          minHeight: 0,
          maxWidth: "none",
          maxHeight: "none",
          margin: 0,
          boxSizing: "border-box",
          transform: "none",
          translate: "none",
          animation: "none",
        }
      : undefined;

    return (
      <DialogPortal>
        <DialogOverlay />
        <DialogPrimitive.Content
          ref={ref}
          data-dialog-content=""
          className={cn(
            "fixed inset-0 z-50 flex h-auto w-auto min-h-0 max-h-none max-w-none translate-x-0 translate-y-0 flex-col gap-4 overflow-y-auto overscroll-contain border-0 bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "sm:fixed sm:inset-auto sm:left-1/2 sm:top-1/2 sm:z-50 sm:flex sm:h-auto sm:w-full sm:max-w-lg sm:max-h-[min(90dvh,52rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:flex-col sm:gap-4 sm:rounded-lg sm:border sm:bg-background sm:p-6 sm:shadow-lg sm:overflow-y-auto",
            className
          )}
          onOpenAutoFocus={(e) => e.preventDefault()}
          style={{ ...style, ...receiptViewportStyle }}
          {...props}
        >
          <div className="mx-auto my-1 h-1 w-10 rounded-full bg-muted-foreground/20 sm:hidden shrink-0" />
          {children}
          <DialogPrimitive.Close className="absolute right-4 top-4 z-50 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background text-foreground opacity-90 shadow-sm ring-offset-background transition-colors hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-muted">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "sticky bottom-0 z-20 mt-auto w-full shrink-0 border-t border-border/60 bg-background/95 pt-3 pb-[max(.25rem,env(safe-area-inset-bottom))] backdrop-blur-sm flex flex-col-reverse gap-2",
      "sm:static sm:z-auto sm:mt-0 sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:flex-row sm:justify-end sm:space-x-2 sm:gap-0",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
