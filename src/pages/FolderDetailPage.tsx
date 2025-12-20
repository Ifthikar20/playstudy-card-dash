import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/appStore";
import { ArrowLeft, FolderOpen } from "lucide-react";

export default function FolderDetailPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession } = useAppStore();

  const folder = folders.find(f => f.id === Number(folderId));
  const folderSessions = studySessions.filter(s => s.folderId === Number(folderId));

  const handleSessionClick = (session: any) => {
    setCurrentSession(session);
    navigate(`/dashboard/${session.id}/full-study`);
  };

  if (!folder) {
    return (
      <div className="min-h-screen bg-background flex w-full">
        <Sidebar />
        <div className="flex-1 p-4 md:p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">Folder not found</h2>
            <p className="text-muted-foreground mb-4">This folder doesn't exist or has been deleted.</p>
            <Button onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      <div className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="mb-4"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>

            <div className="flex items-center gap-4 mb-2">
              <div
                className="text-5xl"
                style={{
                  filter: `drop-shadow(0 0 8px ${folder.color}40)`
                }}
              >
                {folder.icon}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{folder.name}</h1>
                <p className="text-muted-foreground">
                  {folderSessions.length} session{folderSessions.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Sessions List */}
          {folderSessions.length > 0 ? (
            <div className="space-y-2">
              {folderSessions.map((session) => {
                const completionPercentage = session.extractedTopics
                  ? Math.round(
                      (session.extractedTopics.filter(t => t.completed).length /
                      session.extractedTopics.length) * 100
                    )
                  : session.progress;

                const isNew = session.createdAt && (Date.now() - session.createdAt) < 48 * 60 * 60 * 1000;

                return (
                  <div
                    key={session.id}
                    className="cursor-pointer hover:bg-accent/50 transition-colors p-4 rounded-lg border border-border"
                    style={{
                      borderLeftColor: folder.color,
                      borderLeftWidth: '4px'
                    }}
                    onClick={() => handleSessionClick(session)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="font-semibold text-foreground">
                            {session.title}
                          </div>
                          {isNew && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-2 py-0.5 h-5 font-bold bg-gradient-to-r from-orange-500 to-red-500 border-0"
                            >
                              🔥 NEW
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {session.topics} topic{session.topics !== 1 ? 's' : ''} • {completionPercentage}% complete
                        </div>
                      </div>

                      {/* Progress indicator */}
                      <div className="ml-4">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full transition-all duration-300"
                            style={{
                              width: `${completionPercentage}%`,
                              backgroundColor: folder.color,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-card rounded-xl border border-border">
              <FolderOpen className="w-20 h-20 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No sessions yet</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Drag and drop study sessions into this folder to organize them
              </p>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
