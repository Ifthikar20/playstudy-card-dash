import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, FileText } from "lucide-react";

interface StudyContentUploadProps {
  onContentSubmit: (content: string) => void;
  isProcessing?: boolean;
}

export function StudyContentUpload({ onContentSubmit, isProcessing }: StudyContentUploadProps) {
  const [content, setContent] = useState("");

  const handleSubmit = () => {
    if (content.trim()) {
      onContentSubmit(content.trim());
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <FileText size={20} />
          Upload Study Material
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Paste your study material below. We'll analyze it and extract major topics with questions for you.
        </p>
        
        <Textarea
          placeholder="Paste your study notes, textbook content, or any educational material here..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[200px] resize-none"
          disabled={isProcessing}
        />

        <div className="flex gap-2">
          <Button 
            onClick={handleSubmit} 
            disabled={!content.trim() || isProcessing}
            className="flex-1"
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
                <Upload size={16} className="mr-2" />
                Extract Topics & Generate Questions
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Topics and questions will be generated based on your content
        </p>
      </CardContent>
    </Card>
  );
}
