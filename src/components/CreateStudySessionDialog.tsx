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
import { Slider } from "@/components/ui/slider";
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  BookOpen,
  Zap,
  Gamepad2,
  Clock,
  Target,
  Mic,
  FileImage,
  File,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { createStudySessionWithAI, analyzeContent, ContentAnalysis, generateAllRemainingQuestions } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface CreateStudySessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "select-mode";
type UploadType = "file" | "text";
type StudyMode = "full-study" | "speed-run" | "game" | "mentor";

export function CreateStudySessionDialog({ open, onOpenChange }: CreateStudySessionDialogProps) {
  const navigate = useNavigate();
  const { setCurrentSession, addSession, createSpeedRun } = useAppStore();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("upload");
  const [uploadType, setUploadType] = useState<UploadType>("text");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);
  const [topicCount, setTopicCount] = useState([4]);
  const [questionCount, setQuestionCount] = useState([10]);
  const [speedRunDuration, setSpeedRunDuration] = useState([10]);
  const [sessionTitle, setSessionTitle] = useState("");
  const [createdSession, setCreatedSession] = useState<any>(null);
  const [contentAnalysis, setContentAnalysis] = useState<ContentAnalysis | null>(null);
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const loadingMessages = [
    "Reading your document...",
    "Breaking it down...",
    "Hmm, interesting...",
    "Finding the best way to teach this...",
    "Making sense of all this...",
    "Organizing the chaos...",
    "Almost got it...",
    "Connecting the dots...",
  ];

  useEffect(() => {
    if (isProcessing) {
      setLoadingMessageIndex(0);
      const interval = setInterval(() => {
        setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [isProcessing]);

  const handleAnalyzeContent = async (content: string) => {
    if (!content || content.length < 50) return;
    setIsAnalyzing(true);
    try {
      const analysis = await analyzeContent(content);
      setContentAnalysis(analysis);
      setTopicCount([analysis.recommended_topics]);
      setQuestionCount([analysis.recommended_questions]);
      toast({
        title: "Content analyzed",
        description: `${analysis.word_count} words · ${analysis.estimated_reading_time} min read · ${analysis.recommended_topics} topics recommended`,
      });
    } catch (error: any) {
      console.error('Analysis failed:', error);
      toast({
        title: "Analysis failed",
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
      const MAX_FILE_SIZE_MB = 35;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File too large",
          description: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the ${MAX_FILE_SIZE_MB}MB limit.`,
          variant: "destructive",
        });
        e.target.value = '';
        return;
      }

      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        let content = '';
        if (result.startsWith('data:')) {
          content = result.split(',')[1];
          setTextContent(content);
        } else {
          content = result;
          setTextContent(result);
        }
        await handleAnalyzeContent(content);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleProcessContent = async () => {
    setIsProcessing(true);
    try {
      const content = textContent.trim();
      const title = sessionTitle.trim() || `Study Session ${new Date().toLocaleDateString()}`;
      const newSession = await createStudySessionWithAI(title, content, topicCount[0], questionCount[0]);
      setCreatedSession(newSession);
      setCurrentSession(newSession);
      addSession(newSession);

      toast({
        title: "Session created!",
        description: `Generating remaining questions in background...`,
      });

      setIsProcessing(false);
      setStep("select-mode");

      generateAllRemainingQuestions(newSession.id, (generated, remaining) => {
        if (remaining === 0) {
          toast({ title: "All questions ready!", description: "All questions have been generated." });
        }
      }).catch(console.error);
    } catch (error: any) {
      setIsProcessing(false);
      toast({
        title: "Error",
        description: error.message || "Failed to create study session.",
        variant: "destructive",
      });
    }
  };

  const handleStartSession = () => {
    if (!createdSession) return;
    if (selectedMode === "full-study") {
      navigate(`/dashboard/${createdSession.id}/full-study`);
    } else if (selectedMode === "speed-run") {
      createSpeedRun(createdSession.id);
      navigate(`/dashboard/${createdSession.id}/speedrun`);
    } else if (selectedMode === "mentor") {
      navigate(`/dashboard/${createdSession.id}/mentor`);
    } else if (selectedMode === "game") {
      navigate(`/dashboard/${createdSession.id}/browse-games`);
    }

    onOpenChange(false);
    setStep("upload");
    setUploadType("text");
    setTextContent("");
    setSelectedFile(null);
    setSelectedMode(null);
    setSessionTitle("");
    setCreatedSession(null);
  };

  const canProceed = uploadType === "text" ? textContent.trim().length > 0 : selectedFile !== null;

  const getEstimatedTime = () => {
    if (selectedMode === "full-study") return `~${topicCount[0] * 5} mins`;
    if (selectedMode === "speed-run") return `${speedRunDuration[0]} mins`;
    return "~5 mins";
  };

  const studyModes: Array<{ id: StudyMode; icon: typeof BookOpen; iconColor: string; title: string; description: string }> = [
    { id: "full-study", icon: BookOpen, iconColor: "text-primary", title: "Full Study", description: "Complete learning path with progress tracking" },
    { id: "speed-run", icon: Zap, iconColor: "text-amber-500", title: "Speed Run", description: "Rapid fire flip cards for quick review" },
    { id: "mentor", icon: Mic, iconColor: "text-blue-500", title: "Mentor Mode", description: "AI narration guides you through content" },
    { id: "game", icon: Gamepad2, iconColor: "text-violet-500", title: "Game Mode", description: "Battle enemies while answering questions" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-2xl p-0 overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-0">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl font-bold text-foreground">
              {step === "upload" ? "Create study session" : "Choose your study mode"}
            </DialogTitle>
          </DialogHeader>
          {step === "upload" && (
            <p className="text-sm text-muted-foreground mt-1">
              Upload your study material or paste text
            </p>
          )}
        </div>

        <div className="p-6 pt-4">
          {step === "upload" && (
            <div className="space-y-4">
              {/* Session Title */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Session name <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  placeholder="e.g., Biology Chapter 5"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  className="h-11 rounded-xl border-2"
                />
              </div>

              {/* Upload Type Toggle — Airbnb segmented control */}
              <div className="flex rounded-xl border border-border p-1 bg-muted/30">
                <button
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    uploadType === "text"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setUploadType("text")}
                >
                  <FileText size={16} />
                  Paste Text
                </button>
                <button
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all",
                    uploadType === "file"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setUploadType("file")}
                >
                  <Upload size={16} />
                  Upload File
                </button>
              </div>

              {/* Content Area */}
              {uploadType === "text" ? (
                <div className="space-y-2">
                  <Textarea
                    placeholder="Paste your study material here..."
                    className="min-h-[180px] resize-none rounded-xl border-2"
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                  />
                  {textContent.trim().length >= 50 && !contentAnalysis && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg"
                      onClick={() => handleAnalyzeContent(textContent)}
                      disabled={isAnalyzing}
                    >
                      {isAnalyzing ? (
                        <span className="flex items-center gap-2">
                          <div className="h-3.5 w-3.5 rounded-full border-2 border-transparent border-t-primary animate-spin" />
                          Analyzing...
                        </span>
                      ) : (
                        'Analyze Content'
                      )}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary/40 transition-all">
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                    onChange={handleFileChange}
                    className="hidden"
                    id="file-upload"
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <FileText size={20} className="text-primary" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-medium text-foreground">{selectedFile.name}</p>
                          <p className="text-xs text-muted-foreground">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Upload className="text-primary" size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            Drop files to upload
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, Word, PPT, TXT supported
                          </p>
                        </div>
                      </div>
                    )}
                  </label>
                </div>
              )}

              {/* Content Analysis Info */}
              {contentAnalysis && (
                <div className="bg-muted/50 border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-airbnb-success flex items-center justify-center">
                      <Check size={12} className="text-white" />
                    </div>
                    <h3 className="font-medium text-sm text-foreground">Content analyzed</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-background rounded-lg p-2.5">
                      <span className="text-muted-foreground block text-xs">Words</span>
                      <span className="font-semibold text-foreground">{contentAnalysis.word_count}</span>
                    </div>
                    <div className="bg-background rounded-lg p-2.5">
                      <span className="text-muted-foreground block text-xs">Reading time</span>
                      <span className="font-semibold text-foreground">{contentAnalysis.estimated_reading_time} min</span>
                    </div>
                    <div className="bg-background rounded-lg p-2.5">
                      <span className="text-muted-foreground block text-xs">Complexity</span>
                      <span className="font-semibold text-foreground">{(contentAnalysis.complexity_score * 100).toFixed(0)}%</span>
                    </div>
                    <div className="bg-background rounded-lg p-2.5">
                      <span className="text-muted-foreground block text-xs">Recommended</span>
                      <span className="font-semibold text-primary">{contentAnalysis.recommended_topics} topics</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Process Button — Airbnb CTA */}
              <button
                className="airbnb-btn-primary w-full h-12 rounded-xl text-sm disabled:opacity-50"
                disabled={!canProceed || isProcessing || isAnalyzing}
                onClick={handleProcessContent}
              >
                {isProcessing ? (
                  <div className="flex flex-col items-center gap-1">
                    <div className="flex items-center gap-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                    <span className="text-xs text-white/90">{loadingMessages[loadingMessageIndex]}</span>
                  </div>
                ) : (
                  <span className="flex items-center gap-2">
                    Process Content
                    <ArrowRight size={16} />
                  </span>
                )}
              </button>
            </div>
          )}

          {step === "select-mode" && (
            <div className="space-y-4">
              {/* Mode Selection — Airbnb option cards */}
              <div className="space-y-2">
                {studyModes.map((mode) => (
                  <button
                    key={mode.id}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left",
                      selectedMode === mode.id
                        ? "border-foreground bg-accent/50"
                        : "border-border hover:border-foreground/30"
                    )}
                    onClick={() => setSelectedMode(mode.id)}
                  >
                    <div className={cn("p-2 rounded-xl bg-muted", mode.iconColor)}>
                      <mode.icon size={20} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-sm text-foreground">{mode.title}</h3>
                      <p className="text-xs text-muted-foreground">{mode.description}</p>
                    </div>
                    {selectedMode === mode.id && (
                      <div className="w-6 h-6 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
                        <Check size={12} className="text-background" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Estimated Time */}
              {selectedMode && (
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                  <Clock size={14} />
                  Estimated: <span className="font-medium text-foreground">{getEstimatedTime()}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl"
                  onClick={() => setStep("upload")}
                >
                  <ArrowLeft size={16} />
                  Back
                </Button>
                <button
                  className="airbnb-btn-primary flex-1 h-11 rounded-xl text-sm disabled:opacity-50"
                  disabled={!selectedMode}
                  onClick={handleStartSession}
                >
                  <Target size={16} />
                  Start Session
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
