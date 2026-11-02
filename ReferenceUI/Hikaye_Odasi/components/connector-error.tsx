import { LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { connectorErrorRecovery } from "@/lib/connector-errors.mjs";

/** Render in the affected feature, leaving the rest of the Site usable. */
export function ConnectorError({
  error,
  connectorName,
  reconnectHref,
}: {
  error: { status: string; message: string };
  connectorName: string;
  reconnectHref: string;
}) {
  const recovery = connectorErrorRecovery(error, connectorName, reconnectHref);
  return (
    <div
      role="alert"
      className="flex min-w-0 flex-col items-start gap-3 text-sm"
    >
      <p className="break-words">{recovery.message}</p>
      {recovery.action && (
        <Button
          asChild
          variant="outline"
          className="h-auto min-h-9 max-w-full whitespace-normal text-left"
        >
          <a href={recovery.action.href} target="_top">
            <LinkIcon aria-hidden="true" />
            <span className="min-w-0 break-words">{recovery.action.label}</span>
          </a>
        </Button>
      )}
    </div>
  );
}
