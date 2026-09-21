import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Eye, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { fetchMyGuardians, parentalKeys, requestLinkCode, type LinkCodeIssued } from "@/services/parental";

/**
 * Who can see my progress.
 *
 * Read-only, and deliberately complete. A learner cannot end a guardianship —
 * that is the point of the feature — so the least they are owed is knowing
 * exactly that it exists and precisely what it covers. There is no unlink
 * button here, and the server has no endpoint behind one.
 */
export function MyGuardiansCard() {
  const { session } = useAuth();
  const [codeOpen, setCodeOpen] = useState(false);
  const { data: guardians, isLoading, refetch } = useQuery({
    queryKey: parentalKeys.guardians(),
    queryFn: fetchMyGuardians,
    staleTime: 60_000,
    retry: 1,
  });

  // A profile a guardian created cannot hand out access — someone is already
  // responsible for that account, and who else may see it is not their call.
  const isManagedChild = session?.user.account_kind === "managed_child";
  const list = guardians ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="size-4" />
          Who can see my progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-4 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nobody else can see your progress right now.
          </p>
        ) : (
          <ul className="space-y-3">
            {list.map((g) => (
              <li key={g.id} className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{g.name}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Sees your streaks, time studied and scores
                    {g.canSeeAnswerDetail && ", and the questions you answer"}
                    {g.canChangeSettings && ", and can change your study settings"}.
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {!isManagedChild && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-medium">Let a parent see my progress</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                We'll give you a short code to read out to them. They'll see how you're getting on — not your password,
                and not what you write.
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setCodeOpen(true)}>
                Get a code
              </Button>
            </div>
          </>
        )}
      </CardContent>

      <LinkCodeIssuer open={codeOpen} onOpenChange={setCodeOpen} onIssued={() => refetch()} />
    </Card>
  );
}

const CURRENT_YEAR = new Date().getFullYear();

function LinkCodeIssuer({
  open,
  onOpenChange,
  onIssued,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIssued: () => void;
}) {
  const [birthYear, setBirthYear] = useState("");
  const [needsYear, setNeedsYear] = useState(false);
  const [issued, setIssued] = useState<LinkCodeIssued | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const reset = () => {
    setBirthYear("");
    setNeedsYear(false);
    setIssued(null);
    setCopied(false);
  };

  async function generate() {
    setIsBusy(true);
    try {
      const year = birthYear.trim() ? Number(birthYear.trim()) : null;
      setIssued(await requestLinkCode(year));
      setNeedsYear(false);
      onIssued();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Please try again.";
      // The server asks for a birth year the first time, because it is what
      // the link's end date is worked out from.
      if (/birth year/i.test(message)) {
        setNeedsYear(true);
      } else {
        toast({ title: "Couldn't get a code", description: message, variant: "destructive" });
      }
    } finally {
      setIsBusy(false);
    }
  }

  async function copy() {
    if (!issued) return;
    try {
      await navigator.clipboard.writeText(issued.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* reading it out is the point anyway */
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
        <DialogHeader>
          <DialogTitle className="text-xl">Let a parent see my progress</DialogTitle>
          <DialogDescription>
            {issued
              ? "Read this out to them. It works once, and only for the next few minutes."
              : "They'll be able to see your streaks, time studied and scores. You can't undo this yourself, so only share it with someone you mean to."}
          </DialogDescription>
        </DialogHeader>

        {issued ? (
          <>
            <div className="rounded-2xl border border-border bg-muted/40 py-6 text-center">
              <p className="font-mono text-2xl font-semibold tracking-[0.25em]">{issued.code}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Expires in about {Math.max(1, Math.round(issued.expiresInSeconds / 60))} minutes
              </p>
            </div>
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy code"}
            </Button>
          </>
        ) : (
          needsYear && (
            <div className="space-y-2">
              <Label htmlFor="birth-year">What year were you born?</Label>
              <Input
                id="birth-year"
                autoFocus
                inputMode="numeric"
                maxLength={4}
                placeholder={String(CURRENT_YEAR - 14)}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && generate()}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                So the link ends automatically when you turn 18.
              </p>
            </div>
          )
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            {issued ? "Done" : "Cancel"}
          </Button>
          {!issued && (
            <Button onClick={generate} disabled={isBusy || (needsYear && birthYear.length !== 4)}>
              {isBusy ? "Getting a code…" : "Get a code"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
