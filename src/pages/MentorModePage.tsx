import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useAppStore } from "@/store/appStore";
import { aiVoiceService, TTSProvider } from "@/services/aiVoice";
import {
  Play,
  Pause,
  SkipForward,
  SkipBack,
  Volume2,
  VolumeX,
  ArrowLeft,
  Mic,
  Settings,
  MessageSquare
} from "lucide-react";

export default function MentorModePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentSession, studySessions } = useAppStore();
  const transcriptRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTopicIndex, setCurrentTopicIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<TTSProvider>(aiVoiceService.getProvider());
  const [currentVoice, setCurrentVoice] = useState<string>(
    aiVoiceService.getAvailableVoices()[0]?.id || 'nova'
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState(aiVoiceService.getAvailableProviders());
  const [currentTranscript, setCurrentTranscript] = useState<string>('');
  const [fullNarrative, setFullNarrative] = useState<string>('');

  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  useEffect(() => {
    if (!session) {
      navigate('/dashboard');
    }
  }, [session, navigate]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current && isPlaying) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [currentTranscript, isPlaying]);

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setError('Please log in to use AI Mentor Mode.');
      return;
    }

    const loadProvidersAndVoices = async () => {
      try {
        console.log('[Mentor Mode] Fetching providers...');
        const providers = await aiVoiceService.fetchProviders();
        console.log('[Mentor Mode] Providers received:', providers);
        setAvailableProviders(providers);

        // Use OpenAI as primary provider
        const configuredProvider = providers.find(p => p.configured && p.id === 'openai') || providers.find(p => p.configured);
        if (configuredProvider) {
          console.log('[Mentor Mode] Using provider:', configuredProvider.id);
          setCurrentProvider(configuredProvider.id);
          aiVoiceService.setProvider(configuredProvider.id);

          const voices = await aiVoiceService.fetchVoices(configuredProvider.id);
          console.log(`[Mentor Mode] Voices for ${configuredProvider.id}:`, voices);

          if (voices.length > 0) {
            // Use the first voice (default Google Cloud voice)
            setCurrentVoice(voices[0].id);
          }
        }
      } catch (error) {
        console.error('[Mentor Mode] Failed to load providers:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        if (errorMessage.includes('Authentication')) {
          setError('Please log in to use AI Mentor Mode.');
        } else {
          setError('Failed to initialize TTS. Please check your configuration.');
        }
      }
    };

    loadProvidersAndVoices();
  }, []);

  if (!session) {
    return null;
  }

  const topics = session.extractedTopics || [];
  const currentTopic = topics[currentTopicIndex];

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false);
      aiVoiceService.pause();
    } else {
      setIsPlaying(true);
      if (currentTopic && !isReading) {
        speakContent(currentTopic);
      } else {
        aiVoiceService.resume();
      }
    }
  };

  // Generate additional contextual examples
  const generateAdditionalExamples = (topicTitle: string, question: string, conceptNumber: number): string => {
    const searchText = `${topicTitle} ${question}`.toLowerCase();

    // Programming examples
    if (searchText.includes('variable')) {
      return `Example 1: In a game, a variable called "score" keeps track of your points. Start at 0, get 10 points for each level—the variable updates automatically.\n\nExample 2: In a shopping cart, a variable called "totalPrice" adds up all your items. Add a $20 shirt, a $15 hat—the total becomes $35. That's variables storing and updating data.`;
    }

    if (searchText.includes('loop')) {
      return `Example 1: Your alarm clock uses a loop. Every 60 seconds, it checks: "Is it time to ring?" If not, wait another 60 seconds and check again. That's a loop in action.\n\nExample 2: When Netflix loads videos, it uses a loop to download each chunk of data until the whole video is ready. Check, download, repeat—that's how streaming works.`;
    }

    if (searchText.includes('function')) {
      return `Example 1: The "like" button on social media is a function. Click it, and it: (1) updates the count, (2) changes color, (3) saves to database. Same steps, every time.\n\nExample 2: Your phone's calculator has a function for addition. Type 5 + 3, press equals, it always returns 8. One function, works every time you need it.`;
    }

    if (searchText.includes('array')) {
      return `Example 1: Your browser tabs are like an array. Each tab is an item in order. Close one, the others shift up. That's how arrays manage lists.\n\nExample 2: Amazon's shopping cart is an array of products. Add items, remove items, view them in order—classic array behavior.`;
    }

    // Math examples
    if (searchText.includes('algebra')) {
      return `Example 1: You're splitting a $60 dinner bill among friends. If there are x people, each pays 60 ÷ x. That's algebra solving real problems.\n\nExample 2: Your phone battery drains 10% per hour. If it's at 80%, how long until it dies? 80 ÷ 10 = 8 hours. You just used algebra!`;
    }

    if (searchText.includes('geometry')) {
      return `Example 1: Parking your car? You're using angles and spatial reasoning—pure geometry. Will it fit? What angle do I turn?\n\nExample 2: Playing pool or mini-golf? Every shot uses geometry—angles of reflection, distances, trajectories. Geometry in action!`;
    }

    // Science examples
    if (searchText.includes('physics')) {
      return `Example 1: Riding a bike around a turn? You lean inward to balance centrifugal force. That's physics keeping you upright.\n\nExample 2: Your phone's gyroscope detects rotation using physics principles. Rotate your phone, the screen rotates—physics sensors at work.`;
    }

    if (searchText.includes('chemistry')) {
      return `Example 1: Soap cleaning dishes uses chemistry. Soap molecules grab grease on one end, water on the other—chemical bonding in action.\n\nExample 2: Your car battery? Chemical reactions between lead and acid create electricity. Turn the key—chemistry starts your car.`;
    }

    // SaaS/Infrastructure examples
    if (searchText.includes('saas') || searchText.includes('cloud') || searchText.includes('infrastructure')) {
      return `Example 1: When you upload a photo to Instagram, it: (1) goes to their servers (infrastructure), (2) gets processed (platform), (3) appears in your feed (application). All layers working together.\n\nExample 2: Google Docs lets multiple people edit at once. The infrastructure handles millions of users, the platform syncs changes, the app shows you the document. Three layers, seamless experience.`;
    }

    if (searchText.includes('layer') || searchText.includes('architecture')) {
      return `Example 1: Ordering food on Uber Eats: You use the app layer (UI), it processes your order (application layer), payment goes through Stripe (service layer), data saves to database (data layer). Multiple layers working as one.\n\nExample 2: Watching Netflix: Your device (user layer), Netflix app (application layer), recommendation engine (services layer), video files (data layer), AWS servers (infrastructure layer). Five layers delivering your show.`;
    }

    // Default comprehensive examples
    return `Example 1: Think of this like building a house. You need a foundation (the basics), walls (the structure), and a roof (protection). Each part depends on the others, just like this concept builds on fundamentals.\n\nExample 2: Or consider your smartphone. The hardware is the foundation, the operating system is the platform, and your apps are what you interact with. Each layer serves a purpose, working together to give you the experience you want.`;
  };

  // Generate real-world examples based on the topic and question
  const generateRealWorldExample = (topicTitle: string, question: string, answer: string): string => {
    // Create contextual examples based on common educational topics
    const examples = {
      // Programming concepts
      variables: "Think of a variable like a labeled box in your kitchen. Just like you might have a box labeled 'Sugar' that holds sugar, a variable called 'userName' holds a person's name. You can change what's inside the box anytime!",
      loops: "Imagine you're washing dishes. You repeat the same process: pick up dish, scrub it, rinse it, put it away. That's exactly what a loop does in code - it repeats actions until the job is done!",
      functions: "A function is like a recipe. Once you write down the recipe for chocolate chip cookies, you can make them anytime by following those steps. Same with functions - write the code once, use it many times!",
      arrays: "An array is like a playlist on your phone. It's a list of songs (items) in a specific order. You can add songs, remove songs, or play them in sequence. That's how arrays organize data!",

      // Math concepts
      algebra: "If you're shopping and see '20% off', you're using algebra! The original price (x) minus 20% equals what you pay. That's solving for an unknown value - pure algebra in action!",
      geometry: "When you're hanging a picture frame and want it centered on the wall, you're using geometry! You measure the wall width, divide by 2, and that's where the center point goes.",
      fractions: "Ordering pizza? If you eat 3 out of 8 slices, you've eaten 3/8 of the pizza. That's fractions in real life - parts of a whole!",

      // Science concepts
      physics: "Ever wonder why seatbelts keep you safe? It's Newton's First Law - your body wants to keep moving forward when the car stops suddenly. The seatbelt provides the force to stop you safely!",
      chemistry: "Baking a cake is chemistry! When you mix baking soda with acidic ingredients, a chemical reaction produces gas bubbles that make your cake rise. Science in the kitchen!",
      biology: "Your smartphone screen responds to your finger because of the electricity in your body! Human cells generate tiny electrical signals, and touch screens detect this - biology meets technology!",

      // General fallback
      default: `Let's connect this to everyday life: ${answer.toLowerCase()}. This concept appears all around us - from the apps we use, to the decisions we make, to how systems work in the real world. The key is recognizing these patterns once you understand the fundamentals!`
    };

    // Try to match keywords in the question or topic
    const searchText = `${topicTitle} ${question} ${answer}`.toLowerCase();

    if (searchText.includes('variable') || searchText.includes('store')) return examples.variables;
    if (searchText.includes('loop') || searchText.includes('repeat') || searchText.includes('iterate')) return examples.loops;
    if (searchText.includes('function') || searchText.includes('method')) return examples.functions;
    if (searchText.includes('array') || searchText.includes('list')) return examples.arrays;
    if (searchText.includes('algebra') || searchText.includes('equation')) return examples.algebra;
    if (searchText.includes('geometry') || searchText.includes('shape') || searchText.includes('angle')) return examples.geometry;
    if (searchText.includes('fraction') || searchText.includes('divide')) return examples.fractions;
    if (searchText.includes('physics') || searchText.includes('force') || searchText.includes('motion')) return examples.physics;
    if (searchText.includes('chemistry') || searchText.includes('reaction')) return examples.chemistry;
    if (searchText.includes('biology') || searchText.includes('cell')) return examples.biology;

    return examples.default;
  };

  // Handle provider change
  const handleProviderChange = async (provider: TTSProvider) => {
    aiVoiceService.stop();
    setIsPlaying(false);
    setIsReading(false);
    setCurrentProvider(provider);
    aiVoiceService.setProvider(provider);

    try {
      const voices = await aiVoiceService.fetchVoices(provider);
      if (voices.length > 0) {
        setCurrentVoice(voices[0].id);
      }
    } catch (error) {
      console.error('Failed to load voices:', error);
      setError('Failed to load voices for the selected provider.');
    }
  };

  const speakContent = async (topic: any) => {
    setIsReading(true);
    setIsLoading(true);
    setError(null);

    // Create an extensive, teacher-style narrative
    let narrative = `Hey there! I'm your AI mentor, and today we're going to deeply explore ${topic.title}. \n\nI won't just tell you what it is—I'll show you how it works in the real world, why it matters, and how you can apply it. Let's make this crystal clear!\n\n`;

    if (topic.description) {
      narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      narrative += `📚 What is ${topic.title}?\n\n`;
      narrative += `${topic.description}\n\n`;
      narrative += `Now, let me break this down in a way that makes sense. We'll go through each concept step by step, with real examples you see every single day.\n\n`;
    }

    // Generate extensive content for each question/concept
    if (topic.questions && topic.questions.length > 0) {
      topic.questions.forEach((q: any, idx: number) => {
        const questionNumber = idx + 1;
        const correctAnswer = q.options[q.correctAnswer];

        narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        narrative += `🎯 CONCEPT ${questionNumber}: ${q.question}\n\n`;

        // Main explanation - extensive
        if (q.explanation) {
          narrative += `💡 Let me explain this clearly:\n\n`;
          narrative += `${q.explanation}\n\n`;

          // Add deeper context
          narrative += `Here's what this means in practice:\n\n`;
          narrative += `Think about it this way—this concept is fundamental because it shows up everywhere. Whether you're building something, solving a problem, or just trying to understand how things work, this is one of those core ideas you'll use again and again.\n\n`;
        }

        // Key answer with emphasis
        narrative += `✅ KEY ANSWER:\n`;
        narrative += `${correctAnswer}\n\n`;
        narrative += `This is important—write this down if you can. This is the core takeaway.\n\n`;

        // Real-world example - extensive with multiple scenarios
        narrative += `🌍 REAL-WORLD EXAMPLES:\n\n`;
        const mainExample = generateRealWorldExample(topic.title, q.question, correctAnswer);
        narrative += `${mainExample}\n\n`;

        // Add additional context examples
        narrative += `Let me give you more examples so you really get this:\n\n`;
        narrative += generateAdditionalExamples(topic.title, q.question, questionNumber);
        narrative += `\n`;

        // Why it matters section
        narrative += `❓ WHY THIS MATTERS:\n\n`;
        narrative += `You might be wondering—why do I need to know this? Here's why:\n\n`;
        narrative += `Understanding ${correctAnswer.toLowerCase()} isn't just about passing a test. It's about building a mental model of how things work. Once you understand this, you'll start seeing it everywhere—in the apps you use, the problems you solve, even in everyday situations.\n\n`;

        // Remember this - key takeaway
        narrative += `📌 REMEMBER THIS:\n\n`;
        narrative += `If you forget everything else, remember this: ${correctAnswer}.\n\n`;
        narrative += `This connects directly to how ${topic.title.toLowerCase()} works in the real world. When you encounter similar situations, you'll know exactly what's happening and why.\n\n`;

        // Add spacing between concepts
        if (idx < topic.questions.length - 1) {
          narrative += `Alright, let's move to the next concept. Stay with me!\n\n`;
        }
      });
    } else {
      narrative += `This topic contains important concepts about ${topic.title}. Let me walk you through the key ideas, one by one.\n\n`;
    }

    // Comprehensive summary
    narrative += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    narrative += `🎓 LESSON SUMMARY:\n\n`;
    narrative += `Okay, let's recap what we've covered about ${topic.title}.\n\n`;

    // List key points
    if (topic.questions && topic.questions.length > 0) {
      narrative += `We discussed ${topic.questions.length} major concept${topic.questions.length > 1 ? 's' : ''}:\n\n`;
      topic.questions.forEach((q: any, idx: number) => {
        narrative += `${idx + 1}. ${q.options[q.correctAnswer]}\n`;
      });
      narrative += `\n`;
    }

    narrative += `Take a moment to think about these ideas. How do they connect? Where have you seen them before? How can you use them?\n\n`;
    narrative += `Remember: Learning isn't about memorizing—it's about understanding. And you're doing great!\n\n`;
    narrative += `When you're ready, let's move to the next topic. There's so much more to explore!`;

    setFullNarrative(narrative);
    setCurrentTranscript('');

    // Simulate live transcript
    const words = narrative.split(' ');
    let wordIndex = 0;
    let transcriptInterval: NodeJS.Timeout;

    const startTranscript = () => {
      transcriptInterval = setInterval(() => {
        if (wordIndex < words.length) {
          setCurrentTranscript(prev => {
            const newText = prev + (prev ? ' ' : '') + words[wordIndex];
            wordIndex++;
            return newText;
          });
        } else {
          clearInterval(transcriptInterval);
        }
      }, 120); // Optimized for natural reading pace with OpenAI TTS
    };

    const handleEnd = () => {
      if (transcriptInterval) clearInterval(transcriptInterval);
      setCurrentTranscript(narrative);
      setIsReading(false);
      setIsPlaying(false);
      if (currentTopicIndex < topics.length - 1) {
        setProgress(((currentTopicIndex + 1) / topics.length) * 100);
      } else {
        setProgress(100);
      }
    };

    const handleError = (error: Error) => {
      if (transcriptInterval) clearInterval(transcriptInterval);
      console.error('[TTS Error]:', error);
      setError(`Unable to play audio: ${error.message}`);
      setIsReading(false);
      setIsPlaying(false);
      setIsLoading(false);
    };

    try {
      setIsLoading(true);

      // Start transcript animation slightly before audio starts
      setTimeout(startTranscript, 500);

      await aiVoiceService.speak(
        narrative,
        {
          voice: currentVoice,
          speed: 1.0, // Normal speed for natural conversation
          model: currentProvider === 'openai' ? 'tts-1' : undefined, // Fast, high-quality OpenAI model
          pitch: 0,
          provider: currentProvider
        },
        {
          onEnd: handleEnd,
          onError: handleError
        }
      );
      setIsLoading(false);
    } catch (error) {
      handleError(error as Error);
    }
  };

  const handleNext = () => {
    if (currentTopicIndex < topics.length - 1) {
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex + 1);
      setIsPlaying(false);
      setIsReading(false);
      setCurrentTranscript('');
      setProgress(((currentTopicIndex + 1) / topics.length) * 100);
    }
  };

  const handlePrevious = () => {
    if (currentTopicIndex > 0) {
      aiVoiceService.stop();
      setCurrentTopicIndex(currentTopicIndex - 1);
      setIsPlaying(false);
      setIsReading(false);
      setCurrentTranscript('');
      setProgress(((currentTopicIndex - 1) / topics.length) * 100);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    aiVoiceService.setVolume(newMutedState ? 0 : 1);
  };

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar />

      <div className="flex-1 flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 md:p-6 border-b">
          <Button
            variant="ghost"
            className="mb-2"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft size={18} className="mr-2" />
            Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Mic className="text-primary" size={24} />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-foreground">
                  AI Mentor Session
                </h1>
                <p className="text-sm text-muted-foreground">{session.title}</p>
              </div>
            </div>

            {/* Progress */}
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
                Topic {currentTopicIndex + 1} / {topics.length}
              </div>
              <div className="text-xs font-medium text-foreground">
                {Math.round(progress)}% Complete
              </div>
            </div>
          </div>

          <Progress value={progress} className="h-1 mt-3" />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden p-4 md:p-6 flex flex-col gap-4">
          {/* Settings Card - Collapsible */}
          <Card className="p-3">
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer list-none">
                <div className="flex items-center gap-2">
                  <Settings size={16} className="text-primary" />
                  <span className="text-sm font-medium">Voice Settings</span>
                </div>
                <span className="text-xs text-muted-foreground group-open:hidden">
                  {currentProvider === 'openai' ? 'OpenAI' : 'Google Cloud'} • {aiVoiceService.getAvailableVoices().find(v => v.id === currentVoice)?.name || 'Default'}
                </span>
              </summary>
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Provider</label>
                  <select
                    value={currentProvider}
                    onChange={(e) => handleProviderChange(e.target.value as TTSProvider)}
                    className="w-full text-sm border rounded px-2 py-1 mt-1 bg-background"
                  >
                    {availableProviders.map(provider => (
                      <option key={provider.id} value={provider.id}>
                        {provider.name} {!provider.configured ? '(Not configured)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Voice</label>
                  <select
                    value={currentVoice}
                    onChange={(e) => setCurrentVoice(e.target.value)}
                    className="w-full text-sm border rounded px-2 py-1 mt-1 bg-background"
                  >
                    {aiVoiceService.getAvailableVoices().map(voice => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </details>
          </Card>

          {/* Error */}
          {error && (
            <Card className="p-3 border-destructive bg-destructive/10">
              <p className="text-sm text-destructive mb-2">⚠️ {error}</p>
              {error.includes('log in') && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => navigate('/auth')}
                >
                  Go to Login
                </Button>
              )}
            </Card>
          )}

          {/* Conversation Area */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            {/* Transcript */}
            <div className="flex-1 overflow-auto p-4 space-y-4" ref={transcriptRef}>
              {/* Topic Header */}
              {currentTopic && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-foreground mb-2">{currentTopic.title}</h3>
                  <p className="text-sm text-muted-foreground">{currentTopic.description}</p>
                </div>
              )}

              {/* Live Transcript */}
              {currentTranscript && (
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare size={20} className="text-primary" />
                  </div>
                  <div className="flex-1 bg-accent/50 rounded-lg p-4">
                    <div className="text-xs font-medium text-primary mb-2">Your AI Mentor</div>
                    <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {currentTranscript.split('\n').map((line, index) => {
                        // Format special lines with styling
                        if (line.startsWith('🎯 CONCEPT')) {
                          return <div key={index} className="font-bold text-primary text-lg mt-6 mb-3 border-l-4 border-primary pl-3">{line}</div>;
                        } else if (line.startsWith('💡 Let me explain')) {
                          return <div key={index} className="font-semibold text-blue-600 dark:text-blue-400 mt-4 mb-2">{line}</div>;
                        } else if (line.startsWith('✅ KEY ANSWER:')) {
                          return <div key={index} className="font-bold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950 p-3 rounded-lg mt-3 mb-2 border-l-4 border-green-600">{line}</div>;
                        } else if (line.startsWith('🌍 REAL-WORLD EXAMPLES:')) {
                          return <div key={index} className="font-bold text-orange-600 dark:text-orange-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('❓ WHY THIS MATTERS:')) {
                          return <div key={index} className="font-bold text-indigo-600 dark:text-indigo-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('📌 REMEMBER THIS:')) {
                          return <div key={index} className="font-bold text-purple-600 dark:text-purple-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('🎓 LESSON SUMMARY:')) {
                          return <div key={index} className="font-bold text-primary text-lg mt-6 mb-3 border-l-4 border-primary pl-3">{line}</div>;
                        } else if (line.startsWith('📚 What is')) {
                          return <div key={index} className="font-bold text-blue-600 dark:text-blue-400 mt-4 mb-2 text-base">{line}</div>;
                        } else if (line.startsWith('Example 1:') || line.startsWith('Example 2:')) {
                          return <div key={index} className="ml-4 mt-2 text-foreground/90 italic border-l-2 border-orange-300 dark:border-orange-700 pl-3">{line}</div>;
                        } else if (line.match(/^\d+\./)) {
                          return <div key={index} className="ml-4 mt-1 font-medium">{line}</div>;
                        } else if (line.startsWith('━━━')) {
                          return <div key={index} className="border-t-2 border-primary/30 my-4"></div>;
                        } else if (line.trim() === '') {
                          return <div key={index} className="h-3"></div>;
                        } else {
                          return <div key={index} className="leading-relaxed">{line}</div>;
                        }
                      })}
                      {isPlaying && currentTranscript !== fullNarrative && (
                        <span className="inline-block w-1 h-4 bg-primary ml-1 animate-pulse" />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Placeholder */}
              {!currentTranscript && !isLoading && (
                <div className="flex items-center justify-center h-full text-center">
                  <div className="text-muted-foreground">
                    <Mic size={48} className="mx-auto mb-4 opacity-20" />
                    <p className="text-sm">Click play to start your lesson</p>
                    <p className="text-xs mt-2">Your AI mentor will explain the concepts here</p>
                  </div>
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="border-t p-4">
              <div className="flex items-center justify-center gap-3">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handlePrevious}
                  disabled={currentTopicIndex === 0}
                  title="Previous Topic"
                >
                  <SkipBack size={18} />
                </Button>

                <Button
                  size="lg"
                  className="w-14 h-14 rounded-full"
                  onClick={handlePlayPause}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span className="text-xs">...</span>
                  ) : isPlaying ? (
                    <Pause size={22} />
                  ) : (
                    <Play size={22} className="ml-0.5" />
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleNext}
                  disabled={currentTopicIndex === topics.length - 1}
                  title="Next Topic"
                >
                  <SkipForward size={18} />
                </Button>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </Button>
              </div>

              <div className="text-center mt-3 text-xs text-muted-foreground">
                {isLoading ? (
                  'Preparing your lesson...'
                ) : isPlaying ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    Speaking
                  </span>
                ) : (
                  'Ready to learn'
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
