import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { FolderPlus, FileText, Upload, Trash2 } from "lucide-react";

interface StudyFile {
  id: number;
  name: string;
  type: string;
  uploadedAt: Date;
}

export default function StudyFolders() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<StudyFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (uploadedFiles) {
      const newFiles: StudyFile[] = Array.from(uploadedFiles).map((file) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type || 'document',
        uploadedAt: new Date()
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      const newFiles: StudyFile[] = Array.from(droppedFiles).map((file) => ({
        id: Date.now() + Math.random(),
        name: file.name,
        type: file.type || 'document',
        uploadedAt: new Date()
      }));
      setFiles([...files, ...newFiles]);
    }
  };

  const handleDeleteFile = (id: number) => {
    setFiles(files.filter(f => f.id !== id));
  };

  const handleFileClick = (fileName: string) => {
    navigate(`/quiz/${fileName.toLowerCase().replace(/\.[^/.]+$/, "")}`);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">My Study Materials</h1>
            <p className="text-muted-foreground">Upload your study files to create quizzes and flashcards</p>
          </div>

          {/* Upload area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`mb-8 border-2 border-dashed rounded-xl p-8 text-center transition-all ${
              isDragging 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-foreground font-medium mb-2">Drag and drop your files here</p>
            <p className="text-muted-foreground text-sm mb-4">or</p>
            <label className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors cursor-pointer">
              <FolderPlus size={18} className="mr-2" />
              Browse Files
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                accept=".pdf,.doc,.docx,.txt,.md"
              />
            </label>
            <p className="text-muted-foreground text-xs mt-3">Supports PDF, DOC, DOCX, TXT, MD</p>
          </div>

          {/* Files list */}
          {files.length > 0 ? (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-foreground mb-4">Uploaded Files ({files.length})</h2>
              {files.map((file) => (
                <div 
                  key={file.id}
                  className="flex items-center justify-between p-4 bg-card rounded-lg border border-border hover:border-primary/30 transition-all group"
                >
                  <div 
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => handleFileClick(file.name)}
                  >
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {file.uploadedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-card rounded-xl border border-border">
              <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No files yet</h3>
              <p className="text-muted-foreground text-sm">Upload your first study material to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
