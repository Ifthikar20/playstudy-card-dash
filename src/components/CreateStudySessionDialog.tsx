import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Upload, FileText, ArrowRight, ArrowLeft, BookOpen, Clock, Youtube } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { createStudySessionWithAI, createStudySessionFromYouTube, analyzeContent, ContentAnalysis, streamQuestionGeneration } from "@/services/api";
import { fetchLoadingFacts } from "@/services/guide";
import { LoadingFacts } from "@/components/LoadingFacts";
import { useToast } from "@/hooks/use-toast";

interface CreateStudySessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "ready";
type UploadType = "file" | "text" | "youtube";

export function CreateStudySessionDialog({ open, onOpenChange }: CreateStudySessionDialogProps) {
  const navigate = useNavigate();
  const { setCurrentSession, addSession } = useAppStore();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [uploadType, setUploadType] = useState<UploadType>("text");
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [topicCount, setTopicCount] = useState([4]);
  const [questionCount, setQuestionCount] = useState([10]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [createdSession, setCreatedSession] = useState<any>(null);
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);
  const [contentFacts, setContentFacts] = useState<string[]>([]);
  const [factsSubject, setFactsSubject] = useState<string | null>(null);
  const [processingStartedAt, setProcessingStartedAt] = useState(0);
  const [generationProgress, setGenerationProgress] = useState({
    generated: 0,
    remaining: 0,
    totalQuestions: 0,
    inProgress: false
  });

  // Sarcastic/playful loading messages
  const loadingMessages = [
    "Reading your document...",
    "Breaking it down...",
    "Hmm, interesting...",
    "Finding the best way to teach this...",
    "I see how we can break this down...",
    "Making sense of all this...",
    "Organizing the chaos...",
    "Brewing some knowledge potions...",
    "Teaching mode: activated...",
    "Almost got it...",
    "Just a bit more patience...",
    "Connecting the dots...",
    "This is pretty neat, actually..."
  ];

  // Rotate loading messages while processing
  useEffect(() => {
    if (isProcessing) {
      setLoadingMessageIndex(0); // Reset to first message
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % 13); // 13 messages total
      }, 2000); // Change message every 2 seconds

      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const handleAnalyzeContent = async (content: string) => {
    if (!content || content.length < 50) return;

    setIsAnalyzing(true);
    try {
      const analysis = await analyzeContent(content);
      setContentAnalysis(analysis);

      // Update default values based on recommendations
      setTopicCount([analysis.recommended_topics]);
      setQuestionCount([analysis.recommended_questions]);

      toast({
        title: "Content Analyzed!",
        description: `${analysis.word_count} words • ${analysis.estimated_reading_time} min read • ${analysis.recommended_topics} topics recommended`,
      });
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis Failed",
        description: "Using default settings. You can still create the session.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Check file size (max 35MB)
      const MAX_FILE_SIZE_MB = 35;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File Too Large",
          description: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB. Please compress the file or split it into smaller documents.`,
          variant: "destructive",
        });
        // Clear the file input
        e.target.value = '';
        return;
      }

      setSelectedFile(file);

      // Read file content
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;

        // For binary files (Word docs, PDFs), extract base64
        // For text files, use as-is
        let content = '';
        if (result.startsWith('data:')) {
          // Remove the "data:...;base64," prefix
          content = result.split(',')[1];
          setTextContent(content);
        } else {
          content = result;
          setTextContent(result);
        }

        // Automatically analyze content after upload
        await handleAnalyzeContent(content);
      };

      // Use readAsDataURL for proper binary handling
      // This encodes files as base64, which the backend can decode
      reader.readAsDataURL(file);
    }
  };

  const handleProcessContent = async () => {
    setIsProcessing(true);

    try {
      const title = sessionTitle.trim();
      setProcessingStartedAt(Date.now());
      setContentFacts([]);
      setFactsSubject(null);
      // Something worth reading while the notes are written: facts about this very material.
      void fetchLoadingFacts({
        text: uploadType === "text" ? textContent.trim().slice(0, 4000) : undefined,
        youtube_url: uploadType === "youtube" ? youtubeUrl.trim() : undefined,
        title: title || selectedFile?.name,
      }).then((r) => {
        setContentFacts(r.facts);
        setFactsSubject(r.subject || null);
      });

      // Route by source: a YouTube video reads captions server-side; otherwise
      // the pasted text (or the extracted file text) goes to the same pipeline.
      const newSession =
        uploadType === "youtube"
          ? await createStudySessionFromYouTube(youtubeUrl.trim(), title, topicCount[0], questionCount[0])
          : await createStudySessionWithAI(
              title || `Study Session ${new Date().toLocaleDateString()}`,
              textContent.trim(),
              topicCount[0],
              questionCount[0],
            );

      setCreatedSession(newSession);
      setCurrentSession(newSession);
      addSession(newSession);

      toast({
        title: "Session Created!",
        description: `Initial questions loaded. Generating remaining questions in background...`,
      });

      setIsProcessing(false);
      setStep("ready");

      // Start SSE stream for background question generation
      streamQuestionGeneration(
        newSession.id,
        (progress) => {
          console.log(`📊 SSE Progress - Batch ${progress.batchNumber}`);

          // Update progress state (no need to refetch - SSE pushes updates)
          setGenerationProgress({
            generated: progress.generated,
            remaining: progress.remaining,
            totalQuestions: progress.cumulativeQuestions,
            inProgress: progress.hasMore
          });
        },
        (completionData) => {
          toast({
            title: "All Questions Ready!",
            description: `Session complete with ${completionData.totalQuestions} questions and ${completionData.totalFlashcards} flashcards.`,
          });

          setGenerationProgress({
            generated: 0,
            remaining: 0,
            totalQuestions: 0,
            inProgress: false
          });
        },
        (error) => {
          toast({
            title: "Generation Error",
            description: error,
            variant: "destructive",
          });

          setGenerationProgress({
            generated: 0,
            remaining: 0,
            totalQuestions: 0,
            inProgress: false
          });
        }
      );
    } catch (error: any) {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create study session. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleStartSession = () => {
    if (!createdSession) return;
    navigate(`/dashboard/${createdSession.id}/full-study`);

    // Reset state
    onOpenChange(false);
    setStep("upload");
    setUploadType("text");
    setTextContent("");
    setYoutubeUrl("");
    setSelectedFile(null);
    setSessionTitle("");
    setCreatedSession(null);
  };

  const canProceed =
    uploadType === "text" ? textContent.trim().length > 0
    : uploadType === "youtube" ? /(?:youtube\.com|youtu\.be)/.test(youtubeUrl.trim())
    : selectedFile !== null;

  const getEstimatedTime = () => `~${topicCount[0] * 5} mins`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-1.5 pb-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {step !== "upload" ? "Your notes are ready" : isProcessing ? "Creating your study session" : "Create study session"}
          </DialogTitle>
          {step === "upload" && (
            <p className="text-sm text-muted-foreground">
              {isProcessing
                ? "PlayStudy is reading your material and writing the notes and quizzes. Keep this open — it usually takes under a minute."
                : "Paste text, upload a file, or add a YouTube link — PlayStudy writes the notes and quizzes."}
            </p>
          )}
        </DialogHeader>

        {step === "upload" && isProcessing && (
          <div className="min-w-0 space-y-3">
            <LoadingFacts
              facts={contentFacts}
              subject={factsSubject}
              startedAt={processingStartedAt || undefined}
              expectedMs={uploadType === "youtube" ? 75_000 : 45_000}
            />
            <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "0ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "150ms" }} />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" style={{ animationDelay: "300ms" }} />
              </span>
              {loadingMessages[loadingMessageIndex]}
            </p>
          </div>
        )}

        {step === "upload" && !isProcessing && (
          <div className="min-w-0 space-y-4">
            {/* Session Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Session Name (optional)
              </label>
              <Input
                placeholder="e.g., Biology Chapter 5, Math Final Review..."
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
              />
            </div>

            {/* Source toggle — clean segmented control */}
            <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-muted/50 p-1">
              {([
                { id: "text", label: "Paste text", Icon: FileText },
                { id: "file", label: "Upload file", Icon: Upload },
                { id: "youtube", label: "YouTube", Icon: Youtube },
              ] as const).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    uploadType === id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setUploadType(id)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            {/* Content Area */}
            {uploadType === "youtube" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-foreground">
                  <Youtube size={18} className="shrink-0 text-muted-foreground" />
                  <input
                    type="url"
                    inputMode="url"
                    placeholder="Paste a YouTube link (e.g. https://youtu.be/...)"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  PlayStudy reads the video's captions and builds the same sections, notes and quizzes as a document.
                  Works with videos that have subtitles — processing a longer video can take a minute.
                </p>
              </div>
            ) : uploadType === "text" ? (
              <div className="space-y-2">
                <Textarea
                  placeholder="Paste your study material here... (notes, textbook content, articles, etc.)"
                  className="min-h-[200px] resize-none"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                />
                {textContent.trim().length >= 50 && !contentAnalysis && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => handleAnalyzeContent(textContent)}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <>
                        <div className="mr-2 inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent"></div>
                        Analyzing…
                      </>
                    ) : (
                      "Analyze content"
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-8 text-center transition-colors hover:border-foreground/40 hover:bg-muted/40">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText size={20} className="text-foreground" />
                      <p className="font-medium text-foreground">{selectedFile.name}</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted">
                        <Upload className="size-5 text-muted-foreground" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Drag &amp; drop, or select a file</p>
                        <p className="mt-1 text-xs text-muted-foreground">PDF, Word, PowerPoint, or plain text</p>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Content Analysis Info */}
            {contentAnalysis && (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Content analyzed</h3>
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <span className="block text-xs text-muted-foreground">Words</span>
                    <span className="font-semibold text-foreground tabular-nums">{contentAnalysis.word_count}</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Reading time</span>
                    <span className="font-semibold text-foreground tabular-nums">{contentAnalysis.estimated_reading_time} min</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Complexity</span>
                    <span className="font-semibold text-foreground tabular-nums">{(contentAnalysis.complexity_score * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="block text-xs text-muted-foreground">Suggested</span>
                    <span className="font-semibold text-foreground tabular-nums">{contentAnalysis.recommended_topics} topics</span>
                  </div>
                </div>
              </div>
            )}

            {/* Process Button */}
            <Button className="w-full gap-2" size="lg" disabled={!canProceed || isAnalyzing} onClick={handleProcessContent}>
              Generate notes &amp; quizzes
              <ArrowRight size={18} />
            </Button>
          </div>
        )}

        {step === "ready" && createdSession && (
          <div className="min-w-0 space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-foreground text-background">
                  <BookOpen className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="line-clamp-2 break-words text-sm font-semibold">{createdSession.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {createdSession.topics} section{createdSession.topics === 1 ? "" : "s"} · one quiz per section
                    {generationProgress.inProgress ? " · questions are still being written in the background" : ""}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 py-1 text-sm text-muted-foreground">
              <Clock size={16} />
              Estimated time: <span className="font-medium text-foreground">{getEstimatedTime()}</span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="gap-2" onClick={() => setStep("upload")}>
                <ArrowLeft size={18} />
                Back
              </Button>
              <Button className="flex-1 gap-2" size="lg" onClick={handleStartSession}>
                Open notes
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
