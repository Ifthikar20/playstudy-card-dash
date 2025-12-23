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
import { Card, CardContent } from "@/components/ui/card";
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
  File
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

      // Check file size (max 20MB)
      const MAX_FILE_SIZE_MB = 20;
      const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: "File Too Large",
          description: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds the maximum allowed size of ${MAX_FILE_SIZE_MB}MB. Please use a smaller file.`,
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
      const content = textContent.trim();
      const title = sessionTitle.trim() || `Study Session ${new Date().toLocaleDateString()}`;

      // Call backend API to create session with AI
      const newSession = await createStudySessionWithAI(
        title,
        content,
        topicCount[0],
        questionCount[0]
      );

      setCreatedSession(newSession);
      setCurrentSession(newSession);
      addSession(newSession);

      toast({
        title: "Session Created!",
        description: `Initial questions loaded. Generating remaining questions in background...`,
      });

      setIsProcessing(false);
      setStep("select-mode");

      // Start loading remaining questions automatically in background
      generateAllRemainingQuestions(newSession.id, (generated, remaining) => {
        console.log(`📊 Progress: Generated ${generated} more subtopics, ${remaining} remaining`);

        // Show toast when all done
        if (remaining === 0) {
          toast({
            title: "All Questions Ready!",
            description: "All questions have been generated for this session.",
          });
        }
      }).catch((error) => {
        console.error('Failed to generate remaining questions:', error);
        // Don't show error toast - initial questions are already available
      });
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

    // Navigate to the selected mode
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

    // Reset state
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
    if (selectedMode === "full-study") {
      return `~${topicCount[0] * 5} mins`;
    } else if (selectedMode === "speed-run") {
      return `${speedRunDuration[0]} mins`;
    }
    return "~5 mins";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3 pb-4">
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary via-blue-500 to-purple-500 bg-clip-text text-transparent">
            {step === "upload" ? "✨ Create Study Session" : "🎯 Choose Your Study Mode"}
          </DialogTitle>
          {step === "upload" && (
            <p className="text-sm text-muted-foreground">
              Upload your study material or paste text to generate personalized learning content
            </p>
          )}
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
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

            {/* Upload Type Toggle */}
            <div className="flex rounded-xl border-2 border-border p-1.5 bg-gradient-to-r from-muted/50 to-muted/30 shadow-sm">
              <button
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all",
                  uploadType === "text"
                    ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md shadow-purple-500/30 scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                onClick={() => setUploadType("text")}
              >
                <FileText size={18} />
                Paste Text
              </button>
              <button
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-lg text-sm font-semibold transition-all",
                  uploadType === "file"
                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md shadow-blue-500/30 scale-105"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
                onClick={() => setUploadType("file")}
              >
                <Upload size={18} />
                Upload File
              </button>
            </div>

            {/* Content Area */}
            {uploadType === "text" ? (
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
                        <div className="inline-block h-3.5 w-3.5 mr-2 rounded-full border-2 border-transparent border-t-[#97E35C] border-r-[#97E35C] animate-spin"></div>
                        <span className="bg-gradient-to-r from-[#97E35C] to-[#7BC850] bg-clip-text text-transparent font-semibold">
                          Analyzing...
                        </span>
                      </>
                    ) : (
                      'Analyze Content'
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-all hover:bg-primary/5">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="space-y-3">
                      <div className="flex items-center justify-center gap-2 text-primary">
                        <FileText size={24} />
                        <p className="text-foreground font-medium">{selectedFile.name}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Decorative File Icons */}
                      <div className="flex items-center justify-center gap-3 mb-4">
                        <div className="relative">
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform shadow-lg">
                            <FileText className="text-white" size={28} />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-[10px] font-bold text-white">
                            W
                          </div>
                        </div>
                        <div className="relative">
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
                            <FileText className="text-white" size={28} />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center text-[10px] font-bold text-white">
                            T
                          </div>
                        </div>
                        <div className="relative">
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center transform rotate-6 hover:rotate-0 transition-transform shadow-lg">
                            <File className="text-white" size={28} />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-[10px] font-bold text-white">
                            P
                          </div>
                        </div>
                        <div className="relative">
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center transform -rotate-3 hover:rotate-0 transition-transform shadow-lg">
                            <FileImage className="text-white" size={28} />
                          </div>
                          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center text-[10px] font-bold text-white">
                            P
                          </div>
                        </div>
                      </div>

                      {/* Upload Icon */}
                      <div className="flex items-center justify-center">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="text-primary" size={24} />
                        </div>
                      </div>

                      {/* Text */}
                      <div>
                        <p className="text-lg font-semibold text-foreground mb-1">
                          Drag & drop files to upload
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Supported types: PDF, Word, PPT, TXT, JPG, JPEG, PNG, HEIC, WebP, MP3, WAV, M4A
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 hover:bg-primary/20 rounded-lg text-primary font-medium text-sm transition-colors">
                          <Upload size={16} />
                          Select file
                        </div>
                      </div>
                    </div>
                  )}
                </label>
              </div>
            )}

            {/* Content Analysis Info */}
            {contentAnalysis && (
              <div className="bg-gradient-to-br from-primary/10 via-blue-500/5 to-purple-500/10 border-2 border-primary/30 rounded-xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center">
                    <span className="text-white text-sm font-bold">✓</span>
                  </div>
                  <h3 className="font-semibold text-foreground">Content Analyzed</h3>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-background/50 rounded-lg p-2">
                    <span className="text-muted-foreground block text-xs">Word Count</span>
                    <span className="font-bold text-foreground">{contentAnalysis.word_count}</span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2">
                    <span className="text-muted-foreground block text-xs">Reading Time</span>
                    <span className="font-bold text-foreground">{contentAnalysis.estimated_reading_time} min</span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2">
                    <span className="text-muted-foreground block text-xs">Complexity</span>
                    <span className="font-bold text-foreground">{(contentAnalysis.complexity_score * 100).toFixed(0)}%</span>
                  </div>
                  <div className="bg-background/50 rounded-lg p-2">
                    <span className="text-muted-foreground block text-xs">Recommended</span>
                    <span className="font-bold text-primary">{contentAnalysis.recommended_topics} topics</span>
                  </div>
                </div>
              </div>
            )}

            {/* Process Button */}
            <Button
              className="w-full gap-2 bg-gradient-to-r from-primary via-blue-500 to-purple-500 hover:from-primary/90 hover:via-blue-500/90 hover:to-purple-500/90 text-white font-semibold shadow-lg hover:shadow-xl transition-all"
              size="lg"
              disabled={!canProceed || isProcessing || isAnalyzing}
              onClick={handleProcessContent}
            >
              {isProcessing ? (
                <div className="flex flex-col items-center gap-1 py-1">
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-1.5 w-1.5 rounded-full bg-white animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-xs text-white/90 animate-pulse">
                    {loadingMessages[loadingMessageIndex]}
                  </span>
                </div>
              ) : (
                <>
                  ✨ Process Content
                  <ArrowRight size={18} />
                </>
              )}
            </Button>
          </div>
        )}

        {step === "select-mode" && (
          <div className="space-y-4">
            {/* Mode Selection */}
            <div className="grid gap-3">
              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedMode === "full-study" && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedMode("full-study")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <BookOpen className="text-primary" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Full Study Session</h3>
                      <p className="text-sm text-muted-foreground">Complete learning path with progress tracking</p>
                      
                      {selectedMode === "full-study" && (
                        <div className="mt-4 space-y-4">
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Topics to generate</span>
                              <span className="font-medium">
                                {topicCount[0]}
                                {contentAnalysis && topicCount[0] === contentAnalysis.recommended_topics && (
                                  <span className="ml-1 text-xs text-primary">(recommended)</span>
                                )}
                              </span>
                            </div>
                            <Slider value={topicCount} onValueChange={setTopicCount} min={1} max={100} step={1} />
                            <p className="text-xs text-muted-foreground mt-1">
                              Truly dynamic: 1-100 topics based on content size (AI recommends optimal count)
                            </p>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Questions per topic</span>
                              <span className="font-medium">
                                {questionCount[0]}
                                {contentAnalysis && questionCount[0] === contentAnalysis.recommended_questions && (
                                  <span className="ml-1 text-xs text-primary">(recommended)</span>
                                )}
                              </span>
                            </div>
                            <Slider value={questionCount} onValueChange={setQuestionCount} min={5} max={50} step={5} />
                            <p className="text-xs text-muted-foreground mt-1">
                              More questions = deeper understanding
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card 
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedMode === "speed-run" && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedMode("speed-run")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-orange-500/10">
                      <Zap className="text-orange-500" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Speed Run</h3>
                      <p className="text-sm text-muted-foreground">Rapid fire flip cards for quick review</p>
                      
                      {selectedMode === "speed-run" && (
                        <div className="mt-4">
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Duration (minutes)</span>
                            <span className="font-medium">{speedRunDuration[0]} min</span>
                          </div>
                          <Slider value={speedRunDuration} onValueChange={setSpeedRunDuration} min={5} max={30} step={5} />
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedMode === "mentor" && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedMode("mentor")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <Mic className="text-blue-500" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Mentor Mode</h3>
                      <p className="text-sm text-muted-foreground">Listen to AI narration like a teacher guiding you through the content</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedMode === "game" && "ring-2 ring-primary"
                )}
                onClick={() => setSelectedMode("game")}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/10">
                      <Gamepad2 className="text-purple-500" size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Game Mode</h3>
                      <p className="text-sm text-muted-foreground">Battle enemies while answering questions to survive!</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Estimated Time */}
            {selectedMode && (
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
                <Clock size={16} />
                Estimated time: <span className="font-medium text-foreground">{getEstimatedTime()}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="gap-2"
                onClick={() => setStep("upload")}
              >
                <ArrowLeft size={18} />
                Back
              </Button>
              <Button 
                className="flex-1 gap-2" 
                size="lg"
                disabled={!selectedMode}
                onClick={handleStartSession}
              >
                <Target size={18} />
                Start Session
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
