import { useState } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { AccuracyMeter } from "@/components/AccuracyMeter";
import { Upload, FileText, Send, ChevronLeft, ChevronRight, ArrowLeft, ArrowRight } from "lucide-react";

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
  const [accuracy, setAccuracy] = useState(85);
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

  const handleDifficultyClick = (difficulty: 'hard' | 'good' | 'easy') => {
    // Update accuracy based on difficulty
    if (difficulty === 'easy') {
      setAccuracy(Math.min(100, accuracy + 5));
    } else if (difficulty === 'good') {
      setAccuracy(Math.min(100, accuracy + 2));
    } else {
      setAccuracy(Math.max(0, accuracy - 3));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="flex-shrink-0">
        <Sidebar />
      </div>
      
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Panel - Study Material Upload */}
        <div className={`${isMinimized ? 'w-0 lg:w-12' : 'w-full lg:w-1/3'} bg-white border-b lg:border-r lg:border-b-0 border-gray-200 transition-all duration-300 overflow-hidden`}>
          {isMinimized ? (
            <div className="hidden lg:block p-3">
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
                  className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <ChevronLeft size={20} className="text-gray-600" />
                </button>
              </div>
              
              <div className="space-y-4">
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
        <div className="flex-1 p-4 lg:p-6 flex flex-col relative">
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
            <div className="max-w-4xl mx-auto h-full flex flex-col justify-center">
              <div className="mb-4 lg:mb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xs lg:text-sm text-gray-500">
                    Card {currentCard + 1} of {sampleCards.length}
                  </span>
                  <div className="w-32 lg:w-48 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${((currentCard + 1) / sampleCards.length) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Bigger Flip Card */}
              <div className="relative h-64 lg:h-96 mb-6 lg:mb-8">
                <div 
                  className="absolute inset-0 w-full h-full transition-transform duration-500 cursor-pointer"
                  style={{
                    transformStyle: 'preserve-3d',
                    transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)'
                  }}
                  onClick={() => setIsFlipped(!isFlipped)}
                >
                  {/* Front of card */}
                  <div className="absolute inset-0 w-full h-full bg-white rounded-xl border border-gray-200 p-6 lg:p-12 flex items-center justify-center shadow-lg"
                       style={{ backfaceVisibility: 'hidden' }}>
                    <div className="text-center">
                      <h3 className="text-lg lg:text-2xl font-semibold text-gray-900 mb-4">
                        {sampleCards[currentCard]?.front}
                      </h3>
                      <p className="text-sm lg:text-base text-gray-500">Click to reveal answer</p>
                    </div>
                  </div>
                  
                  {/* Back of card */}
                  <div className="absolute inset-0 w-full h-full bg-blue-50 rounded-xl border border-blue-200 p-6 lg:p-12 flex items-center justify-center shadow-lg"
                       style={{ 
                         backfaceVisibility: 'hidden',
                         transform: 'rotateY(180deg)'
                       }}>
                    <div className="text-center">
                      <h3 className="text-base lg:text-xl font-medium text-blue-900 mb-4">
                        {sampleCards[currentCard]?.back}
                      </h3>
                      <p className="text-sm lg:text-base text-blue-600">Click to go back</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Navigation with bigger arrow buttons */}
              <div className="flex justify-between items-center mb-4">
                <button
                  onClick={prevCard}
                  disabled={currentCard === 0}
                  className="flex items-center px-4 lg:px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <ArrowLeft size={20} className="mr-2" />
                  <span className="hidden sm:inline">Previous</span>
                  <span className="sm:hidden">Prev</span>
                </button>
                
                <div className="flex space-x-2 lg:space-x-3">
                  <button 
                    onClick={() => handleDifficultyClick('hard')}
                    className="px-3 lg:px-6 py-2 lg:py-3 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors text-sm lg:text-base font-medium"
                  >
                    Hard
                  </button>
                  <button 
                    onClick={() => handleDifficultyClick('good')}
                    className="px-3 lg:px-6 py-2 lg:py-3 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 transition-colors text-sm lg:text-base font-medium"
                  >
                    Good
                  </button>
                  <button 
                    onClick={() => handleDifficultyClick('easy')}
                    className="px-3 lg:px-6 py-2 lg:py-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-sm lg:text-base font-medium"
                  >
                    Easy
                  </button>
                </div>

                <button
                  onClick={nextCard}
                  disabled={currentCard === sampleCards.length - 1}
                  className="flex items-center px-4 lg:px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="hidden sm:inline">Next</span>
                  <span className="sm:hidden">Next</span>
                  <ArrowRight size={20} className="ml-2" />
                </button>
              </div>

              {/* Navigation hint */}
              <div className="text-center">
                <p className="text-xs text-gray-400">
                  Use arrow keys to navigate between cards
                </p>
              </div>
            </div>
          )}

          {/* Accuracy Meter positioned on the right center - Better responsive positioning */}
          {speedRunStarted && (
            <div className="absolute right-4 top-1/2 transform -translate-y-1/2 hidden lg:block">
              <AccuracyMeter accuracy={accuracy} />
            </div>
          )}
        </div>

        {/* Mobile Accuracy Meter (Bottom on mobile) */}
        {speedRunStarted && (
          <div className="lg:hidden p-4 border-t border-gray-200">
            <div className="flex justify-center">
              <AccuracyMeter accuracy={accuracy} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
