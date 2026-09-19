import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderPlus, Folder, ChevronRight } from "lucide-react";
import { useAppStore } from "@/store/appStore";
import { CreateFolderDialog } from "@/components/CreateFolderDialog";
import { FolderGlyph } from "@/lib/folderCovers";
import { Button } from "@/components/ui/button";

const SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

/* A calm reading-room backdrop so the page isn't a flat void: a warm wash, a
   soft accent glow, and a faint dot grid. Theme-aware via tokens. */
const BACKDROP: React.CSSProperties = {
  backgroundColor: "hsl(var(--background))",
  backgroundImage: [
    "radial-gradient(1100px 520px at 88% -10%, hsl(var(--chart-1) / 0.10), transparent 60%)",
    "radial-gradient(760px 460px at -8% 4%, hsl(32 95% 60% / 0.07), transparent 55%)",
    "radial-gradient(circle at 1px 1px, hsl(var(--foreground) / 0.05) 1px, transparent 0)",
  ].join(", "),
  backgroundSize: "auto, auto, 22px 22px",
};

export default function StudyFolders() {
  const { folders } = useAppStore();
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const navigate = useNavigate();

  return (
    <>
      <div className="relative -m-4 min-h-full md:-m-6">
        {/* full-bleed backdrop */}
        <div aria-hidden className="pointer-events-none absolute inset-0" style={BACKDROP} />

        <div className="relative mx-auto w-full max-w-4xl p-4 md:p-8">
          {/* Header */}
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Library</p>
              <h1 className="mt-1 text-4xl leading-none tracking-tight md:text-[42px]" style={{ fontFamily: SERIF }}>
                My Study Folders
              </h1>
              <p className="mt-2.5 text-sm text-muted-foreground">Shelves for your sessions — group them by subject, class or exam.</p>
            </div>
            <Button onClick={() => setShowCreateFolder(true)} className="gap-2">
              <FolderPlus size={18} />
              New folder
            </Button>
          </div>

          {folders.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => navigate(`/dashboard/folder/${folder.id}`)}
                  className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 pl-5 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
                  style={{ backgroundImage: `linear-gradient(150deg, ${folder.color}24, transparent 58%)` }}
                >
                  {/* book spine */}
                  <span className="absolute inset-y-3 left-0 w-1.5 rounded-r-full" style={{ backgroundColor: folder.color }} />
                  {/* cover / icon */}
                  <FolderGlyph icon={folder.icon} color={folder.color} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold">{folder.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {folder.session_count} session{folder.session_count !== 1 ? "s" : ""}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center shadow-sm">
              <div className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-chart-1/10">
                <Folder className="size-6 text-chart-1" />
              </div>
              <h3 className="mt-4 text-2xl" style={{ fontFamily: SERIF }}>
                Your library is empty
              </h3>
              <p className="mx-auto mt-1.5 max-w-sm text-sm text-muted-foreground">
                Make a folder to shelve your study sessions by subject, class or exam.
              </p>
              <Button onClick={() => setShowCreateFolder(true)} className="mt-5 gap-2">
                <FolderPlus size={18} />
                Create your first folder
              </Button>
            </div>
          )}
        </div>
      </div>

      <CreateFolderDialog open={showCreateFolder} onOpenChange={setShowCreateFolder} />
    </>
  );
}
