import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { FolderPlus, Folder, Trash2 } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { Button } from "@/components/ui/button";

export default function StudyFolders() {
  const { folders } = useAppStore();
  const [showCreateFolder, setShowCreateFolder] = useState(false);

  return (
    <>
      <div className="min-h-screen bg-background flex">
        <Sidebar />

        <div className="flex-1 p-8">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground mb-2">My Study Folders</h1>
                <p className="text-muted-foreground">Organize your study materials</p>
              </div>
              <Button
                onClick={() => setShowCreateFolder(true)}
                className="gap-2"
              >
                <FolderPlus size={18} />
                New Folder
              </Button>
            </div>

            {folders.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors p-4 rounded-lg border border-border flex flex-col items-center gap-2 text-center"
                    style={{ borderLeftColor: folder.color, borderLeftWidth: '4px' }}
                  >
                    <div className="text-4xl">{folder.icon}</div>
                    <div className="font-semibold text-sm">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folder.session_count} session{folder.session_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16 bg-card rounded-xl border border-border">
                <Folder className="w-20 h-20 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">No folders yet</h3>
                <p className="text-muted-foreground text-sm mb-4">Create your first folder to organize study materials</p>
                <Button
                  onClick={() => setShowCreateFolder(true)}
                  className="gap-2"
                >
                  <FolderPlus size={18} />
                  Create Folder
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} />
    </>
  );
}
