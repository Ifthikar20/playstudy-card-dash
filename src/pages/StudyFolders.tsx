
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";
import { Book, Plus } from "lucide-react";

// User's uploaded study folders - starts empty
const [folders, setFolders] = useState<Array<{ id: number; name: string; createdAt: Date }>>([]);

export default function StudyFolders() {
  const navigate = useNavigate();
  const [folderName, setFolderName] = useState("");
  const [userFolders, setUserFolders] = useState<Array<{ id: number; name: string; createdAt: Date }>>([]);

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      const newFolder = {
        id: Date.now(),
        name: folderName.trim(),
        createdAt: new Date()
      };
      setUserFolders([...userFolders, newFolder]);
      setFolderName("");
    }
  };

  const handleFolderClick = (folderName: string) => {
    navigate(`/quiz/${folderName.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">My Study Folders</h1>
            <p className="text-muted-foreground">Your collection of uploaded study materials</p>
          </div>

          {/* Create new folder */}
          <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Study Folder</h2>
            <div className="flex space-x-4">
              <input
                type="text"
                placeholder="Enter folder name..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleCreateFolder}
                className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus size={20} className="mr-2" />
                Create
              </button>
            </div>
          </div>

          {/* User folders grid */}
          {userFolders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userFolders.map((folder) => (
                <DashboardCard
                  key={folder.id}
                  title={folder.name}
                  description={`Created ${folder.createdAt.toLocaleDateString()}`}
                  icon={Book}
                  onClick={() => handleFolderClick(folder.name)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <Book className="w-16 h-16 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-foreground mb-2">No study folders yet</h3>
              <p className="text-muted-foreground">Create your first folder above to start organizing your study materials</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
