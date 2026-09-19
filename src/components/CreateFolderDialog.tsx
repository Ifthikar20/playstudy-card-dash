import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check } from "lucide-react";
import { createFolder } from "@/services/folder-api";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { FOLDER_COVERS, COVER_PREFIX } from "@/lib/folderCovers";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEFAULT_COVER = FOLDER_COVERS[0].id;

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [coverId, setCoverId] = useState(DEFAULT_COVER);
  const [isCreating, setIsCreating] = useState(false);
  const { addFolder } = useAppStore();
  const { toast } = useToast();

  const cover = FOLDER_COVERS.find((c) => c.id === coverId) ?? FOLDER_COVERS[0];

  const reset = () => {
    setName("");
    setCoverId(DEFAULT_COVER);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ title: "Name required", description: "Give your folder a name.", variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      // Store the cover choice in `icon` ("cover:c1"); the accent colour rides
      // along in `color` for spines, progress bars and tints.
      const newFolder = await createFolder(name.trim(), cover.accent, `${COVER_PREFIX}${cover.id}`);
      addFolder(newFolder);
      toast({ title: "Folder created", description: `"${name.trim()}" is ready.` });
      reset();
      onOpenChange(false);
    } catch (error) {
      toast({
        title: "Couldn't create the folder",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl">New folder</DialogTitle>
          <DialogDescription>Give it a name and a cover — it'll sit on your shelf like a book.</DialogDescription>
        </DialogHeader>

        {/* Live preview + name */}
        <div
          className="mt-1 flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
          style={{ backgroundImage: `linear-gradient(150deg, ${cover.accent}22, transparent 62%)` }}
        >
          <span
            className="relative h-[4.75rem] w-[3.75rem] shrink-0 overflow-hidden rounded-md bg-cover bg-center shadow-md ring-1 ring-inset ring-black/15"
            style={{ backgroundImage: `url(${cover.src})` }}
          />
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="folder-name" className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Folder name
            </Label>
            <Input
              id="folder-name"
              autoFocus
              placeholder="e.g. Organic Chemistry"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="h-11 text-base"
            />
            <p className="truncate text-xs text-muted-foreground">
              {name.trim() || "Your folder"} · 0 sessions
            </p>
          </div>
        </div>

        {/* Cover picker */}
        <div className="space-y-3">
          <Label className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">Cover</Label>
          <div className="grid grid-cols-5 gap-2.5 sm:grid-cols-7">
            {FOLDER_COVERS.map((c) => {
              const active = c.id === coverId;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Cover ${c.id}`}
                  onClick={() => setCoverId(c.id)}
                  className="relative aspect-[3/4] overflow-hidden rounded-lg bg-cover bg-center ring-1 ring-inset ring-black/10 transition-transform hover:scale-[1.05]"
                  style={{ backgroundImage: `url(${c.src})`, ...(active ? { boxShadow: `0 0 0 2px hsl(var(--background)), 0 0 0 4px ${c.accent}` } : {}) } as React.CSSProperties}
                >
                  {active && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                      <Check className="size-5 text-white drop-shadow" strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? "Creating…" : "Create folder"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
