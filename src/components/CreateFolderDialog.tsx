import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createFolder } from "@/services/folder-api";
import { useAppStore } from "@/store/appStore";
import { useToast } from "@/hooks/use-toast";
import { FolderPlus } from "lucide-react";

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const FOLDER_COLORS = [
  { name: "Blue", value: "#3B82F6" },
  { name: "Green", value: "#10B981" },
  { name: "Purple", value: "#8B5CF6" },
  { name: "Red", value: "#EF4444" },
  { name: "Yellow", value: "#F59E0B" },
  { name: "Pink", value: "#EC4899" },
];

const FOLDER_ICONS = ["📁", "📂", "🗂️", "📚", "📖", "🎯", "⭐", "💼"];

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3B82F6");
  const [selectedIcon, setSelectedIcon] = useState("📁");
  const [isCreating, setIsCreating] = useState(false);
  const { addFolder } = useAppStore();
  const { toast } = useToast();

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a folder name",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const newFolder = await createFolder(name.trim(), selectedColor, selectedIcon);
      addFolder(newFolder);

      toast({
        title: "Folder created!",
        description: `"${name}" has been created successfully.`,
      });

      // Reset and close
      setName("");
      setSelectedColor("#3B82F6");
      setSelectedIcon("📁");
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Failed to create folder",
        description: error.message || "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderPlus size={20} />
            Create New Folder
          </DialogTitle>
          <DialogDescription>
            Organize your study sessions with folders
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Folder Name */}
          <div className="space-y-2">
            <Label htmlFor="folder-name">Folder Name</Label>
            <Input
              id="folder-name"
              placeholder="e.g., Mathematics, Science, History"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            />
          </div>

          {/* Icon Selector */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_ICONS.map((icon) => (
                <Button
                  key={icon}
                  variant={selectedIcon === icon ? "default" : "outline"}
                  size="sm"
                  className="w-10 h-10 text-xl p-0"
                  onClick={() => setSelectedIcon(icon)}
                >
                  {icon}
                </Button>
              ))}
            </div>
          </div>

          {/* Color Selector */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {FOLDER_COLORS.map((color) => (
                <Button
                  key={color.value}
                  variant={selectedColor === color.value ? "default" : "outline"}
                  size="sm"
                  className="w-auto px-3"
                  style={{
                    backgroundColor: selectedColor === color.value ? color.value : undefined,
                    borderColor: color.value,
                  }}
                  onClick={() => setSelectedColor(color.value)}
                >
                  {color.name}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating || !name.trim()}>
            {isCreating ? "Creating..." : "Create Folder"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
