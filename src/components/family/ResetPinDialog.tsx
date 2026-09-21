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
import { parentalKeys, resetChildPin, type ChildDetail } from "@/services/parental";

export function ResetPinDialog({
  child,
  open,
  onOpenChange,
}: {
  child: ChildDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pin, setPin] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  async function save() {
    if (pin.length !== 6) return;
    setIsSaving(true);
    try {
      await resetChildPin(child.id, pin);
      await queryClient.invalidateQueries({ queryKey: parentalKeys.child(child.id) });
      toast({
        title: "New PIN set",
        description: `${child.name} will need to sign in again with ${pin}.`,
      });
      setPin("");
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't set the PIN",
        description: error instanceof Error ? error.message : "Please try again.",
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
        if (!o) setPin("");
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl">New PIN for {child.name}</DialogTitle>
          <DialogDescription>
            This signs them out everywhere. Tell them the new PIN before they next sit down.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="new-pin">6-digit PIN</Label>
          <Input
            id="new-pin"
            autoFocus
            inputMode="numeric"
            autoComplete="off"
            placeholder="······"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && save()}
            className="h-11 font-mono text-base tracking-[0.3em]"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pin.length !== 6 || isSaving}>
            {isSaving ? "Setting…" : "Set PIN"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
