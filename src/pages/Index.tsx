import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import UserMenu from "@/components/UserMenu";
import { useAppStore } from "@/store/appStore";
import { moveSessionToFolder } from "@/services/folder-api";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderPlus, Folder as FolderIcon, ArrowRight } from "lucide-react";

export default function Index() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<number | null>(null);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession, userProfile } = useAppStore();
  const { toast } = useToast();

  const handleSessionClick = (session: any) => {
    setCurrentSession(session);
    navigate(`/dashboard/${session.id}/full-study`);
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDraggedSession(sessionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sessionId);
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedSession(null);
    setDropTarget(null);
    // Reset visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(folderId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = e.dataTransfer.getData('text/plain');

    if (!sessionId) return;

    try {
      await moveSessionToFolder(sessionId, folderId);

      const session = studySessions.find(s => s.id === sessionId);
      const folder = folders.find(f => f.id === folderId);

      toast({
        title: "Session moved!",
        description: `"${session?.title}" moved to "${folder?.name}"`,
      });

      // Refresh the page data
      window.location.reload();
    } catch (error) {
      console.error('Failed to move session:', error);
      toast({
        title: "Failed to move session",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setDraggedSession(null);
      setDropTarget(null);
    }
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
                {userProfile?.name ? `Welcome Back, ${userProfile.name}!` : 'Welcome Back!'}
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

          {/* Folders - Show first 5 */}
          {folders.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-foreground">
                  📁 My Folders
                </h2>
                {folders.length > 5 && (
                  <Link to="/folders">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                      View All ({folders.length})
                      <ArrowRight size={16} />
                    </Button>
                  </Link>
                )}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {folders.slice(0, 5).map((folder) => (
                  <div
                    key={folder.id}
                    className={`flex-shrink-0 cursor-pointer hover:bg-accent/50 transition-all p-3 rounded-lg border-2 flex flex-col items-center gap-1.5 text-center min-w-[100px] ${
                      dropTarget === folder.id
                        ? 'border-primary bg-primary/10 scale-105'
                        : 'border-border'
                    }`}
                    style={{
                      borderLeftColor: folder.color,
                      borderLeftWidth: dropTarget === folder.id ? '4px' : '3px',
                    }}
                    onDragOver={(e) => handleDragOver(e, folder.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, folder.id)}
                    onClick={(e) => {
                      if (!draggedSession) {
                        navigate('/folders');
                      }
                    }}
                  >
                    <div className="text-2xl">{folder.icon}</div>
                    <div className="font-semibold text-xs truncate w-full">{folder.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {folder.session_count} {folder.session_count !== 1 ? 'sessions' : 'session'}
                    </div>
                    {dropTarget === folder.id && (
                      <div className="text-[10px] text-primary font-semibold mt-1">Drop here</div>
                    )}
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
                      draggable
                      onDragStart={(e) => handleDragStart(e, session.id)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-move hover:bg-accent/50 transition-colors p-3 rounded-lg border border-border ${isNew ? 'new-session-card' : ''} ${
                        draggedSession === session.id ? 'opacity-50' : ''
                      }`}
                      onClick={(e) => {
                        if (!draggedSession) {
                          handleSessionClick(session);
                        }
                      }}
                      title="Drag to folder or click to open"
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
