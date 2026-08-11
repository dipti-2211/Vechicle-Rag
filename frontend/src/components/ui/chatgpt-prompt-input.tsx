// chatgpt-prompt-input.tsx
import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as DialogPrimitive from "@radix-ui/react-dialog";

// --- Utility ---
type ClassValue = string | number | boolean | null | undefined;
function cn(...inputs: ClassValue[]): string { return inputs.filter(Boolean).join(" "); }

// --- Radix: Tooltip ---
const TooltipProvider = TooltipPrimitive.Provider;
const Tooltip = TooltipPrimitive.Root;
const TooltipTrigger = TooltipPrimitive.Trigger;
const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content> & { showArrow?: boolean }
>(({ className, sideOffset = 4, showArrow = false, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "relative z-50 max-w-[280px] rounded-md bg-[#1a1a1a] border border-white/10 text-white px-2 py-1 text-xs shadow-lg",
        "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    >
      {props.children}
      {showArrow && <TooltipPrimitive.Arrow className="-my-px fill-[#1a1a1a]" />}
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = TooltipPrimitive.Content.displayName;

// --- Radix: Popover ---
const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-64 rounded-xl bg-[#1a1a1a] border border-white/10 p-2 text-white shadow-2xl outline-none",
        "animate-in data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
        "data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

// --- Radix: Dialog ---
const Dialog = DialogPrimitive.Root;
const DialogPortal = DialogPrimitive.Portal;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn("fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0", className)}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-[90vw] md:max-w-[800px] translate-x-[-50%] translate-y-[-50%] gap-4 border-none bg-transparent p-0 shadow-none duration-300",
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      <div className="relative bg-[#1a1a1a] border border-white/10 rounded-[28px] overflow-hidden shadow-2xl p-1">
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 hover:bg-white/20 transition-all">
          <XIcon className="h-4 w-4 text-white" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </div>
    </DialogPrimitive.Content>
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

// --- Icons ---
const PlusIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 5V19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 12H19" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const Settings2Icon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 7h-9" /><path d="M14 17H5" />
    <circle cx="17" cy="17" r="3" /><circle cx="7" cy="7" r="3" />
  </svg>
);
const SendIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
    <path d="M12 5.25L12 18.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M18.75 12L12 5.25L5.25 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const XIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const MicIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
  </svg>
);
const GlobeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="10"/><path d="M2 12h20"/>
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
  </svg>
);
const PencilIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/>
  </svg>
);
const LightbulbIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="none" {...props}>
    <path d="M12 7C9.23858 7 7 9.23858 7 12C7 13.3613 7.54402 14.5955 8.42651 15.4972C8.77025 15.8484 9.05281 16.2663 9.14923 16.7482L9.67833 19.3924C9.86537 20.3272 10.6862 21 11.6395 21H12.3605C13.3138 21 14.1346 20.3272 14.3217 19.3924L14.8508 16.7482C14.9472 16.2663 15.2297 15.8484 15.5735 15.4972C16.456 14.5955 17 13.3613 17 12C17 9.23858 14.7614 7 12 7Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M12 4V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M18 6L19 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M20 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M4 12H3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5 5L6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 17H14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);
const SearchIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);

const toolsList = [
  { id: 'searchDocs',   name: 'Search all documents', shortName: 'Search',    icon: SearchIcon   },
  { id: 'searchWeb',    name: 'Search the web',        shortName: 'Web',       icon: GlobeIcon    },
  { id: 'writeCode',    name: 'Write or draft',        shortName: 'Write',     icon: PencilIcon   },
  { id: 'thinkLonger',  name: 'Think for longer',      shortName: 'Think',     icon: LightbulbIcon },
];

// PromptBox — props extended for vehicle AI context
export interface PromptBoxProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  onSend?: (message: string) => void;
  isSending?: boolean;
  externalValue?: string;
  onExternalChange?: (val: string) => void;
}

