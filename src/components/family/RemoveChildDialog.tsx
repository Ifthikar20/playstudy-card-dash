import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { deleteChild, parentalKeys, releaseGuardianship, type ChildDetail } from "@/services/parental";

/**
 * Two different actions behind one button, because they are two different
 * situations. A profile this account created is deleted outright. An account
 * the learner owns is only unfollowed — the account itself is untouched.
 */
export function RemoveChildDialog({
  child,
  open,
  onOpenChange,
}: {
  child: ChildDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const owned = child.guardianship.origin === "created";
  const [confirm, setConfirm] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const canConfirm = !isBusy && (!owned || confirm.trim().toLowerCase() === (child.username ?? "").toLowerCase());

  async function run() {
    if (!canConfirm) return;
    setIsBusy(true);
    try {
      if (owned) {
        await deleteChild(child.id, child.username ?? "");
        toast({ title: `${child.name}'s profile was deleted` });
      } else {
        await releaseGuardianship(child.id);
        toast({ title: `You've stopped following ${child.name}` });
      }
      await queryClient.invalidateQueries({ queryKey: parentalKeys.children() });
      onOpenChange(false);
      navigate("/dashboard/family", { replace: true });
    } catch (error) {
      toast({
        title: "Couldn't do that",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setConfirm("");
        onOpenChange(o);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{owned ? `Delete ${child.name}'s profile?` : `Stop following ${child.name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {owned
              ? "Their sessions, notes and progress go with it. This can't be undone."
              : "Their account carries on as normal. You'd need a new code from them to reconnect."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {owned && (
          <div className="space-y-2">
            <Label htmlFor="confirm-username">
              Type <span className="font-mono font-semibold">{child.username}</span> to confirm
            </Label>
            <Input
              id="confirm-username"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-11 font-mono"
            />
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isBusy}>Cancel</AlertDialogCancel>
          <Button variant="destructive" onClick={run} disabled={!canConfirm}>
            {isBusy ? "Working…" : owned ? "Delete profile" : "Stop following"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
