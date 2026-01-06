"use client";;
import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupText,
} from "@/components/ui/button-group";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import React, { Component, createContext, memo, useContext, useEffect, useMemo, useState } from "react";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Streamdown } from "streamdown";
import { CodeBlock, CodeBlockCopyButton } from "./code-block";

class StreamdownErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Streamdown error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
       // Fallback to plain text rendering if Streamdown fails
      return (
        <div className="whitespace-pre-wrap font-mono text-sm">
           {this.props.fallbackContent}
        </div>
      );
    }
    return this.props.children;
  }
}

export const Message = ({
  className,
  from,
  ...props
}) => (
  <div
    className={cn(
      "group flex w-full max-w-[95%] flex-col gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props} />
);

export const MessageContent = ({
  children,
  className,
  ...props
}) => (
  <div
    className={cn(
      "is-user:dark flex w-full max-w-full min-w-0 flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:ml-auto group-[.is-user]:w-fit group-[.is-user]:rounded-lg group-[.is-user]:bg-secondary group-[.is-user]:px-4 group-[.is-user]:py-3 group-[.is-user]:text-foreground",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}>
    {children}
  </div>
);

export const MessageActions = ({
  className,
  children,
  ...props
}) => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

export const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}) => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
      {children}
      <span className="sr-only">{label || tooltip}</span>
    </Button>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};

const MessageBranchContext = createContext(null);

const useMessageBranch = () => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error("MessageBranch components must be used within MessageBranch");
  }

  return context;
};

export const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  ...props
}) => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState([]);

  const handleBranchChange = (newBranch) => {
    setCurrentBranch(newBranch);
    onBranchChange?.(newBranch);
  };

  const goToPrevious = () => {
    const newBranch =
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  };

  const goToNext = () => {
    const newBranch =
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
    handleBranchChange(newBranch);
  };

  const contextValue = {
    currentBranch,
    totalBranches: branches.length,
    goToPrevious,
    goToNext,
    branches,
    setBranches,
  };

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div className={cn("grid w-full gap-2 [&>div]:pb-0", className)} {...props} />
    </MessageBranchContext.Provider>
  );
};

export const MessageBranchContent = ({
  children,
  ...props
}) => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = Array.isArray(children) ? children : [children];

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index) => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        index === currentBranch ? "block" : "hidden"
      )}
      key={branch.key}
      {...props}>
      {branch}
    </div>
  ));
};

export const MessageBranchSelector = ({
  className,
  from,
  ...props
}) => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
    return null;
  }

  return (
    <ButtonGroup
      className="[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md"
      orientation="horizontal"
      {...props} />
  );
};

export const MessageBranchPrevious = ({
  children,
  ...props
}) => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}>
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};

export const MessageBranchNext = ({
  children,
  className,
  ...props
}) => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}>
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};

export const MessageBranchPage = ({
  className,
  ...props
}) => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn("border-none bg-transparent text-muted-foreground shadow-none", className)}
      {...props}>
      {currentBranch + 1}of {totalBranches}
    </ButtonGroupText>
  );
};

export const MessageResponse = memo(({
  className,
  children,
  ...props
}) => {
  const components = useMemo(() => ({
    code({ className, children, ...props }) {
      const match = /language-(\w+)/.exec(className || "");
      return match ? (
        <CodeBlock
          code={String(children).replace(/\n$/, "")}
          language={match[1]}
          {...props}>
          <CodeBlockCopyButton />
        </CodeBlock>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    },
  }), []);

  const remarkPlugins = useMemo(() => [remarkGfm, remarkMath], []);
  const rehypePlugins = useMemo(() => [rehypeKatex], []);

  return (
    <StreamdownErrorBoundary fallbackContent={children}>
      <Streamdown
        className={cn("size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0", className)}
        components={components}
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        {...props}>
        {children}
      </Streamdown>
    </StreamdownErrorBoundary>
  );
}, (prevProps, nextProps) => prevProps.children === nextProps.children);

MessageResponse.displayName = "MessageResponse";

export function MessageAttachment({
  data,
  className,
  onRemove,
  ...props
}) {
  const filename = data.filename || "";
  const mediaType =
    data.mediaType?.startsWith("image/") && data.url ? "image" : "file";
  const isImage = mediaType === "image";
  const attachmentLabel = filename || (isImage ? "Image" : "Attachment");

  return (
    <div
      className={cn("group relative size-24 overflow-hidden rounded-lg", className)}
      {...props}>
      {isImage ? (
        <>
          <img
            alt={filename || "attachment"}
            className="size-full object-cover"
            height={100}
            src={data.url}
            width={100} />
          {onRemove && (
            <Button
              aria-label="Remove attachment"
              className="absolute top-2 right-2 size-6 rounded-full bg-background/80 p-0 opacity-0 backdrop-blur-sm transition-opacity hover:bg-background group-hover:opacity-100 [&>svg]:size-3"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              variant="ghost">
              <XIcon />
              <span className="sr-only">Remove</span>
            </Button>
          )}
        </>
      ) : (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className="flex size-full shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <PaperclipIcon className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{attachmentLabel}</p>
            </TooltipContent>
          </Tooltip>
          {onRemove && (
            <Button
              aria-label="Remove attachment"
              className="size-6 shrink-0 rounded-full p-0 opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100 [&>svg]:size-3"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              type="button"
              variant="ghost">
              <XIcon />
              <span className="sr-only">Remove</span>
            </Button>
          )}
        </>
      )}
    </div>
  );
}

export function MessageAttachments({
  children,
  className,
  ...props
}) {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn("ml-auto flex w-fit flex-wrap items-start gap-2", className)}
      {...props}>
      {children}
    </div>
  );
}

export const MessageToolbar = ({
  className,
  children,
  ...props
}) => (
  <div
    className={cn("mt-4 flex w-full items-center justify-between gap-4", className)}
    {...props}>
    {children}
  </div>
);
