import { useState } from "react";
import { Loader2, Plus, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { ChildCard } from "@/components/family/ChildCard";
import { AddChildDialog } from "@/components/family/AddChildDialog";
import { LinkCodeDialog } from "@/components/family/LinkCodeDialog";
import { useChildren } from "@/hooks/useChildren";

/**
 * Family — the learners this account follows.
 *
 * Two ways in, because they are genuinely different situations. "Add a child"
 * creates a profile this account owns: no email, signs in with a username and
 * a PIN. "Connect an account" attaches to a learner who already has their own
 * account and handed over a code — they keep their password, and this account
 * only gains visibility.
 */
export default function FamilyPage() {
  const { data: children, isLoading, isError, refetch } = useChildren();
  const [addOpen, setAddOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Family</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            See how your learners are getting on.
          </p>
        </div>
        {children && children.length > 0 && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLinkOpen(true)}>
              <UserPlus className="size-4" />
              Connect an account
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" />
              Add a child
            </Button>
          </div>
        )}
      </header>

      {isLoading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}

      {isError && !isLoading && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm font-semibold">Couldn't load your family</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {children && children.length === 0 && (
        <EmptyState
          icon={<Users />}
          title="No learners yet"
          body="Create a profile for a child — they sign in with a name and a PIN, no email needed. Or connect to someone who already has their own AnotherNotes account."
          ctaLabel="Add a child"
          onCta={() => setAddOpen(true)}
        />
      )}

      {children && children.length === 0 && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account to connect?{" "}
          <button type="button" onClick={() => setLinkOpen(true)} className="font-medium text-foreground underline underline-offset-2">
            Enter their code
          </button>
        </p>
      )}

      {children && children.length > 0 && (
        <div className="space-y-3">
          {children.map((child) => (
            <ChildCard key={child.id} child={child} />
          ))}
        </div>
      )}

      <AddChildDialog open={addOpen} onOpenChange={setAddOpen} />
      <LinkCodeDialog open={linkOpen} onOpenChange={setLinkOpen} />
    </div>
  );
}
