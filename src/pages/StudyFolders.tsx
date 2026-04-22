import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { FolderPlus, Folder } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { Button } from "@/components/ui/button";

export default function StudyFolders() {
  const { folders } = useAppStore();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="min-h-screen bg-background">
        <Sidebar />

        <main className="airbnb-container py-8 animate-fade-in-up">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-heading text-3xl font-bold text-foreground mb-1">My Folders</h1>
              <p className="text-muted-foreground text-sm">Organize your study materials into collections</p>
            </div>
            <button
              onClick={() => setShowCreateFolder(true)}
              className="airbnb-btn-primary text-sm gap-2"
            >
              <FolderPlus size={16} />
              New Folder
            </button>
          </div>

          {folders.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
              {folders.map((folder) => (
                <div
                  key={folder.id}
                  className="airbnb-card border border-border cursor-pointer p-6 flex flex-col items-center gap-3 text-center"
                  onClick={() => navigate(`/dashboard/folder/${folder.id}`)}
                >
                  <div
                    className="text-4xl"
                    style={{ filter: `drop-shadow(0 2px 8px ${folder.color}30)` }}
                  >
                    {folder.icon}
                  </div>
                  <div className="font-heading font-semibold text-sm text-foreground">{folder.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {folder.session_count} session{folder.session_count !== 1 ? 's' : ''}
                  </div>
                  {/* Color accent line */}
                  <div className="w-8 h-1 rounded-full mt-1" style={{ backgroundColor: folder.color }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 max-w-sm mx-auto">
              <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
                <Folder className="w-10 h-10 text-muted-foreground" />
              </div>
              <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No folders yet</h3>
              <p className="text-muted-foreground text-sm mb-6">Create your first folder to organize study materials</p>
              <button
                onClick={() => setShowCreateFolder(true)}
                className="airbnb-btn-primary text-sm gap-2"
              >
                <FolderPlus size={16} />
                Create Folder
              </button>
            </div>
          )}
        </main>
      </div>

      <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} />
    </>
  );
}
