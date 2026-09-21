import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Printer } from "lucide-react";
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
import { createChild, parentalKeys, type ChildCreated } from "@/services/parental";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PIN_LENGTH = 6;
const CURRENT_YEAR = new Date().getFullYear();

/** Mirrors validate_pin in app/core/child_auth.py so the message arrives before the round trip. */
function pinProblem(pin: string): string | null {
  if (!/^\d*$/.test(pin)) return "Numbers only";
  if (pin.length !== PIN_LENGTH) return null; // not finished typing yet
  if (new Set(pin).size === 1) return "Not all the same digit";
  const digits = [...pin].map(Number);
  const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]));
  if (steps.size === 1 && (steps.has(1) || steps.has(-1))) return "Not a run like 123456";
  if (pin.slice(0, 3) === pin.slice(3)) return "Not a repeated pattern";
  return null;
}

export function AddChildDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [pin, setPin] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [created, setCreated] = useState<ChildCreated | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const problem = pinProblem(pin);
  const canSubmit = name.trim().length > 0 && pin.length === PIN_LENGTH && !problem && !isSaving;

  const reset = () => {
    setName("");
    setPin("");
    setBirthYear("");
    setCreated(null);
    setCopied(false);
  };

  async function handleCreate() {
    if (!canSubmit) return;
    setIsSaving(true);
    try {
      const year = birthYear.trim() ? Number(birthYear.trim()) : null;
      const result = await createChild({ name: name.trim(), pin, birthYear: year });
      await queryClient.invalidateQueries({ queryKey: parentalKeys.children() });
      setCreated(result);
    } catch (error) {
      toast({
        title: "Couldn't add the profile",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function copyCredentials() {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(
        `AnotherNotes sign-in for ${created.child.name}\nGo to: ${window.location.origin}/kids\nName: ${created.username}\nPIN: ${created.pin}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Couldn't copy", description: "Write the details down instead.", variant: "destructive" });
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">{created.child.name} is ready</DialogTitle>
              <DialogDescription>
                Write these down now — the PIN is stored scrambled, so we can't show it again. You can always set a new one.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <dl className="space-y-3 text-sm">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Go to</dt>
                  <dd className="font-medium">{window.location.host}/kids</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">Name</dt>
                  <dd className="font-mono text-base font-semibold tracking-tight">{created.username}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">PIN</dt>
                  <dd className="font-mono text-base font-semibold tracking-[0.2em]">{created.pin}</dd>
                </div>
              </dl>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyCredentials}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => window.print()}>
                <Printer className="size-4" />
                Print
              </Button>
            </div>

            <DialogFooter>
              <Button
                onClick={() => {
                  reset();
                  onOpenChange(false);
                }}
              >
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">Add a child</DialogTitle>
              <DialogDescription>
                No email needed. We'll make a sign-in name, and you choose the PIN.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="child-name">Their first name</Label>
                <Input
                  id="child-name"
                  autoFocus
                  placeholder="e.g. Ava"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="child-pin">A 6-digit PIN</Label>
                <Input
                  id="child-pin"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="······"
                  maxLength={PIN_LENGTH}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  className="h-11 font-mono text-base tracking-[0.3em]"
                />
                <p className="text-xs text-muted-foreground">
                  {problem ?? "Something they'll remember, but not 123456 or their birthday."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="child-year">
                  Birth year <span className="font-normal text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="child-year"
                  inputMode="numeric"
                  placeholder={String(CURRENT_YEAR - 10)}
                  maxLength={4}
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">Helps us pitch the material at the right level.</p>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!canSubmit}>
                {isSaving ? "Adding…" : "Add child"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
