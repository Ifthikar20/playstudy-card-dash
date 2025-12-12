import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { FolderPlus, FileText, Upload, Trash2, X, Eye } from "lucide-react";

interface StudyFile {
  id: number;
  name: string;
  type: string;
  content: string;
  uploadedAt: Date;
}

export default function StudyFolders() {
  const [files, setFiles] = useState<StudyFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<StudyFile | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFiles = e.target.files;
    if (uploadedFiles) {
      for (const file of Array.from(uploadedFiles)) {
        const content = await file.text();
        const newFile: StudyFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type || 'document',
          content,
          uploadedAt: new Date()
        };
        setFiles(prev => [...prev, newFile]);
      }
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      for (const file of Array.from(droppedFiles)) {
        const content = await file.text();
        const newFile: StudyFile = {
          id: Date.now() + Math.random(),
          name: file.name,
          type: file.type || 'document',
          content,
          uploadedAt: new Date()
        };
        setFiles(prev => [...prev, newFile]);
      }
    }
  };

  const handleDeleteFile = (id: number) => {
    setFiles(files.filter(f => f.id !== id));
    if (selectedFile?.id === id) setSelectedFile(null);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">My Study Materials</h1>
            <p className="text-muted-foreground">Upload and view your study files</p>
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
                  className={`flex items-center justify-between p-4 bg-card rounded-lg border transition-all group cursor-pointer ${
                    selectedFile?.id === file.id ? 'border-primary' : 'border-border hover:border-primary/30'
                  }`}
                  onClick={() => setSelectedFile(file)}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <FileText className="w-8 h-8 text-primary" />
                    <div>
                      <p className="font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Uploaded {file.uploadedAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(file); }}
                      className="p-2 text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
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

      {/* File Preview Modal */}
      {selectedFile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-primary" />
                <h3 className="font-semibold text-foreground">{selectedFile.name}</h3>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="p-2 hover:bg-accent rounded-lg transition-colors"
              >
                <X size={20} className="text-muted-foreground" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <pre className="whitespace-pre-wrap text-sm text-foreground font-mono bg-muted/30 p-4 rounded-lg">
                {selectedFile.content || "Unable to display file content"}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
