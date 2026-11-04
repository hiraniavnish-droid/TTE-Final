import React from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "./Button";
import { cn } from "../../utils/helpers";

export function EmptyState({
  title,
  description,
  icon: Icon = FolderOpen,
  action,
  compact = false,
  error = false,
}: {
  title: string;
  description: string;
  icon?: React.ElementType;
  action?: { label: string; onClick: () => void };
  compact?: boolean;
  error?: boolean;
}) {
  return (
    <div
      className={cn(
        "ui-empty-state",
        compact && "is-compact",
        error && "is-error",
      )}
      role={error ? "alert" : undefined}
    >
      <span className="ui-empty-art" aria-hidden="true">
        <span />
        <Icon size={25} />
        <span />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <Button variant="secondary" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
