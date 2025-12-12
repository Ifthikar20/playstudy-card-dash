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
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CreateStudySessionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Step = "upload" | "select-mode";
type UploadType = "file" | "text";
type StudyMode = "full-study" | "speed-run" | "game";

export function CreateStudySessionDialog({ open, onOpenChange }: CreateStudySessionDialogProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("upload");
  const [uploadType, setUploadType] = useState<UploadType>("text");
  const [textContent, setTextContent] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedMode, setSelectedMode] = useState<StudyMode | null>(null);
  const [topicCount, setTopicCount] = useState([5]);
  const [questionCount, setQuestionCount] = useState([20]);
  const [speedRunDuration, setSpeedRunDuration] = useState([10]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleProcessContent = async () => {
    setIsProcessing(true);
    // Simulate processing
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsProcessing(false);
    setStep("select-mode");
  };

  const handleStartSession = () => {
    onOpenChange(false);
    
    if (selectedMode === "full-study") {
      navigate("/full-study");
    } else if (selectedMode === "speed-run") {
      navigate("/speedrun");
    } else if (selectedMode === "game") {
      navigate("/browse-games");
    }
    
    // Reset state
    setStep("upload");
    setUploadType("text");
    setTextContent("");
    setSelectedFile(null);
    setSelectedMode(null);
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
              <Textarea
                placeholder="Paste your study material here... (notes, textbook content, articles, etc.)"
                className="min-h-[200px] resize-none"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
              />
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

            {/* Process Button */}
            <Button 
              className="w-full gap-2" 
              size="lg"
              disabled={!canProceed || isProcessing}
              onClick={handleProcessContent}
            >
              {isProcessing ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Processing...
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
                              <span className="font-medium">{topicCount[0]}</span>
                            </div>
                            <Slider value={topicCount} onValueChange={setTopicCount} min={3} max={15} step={1} />
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-2">
                              <span className="text-muted-foreground">Questions per topic</span>
                              <span className="font-medium">{questionCount[0]}</span>
                            </div>
                            <Slider value={questionCount} onValueChange={setQuestionCount} min={5} max={50} step={5} />
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
                      <p className="text-sm text-muted-foreground">Play a single competitive study game</p>
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
