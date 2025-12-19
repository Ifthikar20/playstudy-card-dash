import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import UserMenu from "@/components/UserMenu";
import { useAppStore } from "@/store/appStore";
import { Plus, FolderPlus, Folder as FolderIcon } from "lucide-react";

export default function Index() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<number | null>(null);
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession } = useAppStore();

  const handleSessionClick = (session: any) => {
    setCurrentSession(session);
    navigate(`/dashboard/${session.id}/full-study`);
  };


  return (
    <>
      <style>{`
        @keyframes fire-flicker {
          0%, 100% { opacity: 1; transform: scale(1); }
          25% { opacity: 0.9; transform: scale(1.05); }
          50% { opacity: 0.95; transform: scale(1.02); }
          75% { opacity: 0.92; transform: scale(1.08); }
        }
        .fire-badge {
          animation: fire-flicker 2s ease-in-out infinite;
        }
      `}</style>
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
      
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
                Welcome Back!
              </h1>
              <p className="text-muted-foreground">
                Transform your study materials into engaging, competitive quizzes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                size="default"
                variant="outline"
                className="gap-2"
                onClick={() => setShowCreateFolder(true)}
              >
                <FolderPlus size={18} />
                New Folder
              </Button>
              <Button
                size="lg"
                className="gap-2 shadow-lg hover:shadow-xl transition-all"
                onClick={() => setShowCreateSession(true)}
              >
                <Plus size={20} />
                Create Study Session
              </Button>
              <UserMenu />
            </div>
          </div>

          {/* Folders */}
          {folders.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                📁 My Folders
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {folders.map((folder) => (
                  <div
                    key={folder.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors p-4 rounded-lg border border-border flex flex-col items-center gap-2 text-center"
                    style={{ borderLeftColor: folder.color, borderLeftWidth: '4px' }}
                    onClick={() => setExpandedFolder(expandedFolder === folder.id ? null : folder.id)}
                  >
                    <div className="text-3xl">{folder.icon}</div>
                    <div className="font-semibold text-sm">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folder.session_count} session{folder.session_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My Study Sessions */}
          {studySessions.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                My Study Sessions
              </h2>
              <div className="space-y-2">
                {studySessions.map((session) => {
                  // Calculate completion percentage from extractedTopics if available
                  const completionPercentage = session.extractedTopics
                    ? Math.round(
                        (session.extractedTopics.filter(t => t.completed).length /
                        session.extractedTopics.length) * 100
                      )
                    : session.progress;

                  // Show NEW badge for sessions created within the last 48 hours
                  const isNew = session.createdAt && (Date.now() - session.createdAt) < 48 * 60 * 60 * 1000;

                  return (
                    <div
                      key={session.id}
                      className="cursor-pointer hover:bg-accent/50 transition-colors p-3 rounded-lg border border-border"
                      onClick={() => handleSessionClick(session)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-foreground">
                          {session.title}
                        </div>
                        {isNew && (
                          <div className="relative">
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-2 py-0.5 h-5 font-bold bg-gradient-to-r from-orange-500 to-red-500 border-0 fire-badge"
                            >
                              🔥 NEW
                            </Badge>
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500"></span>
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {session.topics} topic{session.topics !== 1 ? 's' : ''} • {completionPercentage}% complete
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>
      </div>

      <CreateStudySessionDialog
        open={showCreateSession}
        onOpenChange={setShowCreateSession}
      />

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
      />
      </div>
    </>
  );
}
