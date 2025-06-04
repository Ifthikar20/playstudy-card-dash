
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { DashboardCard } from "@/components/DashboardCard";
import { 
  Book, 
  Calculator, 
  Globe, 
  Atom, 
  Palette, 
  Music,
  Plus
} from "lucide-react";

const topics = [
  { id: 1, name: "Mathematics", icon: Calculator, description: "Algebra, Calculus, Geometry" },
  { id: 2, name: "Science", icon: Atom, description: "Physics, Chemistry, Biology" },
  { id: 3, name: "Literature", icon: Book, description: "Classic and Modern Literature" },
  { id: 4, name: "History", icon: Globe, description: "World History and Civilizations" },
  { id: 5, name: "Art", icon: Palette, description: "Visual Arts and Design" },
  { id: 6, name: "Music", icon: Music, description: "Music Theory and History" },
];

export default function StudyFolders() {
  const navigate = useNavigate();
  const [folderName, setFolderName] = useState("");

  const handleTopicClick = (topicName: string) => {
    navigate(`/quiz/${topicName.toLowerCase()}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <Sidebar />
      
      <div className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Study Topics</h1>
            <p className="text-gray-600">Choose a topic to start your quiz session</p>
          </div>

          {/* Create new folder */}
          <div className="mb-8 bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Study Folder</h2>
            <div className="flex space-x-4">
              <input
                type="text"
                placeholder="Enter folder name..."
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={() => {
                  if (folderName.trim()) {
                    navigate(`/quiz/${folderName.toLowerCase()}`);
                  }
                }}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} className="mr-2" />
                Create
              </button>
            </div>
          </div>

          {/* Topic grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topics.map((topic) => (
              <DashboardCard
                key={topic.id}
                title={topic.name}
                description={topic.description}
                icon={topic.icon}
                onClick={() => handleTopicClick(topic.name)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
