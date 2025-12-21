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
import { Plus, FolderPlus, Folder as FolderIcon, ArrowRight, Upload, Trash2, AlertTriangle } from "lucide-react";

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
    // Add visual feedback
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = '0.5';
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedSession(null);
    setDropTarget(null);
    setIsDeleteZoneActive(false);
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

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the folder (not just moving to a child element)
    const target = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;
    if (!target.contains(relatedTarget)) {
      setDropTarget(null);
    }
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

      // Refresh data seamlessly without page reload
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
    setDropTarget(null); // Clear folder drop target
  };

  const handleDeleteZoneDragLeave = (e: React.DragEvent) => {
    // Only clear if we're actually leaving the delete zone
    const target = e.currentTarget;
    const relatedTarget = e.relatedTarget as Node;
    if (!target.contains(relatedTarget)) {
      setIsDeleteZoneActive(false);
    }
  };

  const handleDeleteZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const sessionId = e.dataTransfer.getData('text/plain');
    if (!sessionId) return;

    // Set session to delete and show confirmation
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

      // Refresh data seamlessly
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

        /* Drag and drop visual guides */
        @keyframes pulse-border {
          0%, 100% {
            border-width: 3px;
            transform: scale(1);
            box-shadow: 0 0 0 rgba(var(--primary), 0);
          }
          50% {
            border-width: 3px;
            transform: scale(1.03);
            box-shadow: 0 0 20px rgba(var(--primary), 0.3);
          }
        }

        @keyframes dash-rotate {
          0% { stroke-dashoffset: 0; }
          100% { stroke-dashoffset: 100; }
        }

        .drop-zone-active {
          animation: pulse-border 1.5s ease-in-out infinite !important;
          position: relative;
        }

        .drop-zone-ready {
          border: 2px dashed hsl(var(--primary)) !important;
          opacity: 0.9;
        }

        .drop-zone-dimmed {
          opacity: 0.4;
        }

        .drag-hint {
          animation: bounce 2s infinite;
        }

        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }

        @keyframes delete-pulse {
          0%, 100% {
            border-width: 3px;
            transform: scale(1);
            box-shadow: 0 0 0 rgba(239, 68, 68, 0);
          }
          50% {
            border-width: 3px;
            transform: scale(1.05);
            box-shadow: 0 0 30px rgba(239, 68, 68, 0.5);
          }
        }

        .delete-zone-active {
          animation: delete-pulse 1s ease-in-out infinite !important;
          border-color: #ef4444 !important;
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(220, 38, 38, 0.15) 100%) !important;
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          75% { transform: translateX(5px); }
        }

        .delete-zone-hover {
          animation: shake 0.5s ease-in-out;
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
                className="gap-2 shadow-lg hover:shadow-xl transition-all relative overflow-hidden"
                style={{
                  boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                }}
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
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-0.5">
                    📁 My Folders
                  </h2>
                  <p className="text-[10px] text-muted-foreground/60">
                    drag and drop sessions into folders
                  </p>
                </div>
                {folders.length > 5 && (
                  <Link to="/folders">
                    <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                      View All ({folders.length})
                      <ArrowRight size={16} />
                    </Button>
                  </Link>
                )}
              </div>
              <div className="flex gap-4 overflow-x-auto pb-2">
                {folders.slice(0, 5).map((folder) => {
                  const isActiveDropTarget = dropTarget === folder.id;
                  const isDragging = draggedSession !== null;
                  const isDimmed = isDragging && !isActiveDropTarget;

                  return (
                    <div
                      key={folder.id}
                      className={`group flex-shrink-0 cursor-pointer transition-all duration-200 p-4 rounded-xl flex flex-col items-center gap-2 text-center min-w-[110px] relative ${
                        isActiveDropTarget
                          ? 'drop-zone-active bg-primary/10 scale-105 shadow-2xl'
                          : isDragging
                          ? 'drop-zone-ready drop-zone-dimmed hover:opacity-100'
                          : 'bg-card hover:bg-accent/30 hover:shadow-md'
                      }`}
                      style={{
                        border: isActiveDropTarget
                          ? `3px solid ${folder.color}`
                          : isDragging
                          ? `2px dashed ${folder.color}60`
                          : '1px solid hsl(var(--border))',
                        backgroundColor: isActiveDropTarget
                          ? `${folder.color}15`
                          : undefined,
                      }}
                      onDragOver={(e) => handleDragOver(e, folder.id)}
                      onDragLeave={(e) => handleDragLeave(e)}
                      onDrop={(e) => handleDrop(e, folder.id)}
                      onClick={(e) => {
                        if (!draggedSession) {
                          navigate(`/dashboard/folder/${folder.id}`);
                        }
                      }}
                    >
                      {/* Drop indicator overlay */}
                      {isActiveDropTarget && (
                        <div className="absolute inset-0 rounded-xl pointer-events-none flex items-center justify-center bg-gradient-to-b from-transparent via-primary/5 to-transparent">
                          <div className="drag-hint">
                            <Upload size={32} style={{ color: folder.color }} strokeWidth={2.5} />
                          </div>
                        </div>
                      )}

                      <div
                        className={`text-3xl transition-all ${
                          isActiveDropTarget
                            ? 'scale-125 opacity-60'
                            : 'group-hover:scale-110'
                        }`}
                        style={{
                          filter: isActiveDropTarget
                            ? `drop-shadow(0 0 12px ${folder.color})`
                            : isDragging
                            ? `drop-shadow(0 0 6px ${folder.color}40)`
                            : 'none'
                        }}
                      >
                        {folder.icon}
                      </div>
                      <div className={`font-medium text-xs truncate w-full ${
                        isActiveDropTarget ? 'text-primary font-bold' : 'text-foreground'
                      }`}>
                        {folder.name}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {folder.session_count} {folder.session_count !== 1 ? 'sessions' : 'session'}
                      </div>
                      {isActiveDropTarget && (
                        <div
                          className="text-xs font-bold mt-1 px-2 py-1 rounded-md animate-pulse"
                          style={{
                            color: folder.color,
                            backgroundColor: `${folder.color}20`,
                            border: `1px solid ${folder.color}40`
                          }}
                        >
                          📥 Drop Here
                        </div>
                      )}
                      {isDragging && !isActiveDropTarget && (
                        <div className="text-[9px] text-muted-foreground mt-1">
                          Drag here
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Delete Zone - Shows when dragging */}
          {draggedSession && (
            <div className="mb-8">
              <div
                className={`group cursor-pointer transition-all duration-200 p-6 rounded-xl border-4 border-dashed flex flex-col items-center justify-center gap-3 min-h-[120px] ${
                  isDeleteZoneActive
                    ? 'delete-zone-active'
                    : 'border-red-400/40 bg-red-50/30 dark:bg-red-950/10 hover:border-red-500/60 hover:bg-red-50/50 dark:hover:bg-red-950/20'
                }`}
                onDragOver={handleDeleteZoneDragOver}
                onDragLeave={(e) => handleDeleteZoneDragLeave(e)}
                onDrop={handleDeleteZoneDrop}
              >
                {/* Delete icon with animation */}
                <div className={`transition-all ${isDeleteZoneActive ? 'scale-125 delete-zone-hover' : 'scale-100'}`}>
                  <Trash2
                    size={isDeleteZoneActive ? 48 : 40}
                    className="text-red-500"
                    strokeWidth={2.5}
                  />
                </div>

                {/* Text */}
                <div className="text-center">
                  <div className={`font-bold ${isDeleteZoneActive ? 'text-red-600 text-lg' : 'text-red-500'}`}>
                    {isDeleteZoneActive ? '🗑️ Drop to Delete' : 'Drag here to delete'}
                  </div>
                  <div className="text-xs text-red-400 mt-1">
                    {isDeleteZoneActive ? 'Release to confirm deletion' : 'This action will require confirmation'}
                  </div>
                </div>

                {/* Warning badge */}
                {isDeleteZoneActive && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-red-100 dark:bg-red-950/40 border border-red-300 dark:border-red-800 animate-pulse">
                    <AlertTriangle size={16} className="text-red-600" />
                    <span className="text-xs font-semibold text-red-600">Permanent Action</span>
                  </div>
                )}
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

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="text-red-500" size={24} />
              Delete Study Session?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold">"{studySessions.find(s => s.id === sessionToDelete)?.title}"</span>?
              <br /><br />
              This action cannot be undone. All questions, progress, and data associated with this session will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => {
              setShowDeleteConfirm(false);
              setSessionToDelete(null);
            }}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              <Trash2 size={16} className="mr-2" />
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </>
  );
}
