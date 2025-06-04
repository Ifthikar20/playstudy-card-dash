
import { useState } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { AccuracyMeter } from "@/components/AccuracyMeter";
import { Upload, FileText, Send, ChevronLeft, ChevronRight } from "lucide-react";

const sampleCards = [
  {
    front: "What is the capital of France?",
    back: "Paris - The capital and largest city of France, located in the north-central part of the country."
  },
  {
    front: "What is 2 + 2?",
    back: "4 - This is a basic addition problem in arithmetic."
  },
  {
    front: "Who wrote Romeo and Juliet?",
    back: "William Shakespeare - An English playwright and poet from the 16th century."
  }
];

export default function SpeedRunPage() {
  const { topic } = useParams();
  const [studyMaterial, setStudyMaterial] = useState("");
  const [currentCard, setCurrentCard] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [accuracy, setAccuracy] = useState(100);
  const [speedRunStarted, setSpeedRunStarted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setStudyMaterial(e.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const nextCard = () => {
    if (currentCard < sampleCards.length - 1) {
      setCurrentCard(currentCard + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentCard > 0) {
      setCurrentCard(currentCard - 1);
      setIsFlipped(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col lg:flex-row">
      <div className="lg:hidden">
        <Sidebar />
      </div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Panel - Study Material Upload */}
        <div className={`${isMinimized ? 'w-full lg:w-12' : 'w-full lg:w-1/3'} bg-white border-b lg:border-r lg:border-b-0 border-gray-200 transition-all duration-300`}>
          {isMinimized ? (
            <div className="p-3">
              <button
                onClick={() => setIsMinimized(false)}
                className="w-full p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <ChevronRight size={20} className="mx-auto text-gray-600" />
              </button>
            </div>
          ) : (
            <div className="p-4 lg:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg lg:text-xl font-semibold text-gray-900">
                  Study Material - {topic}
                </h2>
                <button
                  onClick={() => setIsMinimized(true)}
                  className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* File Upload */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 lg:p-6 text-center hover:border-blue-400 transition-colors">
                  <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    accept=".txt,.pdf,.doc,.docx"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer">
                    <Upload size={24} className="mx-auto text-gray-400 mb-2 lg:w-8 lg:h-8" />
                    <p className="text-sm lg:text-base text-gray-600">Click to upload study material</p>
                    <p className="text-xs lg:text-sm text-gray-400">PDF, DOC, TXT files</p>
                  </label>
                </div>

                {/* Text Area */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Or paste your content here:
                  </label>
                  <textarea
                    value={studyMaterial}
                    onChange={(e) => setStudyMaterial(e.target.value)}
                    placeholder="Paste your study material here..."
                    className="w-full h-32 lg:h-64 px-3 py-2 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm lg:text-base"
                  />
                </div>

                <button
                  onClick={() => setSpeedRunStarted(true)}
                  disabled={!studyMaterial.trim()}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 transition-colors text-sm lg:text-base"
                >
                  <Send size={16} className="mr-2 lg:w-5 lg:h-5" />
                  Generate Speed Run
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Center Panel - Flip Cards */}
        <div className="flex-1 p-4 lg:p-6 flex flex-col">
          {!speedRunStarted ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <FileText size={48} className="mx-auto text-gray-400 mb-4 lg:w-16 lg:h-16" />
                <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-2">
                  Upload Study Material to Start Speed Run
                </h3>
                <p className="text-sm lg:text-base text-gray-600">
                  Add your study content and we'll generate flip cards for memory training
                </p>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto h-full flex flex-col justify-center">
              <div className="mb-4 lg:mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs lg:text-sm text-gray-500">
                    Card {currentCard + 1} of {sampleCards.length}
                  </span>
                  <div className="w-20 lg:w-32 bg-gray-200 rounded-full h-1.5 lg:h-2">
                    <div
                      className="bg-blue-600 h-1.5 lg:h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentCard + 1) / sampleCards.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Flip Card */}
              <div className="relative h-48 lg:h-80 mb-6 lg:mb-8">
                <div 
                  className="absolute inset-0 w-full h-full transition-transform duration-500 cursor-pointer"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front of card */}
                  <div className="absolute inset-0 w-full h-full bg-white rounded-xl border border-gray-200 p-4 lg:p-8 flex items-center justify-center"
                       style={{ backfaceVisibility: 'hidden' }}>
                    <div className="text-center">
                      <h3 className="text-base lg:text-xl font-semibold text-gray-900 mb-2 lg:mb-4">
                        {sampleCards[currentCard]?.front}
                      </h3>
                      <p className="text-xs lg:text-sm text-gray-500">Click to reveal answer</p>
                    </div>
                  </div>
                  
                  {/* Back of card */}
                  <div className="absolute inset-0 w-full h-full bg-blue-50 rounded-xl border border-blue-200 p-4 lg:p-8 flex items-center justify-center"
                       style={{ 
                         backfaceVisibility: 'hidden',
                         transform: 'rotateY(180deg)'
                       }}>
                    <div className="text-center">
                      <h3 className="text-sm lg:text-lg font-medium text-blue-900 mb-2 lg:mb-4">
                        {sampleCards[currentCard]?.back}
                      </h3>
                      <p className="text-xs lg:text-sm text-blue-600">Click to go back</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="flex justify-between items-center">
                <button
                  onClick={prevCard}
                  disabled={currentCard === 0}
                  className="flex items-center px-2 lg:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                >
                  <ChevronLeft size={16} className="mr-1 lg:mr-2 lg:w-5 lg:h-5" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>
                
                <div className="flex space-x-1 lg:space-x-2">
                  <button className="px-2 lg:px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-xs lg:text-sm">
                    Hard
                  </button>
                  <button className="px-2 lg:px-4 py-2 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-xs lg:text-sm">
                    Good
                  </button>
                  <button className="px-2 lg:px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs lg:text-sm">
                    Easy
                  </button>
                </div>

                <button
                  onClick={nextCard}
                  disabled={currentCard === sampleCards.length - 1}
                  className="flex items-center px-2 lg:px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm lg:text-base"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ChevronRight size={16} className="ml-1 lg:ml-2 lg:w-5 lg:h-5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Accuracy Meter (Hidden on mobile) */}
        <div className="hidden lg:block w-24 p-4">
          <AccuracyMeter accuracy={accuracy} />
        </div>

        {/* Mobile Accuracy Meter (Bottom on mobile) */}
        <div className="lg:hidden p-4">
          <div className="flex justify-center">
            <AccuracyMeter accuracy={accuracy} />
          </div>
        </div>
      </div>
    </div>
  );
}
