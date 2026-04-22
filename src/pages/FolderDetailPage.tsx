import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/appStore";
import { ArrowLeft, FolderOpen, BookOpen } from "lucide-react";

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
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="airbnb-container py-20 text-center">
          <h2 className="font-heading text-2xl font-bold text-foreground mb-2">Folder not found</h2>
          <p className="text-muted-foreground mb-6">This folder doesn't exist or has been deleted.</p>
          <Button onClick={() => navigate('/dashboard')} className="rounded-lg">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      <main className="airbnb-container py-8 animate-fade-in-up">
        {/* Breadcrumb */}
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft size={14} />
          Dashboard
        </button>

        {/* Header — Airbnb listing header */}
        <div className="flex items-center gap-4 mb-8">
          <div
            className="text-5xl"
            style={{ filter: `drop-shadow(0 2px 8px ${folder.color}30)` }}
          >
            {folder.icon}
          </div>
          <div>
            <h1 className="font-heading text-3xl font-bold text-foreground">{folder.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {folderSessions.length} session{folderSessions.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        {/* Sessions — Airbnb listing grid */}
        {folderSessions.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {folderSessions.map((session) => {
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
                  className="airbnb-card border border-border cursor-pointer overflow-hidden"
                  onClick={() => handleSessionClick(session)}
                >
                  {/* Card Visual Header */}
                  <div
                    className="h-28 relative flex items-end p-4"
                    style={{
                      background: `linear-gradient(135deg, ${folder.color}CC 0%, ${folder.color}88 100%)`
                    }}
                  >
                    <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-sm rounded-full px-2.5 py-1 text-xs font-bold text-white">
                      {completionPercentage}%
                    </div>
                    {isNew && (
                      <Badge className="absolute top-3 left-3 bg-white text-primary border-0 text-xs font-bold">
                        NEW
                      </Badge>
                    )}
                    <BookOpen size={18} className="text-white/80 relative z-10" />
                  </div>

                  <div className="p-4">
                    <h3 className="font-heading font-semibold text-foreground text-sm mb-1 line-clamp-2">
                      {session.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mb-3">
                      {session.topics} topic{session.topics !== 1 ? 's' : ''}
                    </p>
                    <div className="airbnb-progress">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${completionPercentage}%`,
                          backgroundColor: folder.color,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 max-w-sm mx-auto">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-6">
              <FolderOpen className="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-lg font-semibold text-foreground mb-2">No sessions yet</h3>
            <p className="text-muted-foreground text-sm mb-6">
              Drag and drop study sessions into this folder to organize them
            </p>
            <Button onClick={() => navigate('/dashboard')} className="rounded-lg">
              Go to Dashboard
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
