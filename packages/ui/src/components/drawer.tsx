import * as React from "react";
import { Dialog as DrawerPrimitive } from "@base-ui/react/dialog";
import { cn } from "@aloysius-g1/ui/lib/utils";
import { Button } from "@aloysius-g1/ui/components/button";
import { XIcon } from "lucide-react";

function Drawer({ ...props }: DrawerPrimitive.Root.Props) { return <DrawerPrimitive.Root data-slot="drawer" {...props} />; }
function DrawerTrigger({ ...props }: DrawerPrimitive.Trigger.Props) { return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />; }
function DrawerPortal({ ...props }: DrawerPrimitive.Portal.Props) { return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />; }
function DrawerClose({ ...props }: DrawerPrimitive.Close.Props) { return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />; }
function DrawerContent({ className, children, showCloseButton = true, ...props }: DrawerPrimitive.Popup.Props & { showCloseButton?: boolean }) {
  return <DrawerPortal><DrawerPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10 backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" /><DrawerPrimitive.Popup data-slot="drawer-content" className={cn("fixed inset-x-0 bottom-0 z-50 grid max-h-[min(90vh,48rem)] w-full gap-4 overflow-y-auto rounded-t-2xl bg-popover p-5 text-sm text-popover-foreground shadow-2xl ring-1 ring-foreground/10 duration-200 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom", className)} {...props}>{children}{showCloseButton && <DrawerPrimitive.Close render={<Button variant="ghost" className="absolute top-3 right-3" size="icon-sm" />}><XIcon /><span className="sr-only">Close</span></DrawerPrimitive.Close>}</DrawerPrimitive.Popup></DrawerPortal>;
}
function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) { return <div className={cn("flex flex-col gap-2", className)} {...props} />; }
function DrawerTitle({ className, ...props }: DrawerPrimitive.Title.Props) { return <DrawerPrimitive.Title className={cn("font-heading text-xl leading-none font-medium", className)} {...props} />; }
function DrawerDescription({ className, ...props }: DrawerPrimitive.Description.Props) { return <DrawerPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />; }

export { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerPortal, DrawerTitle, DrawerTrigger };
