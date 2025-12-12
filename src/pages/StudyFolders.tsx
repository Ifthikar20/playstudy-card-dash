import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { FolderPlus, Folder, Trash2 } from "lucide-react";

interface StudyFolder {
  id: number;
  name: string;
  fileCount: number;
  createdAt: Date;
}

export default function StudyFolders() {
  const [folders, setFolders] = useState<StudyFolder[]>([
    { id: 1, name: "Biology Notes", fileCount: 5, createdAt: new Date() },
    { id: 2, name: "Math Formulas", fileCount: 3, createdAt: new Date() },
    { id: 3, name: "History Essays", fileCount: 8, createdAt: new Date() },
  ]);

  const handleCreateFolder = () => {
    const name = prompt("Enter folder name:");
    if (name) {
      const newFolder: StudyFolder = {
        id: Date.now(),
        name,
        fileCount: 0,
        createdAt: new Date()
      };
      setFolders(prev => [...prev, newFolder]);
    }
  };

  const handleDeleteFolder = (id: number) => {
    setFolders(folders.filter(f => f.id !== id));
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-2">My Study Folders</h1>
              <p className="text-muted-foreground">Organize your study materials</p>
            </div>
            <button
              onClick={handleCreateFolder}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
            >
              <FolderPlus size={18} />
              New Folder
            </button>
          </div>

          {folders.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {folders.map((folder) => (
                <div 
                  key={folder.id}
                  className="group relative p-6 bg-card rounded-xl border border-border hover:border-primary/30 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex flex-col items-center text-center">
                    <Folder className="w-16 h-16 text-primary mb-3" />
                    <h3 className="font-semibold text-foreground mb-1">{folder.name}</h3>
                    <p className="text-sm text-muted-foreground">{folder.fileCount} files</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                    className="absolute top-3 right-3 p-2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <Folder className="w-20 h-20 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No folders yet</h3>
              <p className="text-muted-foreground text-sm mb-4">Create your first folder to organize study materials</p>
              <button
                onClick={handleCreateFolder}
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <FolderPlus size={18} />
                Create Folder
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
