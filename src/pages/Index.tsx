import { useState } from "react";
import { cn } from "@/lib/utils";
import { useNavigate, Link } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreateStudySessionDialog } from "@/components/CreateStudySessionDialog";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { useAppStore } from "@/store/appStore";
import { moveSessionToFolder } from "@/services/folder-api";
import { fetchAppData, deleteStudySession } from "@/services/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, FolderPlus, ArrowRight, Upload, Trash2, AlertTriangle, BookOpen, Clock, Star, Search } from "lucide-react";

export default function Index() {
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [expandedFolder, setExpandedFolder] = useState<number | null>(null);
  const [draggedSession, setDraggedSession] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [isDeleteZoneActive, setIsDeleteZoneActive] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession, userProfile, initializeFromAPI } = useAppStore();
  const { toast } = useToast();

  const handleSessionClick = (session: any) => {
    setCurrentSession(session);
    navigate(`/dashboard/${session.id}/full-study`);
  };

  const handleDragStart = (e: React.DragEvent, sessionId: string) => {
    setDraggedSession(sessionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', sessionId);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedSession(null);
    setDropTarget(null);
    setIsDeleteZoneActive(false);
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent, folderId: number) => {
    e.preventDefault();
    e.stopPropagation();
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
      const updatedData = await fetchAppData();
      initializeFromAPI(updatedData);

      toast({
        title: "Session moved!",
        description: `"${session?.title}" moved to "${folder?.name}"`,
      });
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

  const handleDeleteZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDeleteZoneActive(true);
    setDropTarget(null);
  };

  const handleDeleteZoneDragLeave = () => {
    setIsDeleteZoneActive(false);
  };

  const handleDeleteZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sessionId = e.dataTransfer.getData('text/plain');
    if (!sessionId) return;
    setSessionToDelete(sessionId);
    setShowDeleteConfirm(true);
    setIsDeleteZoneActive(false);
    setDraggedSession(null);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      await deleteStudySession(sessionToDelete);
      const session = studySessions.find(s => s.id === sessionToDelete);
      const updatedData = await fetchAppData();
      initializeFromAPI(updatedData);
      toast({
        title: "Session deleted",
        description: `"${session?.title}" has been permanently deleted`,
      });
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast({
        title: "Failed to delete session",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setShowDeleteConfirm(false);
      setSessionToDelete(null);
    }
  };

  return (
    <>
      <div className="min-h-screen bg-background">
        <Sidebar />

        <main className="airbnb-container py-8 animate-fade-in-up">
          {/* Hero Header — Airbnb-style welcome */}
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
              <div>
                <h1 className="font-heading text-3xl md:text-4xl font-bold text-foreground tracking-tight">
                  {userProfile?.name ? `Welcome back, ${userProfile.name}` : 'Welcome back'}
                </h1>
                <p className="text-muted-foreground mt-2 text-base">
                  Pick up where you left off, or start something new
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  className="gap-2 rounded-lg border-border hover:border-foreground/30 transition-all"
                  onClick={() => setShowCreateFolder(true)}
                >
                  <FolderPlus size={16} />
                  New Folder
                </Button>
                <button
                  className="airbnb-btn-primary"
                  onClick={() => setShowCreateSession(true)}
                >
                  <Plus size={18} />
                  New Session
                </button>
              </div>
            </div>
          </div>

          {/* Folders — Airbnb category scroll */}
          {folders.length > 0 && (
            <section className="mb-10">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-heading text-xl font-semibold text-foreground">
                  Your Folders
                </h2>
                {folders.length > 5 && (
                  <Link to="/dashboard/folders">
                    <Button variant="ghost" size="sm" className="gap-1 text-sm font-medium text-foreground hover:underline">
                      Show all ({folders.length})
                      <ArrowRight size={14} />
                    </Button>
                  </Link>
                )}
              </div>

              {draggedSession && (
                <p className="text-xs text-muted-foreground mb-3">
                  Drop a session into a folder to organize it
                </p>
              )}

              <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {folders.slice(0, 6).map((folder) => {
                  const isActiveDropTarget = dropTarget === folder.id;
                  const isDragging = draggedSession !== null;

                  return (
                    <div
                      key={folder.id}
                      className={cn(
                        "group flex-shrink-0 cursor-pointer transition-all duration-200 rounded-2xl border bg-card flex flex-col items-center gap-2 text-center min-w-[120px] p-5",
                        isActiveDropTarget
                          ? "border-primary shadow-lg scale-[1.04] bg-primary/5"
                          : isDragging
                          ? "border-dashed border-muted-foreground/30 opacity-70 hover:opacity-100"
                          : "border-border hover:shadow-airbnb-hover hover:-translate-y-0.5"
                      )}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      onClick={() => {
                        if (!draggedSession) navigate(`/dashboard/folder/${folder.id}`);
                      }}
                    >
                      <div
                        className={cn(
                          "text-3xl transition-transform",
                          isActiveDropTarget ? "scale-110" : "group-hover:scale-105"
                        )}
                      >
                        {folder.icon}
                      </div>
                      <div className={cn(
                        "font-medium text-sm",
                        isActiveDropTarget ? "text-primary" : "text-foreground"
                      )}>
                        {folder.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {folder.session_count} {folder.session_count !== 1 ? 'sessions' : 'session'}
                      </div>

                      {isActiveDropTarget && (
                        <div className="flex items-center gap-1 text-xs font-semibold text-primary mt-1">
                          <Upload size={12} />
                          Drop here
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Delete Zone — shows when dragging */}
          {draggedSession && (
            <section className="mb-8">
              <div
                className={cn(
                  "group cursor-pointer transition-all duration-200 p-8 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3",
                  isDeleteZoneActive
                    ? "border-destructive bg-destructive/5 shadow-lg"
                    : "border-border hover:border-destructive/40 hover:bg-destructive/5"
                )}
                onDragOver={handleDeleteZoneDragOver}
                onDragLeave={handleDeleteZoneDragLeave}
                onDrop={handleDeleteZoneDrop}
              >
                <Trash2
                  size={isDeleteZoneActive ? 36 : 28}
                  className={cn(
                    "transition-all",
                    isDeleteZoneActive ? "text-destructive" : "text-muted-foreground"
                  )}
                />
                <div className="text-center">
                  <p className={cn(
                    "font-semibold text-sm",
                    isDeleteZoneActive ? "text-destructive" : "text-muted-foreground"
                  )}>
                    {isDeleteZoneActive ? 'Release to delete' : 'Drop here to delete'}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Study Sessions — Airbnb listing grid */}
          {studySessions.length > 0 && (
            <section className="mb-10">
              <h2 className="font-heading text-xl font-semibold text-foreground mb-5">
                Your Study Sessions
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {studySessions.map((session) => {
                  const completionPercentage = session.extractedTopics
                    ? Math.round(
                        (session.extractedTopics.filter((t: any) => t.completed).length /
                        session.extractedTopics.length) * 100
                      )
                    : session.progress;

                  const isNew = session.createdAt && (Date.now() - session.createdAt) < 48 * 60 * 60 * 1000;

                  return (
                    <div
                      key={session.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, session.id)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "airbnb-card group cursor-pointer p-0 overflow-hidden select-none",
                        draggedSession === session.id && 'opacity-50',
                        isNew && 'new-session-card'
                      )}
                      title="Drag to folder or click to open"
                    >
                      {/* Card Visual Header — gradient based on completion */}
                      <div
                        className="h-32 relative flex items-end p-4"
                        style={{
                          background: `linear-gradient(135deg, 
                            hsl(${348 - completionPercentage * 2}, 70%, 55%) 0%, 
                            hsl(${290 + completionPercentage}, 60%, 45%) 100%)`
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSessionClick(session);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        {/* Completion percentage overlay */}
                        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-bold text-white">
                          {completionPercentage}%
                        </div>

                        {isNew && (
                          <Badge className="absolute top-3 left-3 bg-white text-primary border-0 text-xs font-bold fire-badge">
                            NEW
                          </Badge>
                        )}

                        {/* Bottom gradient for text readability */}
                        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/30 to-transparent" />

                        <div className="relative z-10">
                          <BookOpen size={20} className="text-white/80" />
                        </div>
                      </div>

                      {/* Card Content */}
                      <div className="p-4">
                        <h3
                          className="font-heading font-semibold text-foreground text-base mb-1 cursor-pointer hover:text-primary transition-colors line-clamp-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSessionClick(session);
                          }}
                          onMouseDown={(e) => e.stopPropagation()}
                          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
                          style={{ userSelect: 'text' }}
                        >
                          {session.title}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-3">
                          {session.topics} topic{session.topics !== 1 ? 's' : ''}
                        </p>

                        {/* Airbnb-style progress bar */}
                        <div className="airbnb-progress">
                          <div
                            className="airbnb-progress-bar"
                            style={{ width: `${completionPercentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Empty state */}
          {studySessions.length === 0 && folders.length === 0 && (
            <section className="py-20 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
                  <BookOpen size={36} className="text-primary" />
                </div>
                <h2 className="font-heading text-2xl font-bold text-foreground mb-3">
                  Start your learning journey
                </h2>
                <p className="text-muted-foreground mb-8">
                  Upload your notes, textbooks, or any study material. We'll transform them into interactive learning experiences.
                </p>
                <button
                  className="airbnb-btn-primary text-lg px-8 py-4"
                  onClick={() => setShowCreateSession(true)}
                >
                  <Plus size={20} />
                  Create Your First Session
                </button>
              </div>
            </section>
          )}
        </main>
      </div>

      <CreateStudySessionDialog
        open={showCreateSession}
        onOpenChange={setShowCreateSession}
      />

      <CreateFolderDialog
        open={showCreateFolder}
        onOpenChange={setShowCreateFolder}
      />

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading">
              <AlertTriangle className="text-destructive" size={20} />
              Delete Study Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">"{studySessions.find(s => s.id === sessionToDelete)?.title}"</span>?
              <br /><br />
              This action cannot be undone. All questions, progress, and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" onClick={() => {
              setShowDeleteConfirm(false);
              setSessionToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-white rounded-lg"
            >
              <Trash2 size={14} className="mr-2" />
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