export const PromptBox = React.forwardRef<HTMLTextAreaElement, PromptBoxProps>(
  ({ className, onSend, isSending = false, externalValue, onExternalChange, ...props }, ref) => {
    const internalTextareaRef = React.useRef<HTMLTextAreaElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [internalValue, setInternalValue] = React.useState("");
    const value = externalValue !== undefined ? externalValue : internalValue;
    const [imagePreview, setImagePreview] = React.useState<string | null>(null);
    const [selectedTool, setSelectedTool] = React.useState<string | null>(null);
    const [isPopoverOpen, setIsPopoverOpen] = React.useState(false);
    const [isImageDialogOpen, setIsImageDialogOpen] = React.useState(false);

    React.useImperativeHandle(ref, () => internalTextareaRef.current!, []);

    React.useLayoutEffect(() => {
      const textarea = internalTextareaRef.current;
      if (textarea) {
        textarea.style.height = "auto";
        const newHeight = Math.min(textarea.scrollHeight, 200);
        textarea.style.height = `${newHeight}px`;
      }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const v = e.target.value;
      if (externalValue !== undefined) { onExternalChange?.(v); }
      else { setInternalValue(v); }
      if (props.onChange) props.onChange(e);
    };

    const handleSend = () => {
      if (!value.trim() || isSending) return;
      onSend?.(value.trim());
      if (externalValue === undefined) setInternalValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onloadend = () => { setImagePreview(reader.result as string); };
        reader.readAsDataURL(file);
      }
      event.target.value = "";
    };

    const handleRemoveImage = (e: React.MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation(); setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const hasValue = value.trim().length > 0 || imagePreview;
    const activeTool = selectedTool ? toolsList.find(t => t.id === selectedTool) : null;
    const ActiveToolIcon = activeTool?.icon;

    return (
      <div className={cn(
        "flex flex-col rounded-[20px] p-2 shadow-2xl transition-all outline-none",
        "bg-[#111111] border border-white/[0.12] hover:border-white/[0.2] focus-within:border-white/[0.18] focus-within:outline-none focus-within:ring-0",
        className
      )}>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/*" />

        {/* Image preview */}
        {imagePreview && (
          <Dialog open={isImageDialogOpen} onOpenChange={setIsImageDialogOpen}>
            <div className="relative mb-1 w-fit rounded-[1rem] px-1 pt-1">
              <button type="button" onClick={() => setIsImageDialogOpen(true)}>
                <img src={imagePreview} alt="Image preview" className="h-14 w-14 rounded-xl object-cover" />
              </button>
              <button onClick={handleRemoveImage} className="absolute right-2 top-2 z-10 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors" aria-label="Remove image">
                <XIcon className="h-3 w-3" />
              </button>
            </div>
            <DialogContent>
              <img src={imagePreview} alt="Full size preview" className="w-full max-h-[95vh] object-contain rounded-[24px]" />
            </DialogContent>
          </Dialog>
        )}

        {/* Textarea */}
        <textarea
          ref={internalTextareaRef}
          rows={1}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={props.placeholder || "Ask anything about your vehicles…"}
          disabled={isSending}
          className="w-full resize-none border-0 bg-transparent px-3 pt-3 pb-1 text-white placeholder:text-neutral-600 focus:ring-0 focus-visible:outline-none min-h-12 text-sm leading-relaxed disabled:opacity-60"
          style={{ maxHeight: '200px', overflowY: 'auto' }}
          {...props}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {/* Toolbar */}
        <div className="p-1 pt-0">
          <TooltipProvider delayDuration={200}>
            <div className="flex items-center gap-1.5">
              {/* Attach */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" onClick={() => fileInputRef.current?.click()} className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-all">
                    <PlusIcon className="h-5 w-5" />
                    <span className="sr-only">Attach image</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" showArrow><p>Attach image</p></TooltipContent>
              </Tooltip>

              {/* Tools popover */}
              <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button type="button" className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-all">
                        <Settings2Icon className="h-4 w-4" />
                        {!selectedTool && <span className="text-xs">Tools</span>}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow><p>Explore Tools</p></TooltipContent>
                </Tooltip>
                <PopoverContent side="top" align="start">
                  <div className="flex flex-col gap-0.5">
                    {toolsList.map(tool => (
                      <button key={tool.id} onClick={() => { setSelectedTool(tool.id); setIsPopoverOpen(false); }} className="flex w-full items-center gap-2.5 rounded-lg p-2.5 text-left text-sm text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-all">
                        <tool.icon className="h-4 w-4 text-neutral-500" />
                        <span>{tool.name}</span>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>

              {/* Active tool chip */}
              {activeTool && (
                <>
                  <div className="h-4 w-px bg-white/10" />
                  <button onClick={() => setSelectedTool(null)} className="flex h-8 items-center gap-1.5 rounded-full px-2.5 text-sm text-indigo-400 hover:bg-white/[0.06] transition-all">
                    {ActiveToolIcon && <ActiveToolIcon className="h-4 w-4" />}
                    <span className="text-xs">{activeTool.shortName}</span>
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {/* Right side */}
              <div className="ml-auto flex items-center gap-1.5">
                {/* Mic */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.08] transition-all">
                      <MicIcon className="h-4 w-4" />
                      <span className="sr-only">Record voice</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow><p>Record voice</p></TooltipContent>
                </Tooltip>

                {/* Send */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleSend}
                      disabled={!hasValue || isSending}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-all focus-visible:outline-none disabled:pointer-events-none bg-white text-black hover:bg-white/90 disabled:bg-white/20 disabled:text-white/40"
                    >
                      <SendIcon className="h-4 w-4" />
                      <span className="sr-only">Send message</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" showArrow><p>Send</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          </TooltipProvider>
        </div>
      </div>
    );
  }
);
PromptBox.displayName = "PromptBox";
