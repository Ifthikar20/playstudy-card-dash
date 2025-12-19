import { useState } from "react";
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
  Mic
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/appStore";
import { createStudySessionWithAI, analyzeContent, ContentAnalysis } from "@/services/api";
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
        description: `${newSession.topics} topics generated with ${questionCount[0]} questions each.`,
      });

      setIsProcessing(false);
      setStep("select-mode");
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
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === "upload" ? "Create Study Session" : "Choose Your Study Mode"}
          </DialogTitle>
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
            <div className="flex rounded-lg border border-border p-1 bg-muted/50">
              <button
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all",
                  uploadType === "text" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setUploadType("text")}
              >
                <FileText size={18} />
                Paste Text
              </button>
              <button
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-all",
                  uploadType === "file" 
                    ? "bg-background text-foreground shadow-sm" 
                    : "text-muted-foreground hover:text-foreground"
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
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
                <Input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.md"
                  onChange={handleFileChange}
                  className="hidden"
                  id="file-upload"
                />
                <label htmlFor="file-upload" className="cursor-pointer">
                  <Upload className="mx-auto mb-3 text-muted-foreground" size={40} />
                  {selectedFile ? (
                    <p className="text-foreground font-medium">{selectedFile.name}</p>
                  ) : (
                    <>
                      <p className="text-foreground font-medium">Drop your file here or click to browse</p>
                      <p className="text-sm text-muted-foreground mt-1">PDF, DOC, DOCX, TXT, MD supported</p>
                    </>
                  )}
                </label>
              </div>
            )}

            {/* Content Analysis Info */}
            {contentAnalysis && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Word Count:</span>
                    <span className="ml-2 font-medium">{contentAnalysis.word_count}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Reading Time:</span>
                    <span className="ml-2 font-medium">{contentAnalysis.estimated_reading_time} min</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Complexity:</span>
                    <span className="ml-2 font-medium">{(contentAnalysis.complexity_score * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Recommended:</span>
                    <span className="ml-2 font-medium">{contentAnalysis.recommended_topics} topics</span>
                  </div>
                </div>
              </div>
            )}

            {/* Process Button */}
            <Button
              className="w-full gap-2"
              size="lg"
              disabled={!canProceed || isProcessing || isAnalyzing}
              onClick={handleProcessContent}
            >
              {isProcessing ? (
                <>
                  <div className="inline-block h-4 w-4 mr-2 rounded-full border-2 border-transparent border-t-[#97E35C] border-r-[#97E35C] animate-spin"></div>
                  <span className="bg-gradient-to-r from-[#97E35C] to-[#7BC850] bg-clip-text text-transparent font-semibold">
                    Processing...
                  </span>
                </>
              ) : (
                <>
                  Process Content
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
                            <Slider value={topicCount} onValueChange={setTopicCount} min={2} max={50} step={1} />
                            <p className="text-xs text-muted-foreground mt-1">
                              More topics = more comprehensive coverage (up to 50 topics)
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
