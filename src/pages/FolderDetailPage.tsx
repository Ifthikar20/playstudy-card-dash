import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/appStore";
import { ArrowLeft } from "lucide-react";
import { FolderGlyph, parseCover } from "@/lib/folderCovers";
import { isNote } from "@/lib/notes/isNote";

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

export default function FolderDetailPage() {
  const { folderId } = useParams();
  const navigate = useNavigate();
  const { studySessions, folders, setCurrentSession } = useAppStore();

  const folder = folders.find(f => f.id === Number(folderId));
  // A folder shelves study sessions; the student's own notes live in the sidebar.
  const folderSessions = studySessions.filter(s => s.folderId === Number(folderId) && !isNote(s));

  const handleSessionClick = (session: any) => {
    setCurrentSession(session);
    navigate(`/dashboard/${session.id}/full-study`);
  };

  if (!folder) {
    return (
      <div className="flex flex-1 min-h-0 w-full">
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

  const cover = parseCover(folder.icon);

  return (
    <div className="relative -m-4 min-h-full overflow-hidden md:-m-6">
      {/* The folder's own cover, worn as an ambient background so the page feels
          like this folder. Blurred + dimmed so content stays readable. */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {cover ? (
          <div className="absolute inset-0 scale-125 bg-cover bg-center opacity-30 blur-3xl" style={{ backgroundImage: `url(${cover.src})` }} />
        ) : (
          <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(900px 480px at 50% -8%, ${folder.color}2e, transparent 60%)` }} />
        )}
        <div className="absolute inset-0 bg-background/78" />
      </div>

      <div className="relative p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard')}
              className="mb-4 -ml-2 text-muted-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to dashboard
            </Button>

            <div className="flex items-center gap-4">
              <FolderGlyph icon={folder.icon} color={folder.color} size="lg" />
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Folder</p>
                <h1 className="text-3xl leading-tight tracking-tight md:text-4xl" style={{ fontFamily: SERIF }}>{folder.name}</h1>
                <p className="text-sm text-muted-foreground">
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
                    className="group relative cursor-pointer overflow-hidden rounded-2xl border bg-card p-4 pl-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                    style={{ backgroundImage: `linear-gradient(150deg, ${folder.color}14, transparent 62%)`, borderColor: `${folder.color}33` }}
                    onClick={() => handleSessionClick(session)}
                  >
                    <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: folder.color }} />
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
            <div className="rounded-2xl border border-dashed bg-card/60 px-6 py-16 text-center shadow-sm" style={{ borderColor: `${folder.color}55` }}>
              <FolderGlyph icon={folder.icon} color={folder.color} size="md" className="mx-auto" />
              <h3 className="mt-4 text-2xl" style={{ fontFamily: SERIF }}>This shelf is empty</h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Sessions you add to <span className="font-medium text-foreground">{folder.name}</span> will appear here. Move one in from a session's menu on the dashboard.
              </p>
              <Button className="mt-5" onClick={() => navigate('/dashboard')}>
                Go to dashboard
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
