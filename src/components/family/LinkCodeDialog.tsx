import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { parentalKeys, redeemLinkCode } from "@/services/parental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Connect to a learner who already has their own account.
 *
 * They generate the code and read it to you — it only works that way round,
 * which is what makes the link something they agreed to rather than something
 * done to them. See app/core/guardianship.py.
 */
export function LinkCodeDialog({ open, onOpenChange }: Props) {
  const [code, setCode] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const normalized = code.toLowerCase().replace(/[^a-z0-9]/g, "");
  const canSubmit = normalized.length === 8 && !isSaving;

  async function handleRedeem() {
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const { child } = await redeemLinkCode(normalized);
      await queryClient.invalidateQueries({ queryKey: parentalKeys.children() });
      toast({ title: `You're now following ${child.name}`, description: "You'll see their progress, streaks and time spent." });
      setCode("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't use that code",
        description: error instanceof Error ? error.message : "Ask them to generate a new one.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setCode("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">Connect an account</DialogTitle>
          <DialogDescription>
            Ask them to open Profile &amp; Settings and tap "Let a parent see my progress". They'll get a code to read out.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="link-code">Their code</Label>
          <Input
            id="link-code"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="k3m9-qp7t"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRedeem()}
            className="h-11 font-mono text-base tracking-[0.2em]"
          />
          <p className="text-xs text-muted-foreground">
            Codes last about ten minutes. You'll see their progress — not their password, and not their written work.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={handleRedeem} disabled={!canSubmit}>
            {isSaving ? "Connecting…" : "Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
