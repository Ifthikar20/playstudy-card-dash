import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAppStore } from "@/store/appStore";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Pause, Play } from "lucide-react";
import kaboom from "kaboom";
import type { KaboomCtx } from "kaboom";

interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer: number;
}

export default function GameModePage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { currentSession, studySessions } = useAppStore();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<KaboomCtx | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [gameScore, setGameScore] = useState(0);
  const [gameHealth, setGameHealth] = useState(100);
  const [wave, setWave] = useState(1);
  const [enemiesDefeated, setEnemiesDefeated] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<Set<string>>(new Set());
  const [passedThresholds, setPassedThresholds] = useState<Set<number>>(new Set());
  const scoreThresholds = [100, 300, 600, 1000, 1500, 2100, 2800, 3600];

  // Find the session
  const session = sessionId
    ? studySessions.find(s => s.id === sessionId) || currentSession
    : currentSession;

  // Extract all questions from the session
  useEffect(() => {
    if (!session?.topicTree) return;

    const extractQuestions = (topics: any[]): Question[] => {
      const questions: Question[] = [];

      topics.forEach(topic => {
        if (topic.questions && topic.questions.length > 0) {
          topic.questions.forEach((q: any, index: number) => {
            questions.push({
              id: `${topic.id}-${index}`,
              text: q.question,
              options: q.options,
              correctAnswer: q.correctAnswer,
            });
          });
        }

        if (topic.subtopics && topic.subtopics.length > 0) {
          questions.push(...extractQuestions(topic.subtopics));
        }
      });

      return questions;
    };

    const questions = extractQuestions(session.topicTree);
    console.log('📚 Loaded questions:', questions.length);
    setAllQuestions(questions);
  }, [session]);

  // Check if we should ask a question based on score
  useEffect(() => {
    if (isGameOver || currentQuestion || allQuestions.length === 0) return;

    // Find thresholds we've crossed but haven't triggered yet
    const crossedThresholds = scoreThresholds.filter(
      threshold => gameScore >= threshold && !passedThresholds.has(threshold)
    );

    // Debug logging
    console.log('🎯 Score check - Current:', gameScore, 'Thresholds:', scoreThresholds);
    console.log('✅ Crossed thresholds:', crossedThresholds);
    console.log('📝 Passed thresholds:', Array.from(passedThresholds));

    if (crossedThresholds.length > 0) {
      // Take the first crossed threshold
      const threshold = crossedThresholds[0];
      console.log('🚨 Triggering question at threshold:', threshold);

      // Find a question we haven't asked yet
      const unaskedQuestions = allQuestions.filter(q => !askedQuestions.has(q.id));
      if (unaskedQuestions.length > 0) {
        const randomQuestion = unaskedQuestions[Math.floor(Math.random() * unaskedQuestions.length)];
        pauseGameForQuestion(randomQuestion);

        // Mark this threshold as passed
        setPassedThresholds(prev => new Set([...prev, threshold]));
      } else {
        console.log('⚠️ No unasked questions available');
      }
    }
  }, [gameScore, allQuestions, askedQuestions, isGameOver, currentQuestion, passedThresholds]);

  const pauseGameForQuestion = (question: Question) => {
    console.log('🎮 Pausing game for question:', question.text);
    console.log('📊 Current score:', gameScore);
    setCurrentQuestion(question);
    setIsPaused(true);
  };

  const handleAnswerQuestion = (selectedIndex: number) => {
    if (!currentQuestion) return;

    const isCorrect = selectedIndex === currentQuestion.correctAnswer;

    // Mark question as asked
    setAskedQuestions(prev => new Set([...prev, currentQuestion.id]));

    if (isCorrect) {
      // Correct answer - resume game
      setCurrentQuestion(null);
      setIsPaused(false);
      // Bonus points
      setGameScore(prev => prev + 200);
    } else {
      // Wrong answer - game over
      setIsGameOver(true);
      setCurrentQuestion(null);
    }
  };

  useEffect(() => {
    if (!canvasRef.current || !session) return;

    // Initialize Kaboom
    const k = kaboom({
      canvas: canvasRef.current,
      width: 800,
      height: 600,
      background: [135, 206, 235],
      global: false,
    });

    gameRef.current = k;

    // Game state (using shapes instead of sprites)
    let score = 0;
    let health = 100;
    let currentWave = 1;
    let defeated = 0;

    // Animated starfield background
    for (let i = 0; i < 50; i++) {
      k.add([
        k.rect(2, 2),
        k.pos(k.rand(0, k.width()), k.rand(0, k.height())),
        k.color(255, 255, 255),
        k.opacity(k.rand(0.3, 0.8)),
        k.z(-1),
        {
          speed: k.rand(10, 30),
        },
        "star",
      ]);
    }

    k.onUpdate("star", (star) => {
      star.pos.y += star.speed * k.dt();
      if (star.pos.y > k.height()) {
        star.pos.y = 0;
        star.pos.x = k.rand(0, k.width());
      }
    });

    // UI Labels
    const scoreLabel = k.add([
      k.text("Score: 0", { size: 24 }),
      k.pos(20, 20),
      k.z(100),
      k.color(255, 215, 0),
    ]);

    const healthLabel = k.add([
      k.text("Health: 100", { size: 24 }),
      k.pos(20, 50),
      k.z(100),
      k.color(50, 205, 50),
    ]);

    const waveLabel = k.add([
      k.text("Wave: 1", { size: 24 }),
      k.pos(k.width() - 150, 20),
      k.z(100),
      k.color(255, 105, 180),
    ]);

    // Player (using a triangle shape)
    const player = k.add([
      k.polygon([
        k.vec2(0, -20),
        k.vec2(-15, 15),
        k.vec2(15, 15),
      ]),
      k.pos(k.center().x, k.height() - 100),
      k.rotate(0),
      k.anchor("center"),
      k.area(),
      k.color(50, 200, 50), // Green player
      k.z(10),
      "player",
      {
        speed: 300,
        shootCooldown: 0,
      },
    ]);

    // Player hover animation
    player.onUpdate(() => {
      player.pos.y += Math.sin(k.time() * 3) * 0.3;
      if (player.shootCooldown > 0) {
        player.shootCooldown -= k.dt();
      }
    });

    // Player movement
    k.onKeyDown("left", () => {
      if (!isPaused) player.pos.x -= player.speed * k.dt();
    });

    k.onKeyDown("right", () => {
      if (!isPaused) player.pos.x += player.speed * k.dt();
    });

    k.onKeyDown("up", () => {
      if (!isPaused) player.pos.y -= player.speed * k.dt();
    });

    k.onKeyDown("down", () => {
      if (!isPaused) player.pos.y += player.speed * k.dt();
    });

    // Shooting
    function shootBullet() {
      if (isPaused) return;
      k.add([
        k.rect(4, 12),
        k.pos(player.pos),
        k.color(255, 255, 0),
        k.anchor("center"),
        k.area(),
        k.z(5),
        "bullet",
        {
          speed: 500,
        },
      ]);
    }

    k.onKeyPress("space", () => {
      if (player.shootCooldown <= 0 && !isPaused) {
        shootBullet();
        player.shootCooldown = 0.3;
      }
    });

    k.onKeyDown("space", () => {
      if (player.shootCooldown <= 0 && !isPaused) {
        shootBullet();
        player.shootCooldown = 0.3;
      }
    });

    // Bullet movement
    k.onUpdate("bullet", (bullet) => {
      if (!isPaused) {
        bullet.pos.y -= bullet.speed * k.dt();
        if (bullet.pos.y < 0) {
          k.destroy(bullet);
        }
      }
    });

    // Keep player on screen
    player.onUpdate(() => {
      player.pos.x = Math.max(30, Math.min(k.width() - 30, player.pos.x));
      player.pos.y = Math.max(30, Math.min(k.height() - 30, player.pos.y));
    });

    // Spawn enemies
    function spawnEnemy() {
      if (isPaused) return;

      const x = k.rand(50, k.width() - 50);
      const ghosty = k.add([
        k.circle(20),
        k.pos(x, -50),
        k.anchor("center"),
        k.area(),
        k.color(255, 100, 200), // Pink ghosty
        k.outline(2, k.rgb(200, 50, 150)),
        k.scale(1),
        k.rotate(0),
        "enemy",
        {
          speed: k.rand(50, 100 + currentWave * 10),
          wobble: k.rand(20, 40),
          hp: 3,
        },
      ]);

      ghosty.onUpdate(() => {
        if (!isPaused) {
          ghosty.pos.y += ghosty.speed * k.dt();
          ghosty.pos.x += Math.sin(k.time() * ghosty.wobble) * 2;
          ghosty.angle += 50 * k.dt();

          if (ghosty.pos.y > k.height() + 50) {
            k.destroy(ghosty);
          }
        }
      });

      ghosty.onCollide("player", () => {
        k.addKaboom(ghosty.pos);
        k.destroy(ghosty);

        health -= 10;
        setGameHealth(health);
        healthLabel.text = `Health: ${health}`;
        healthLabel.color = health > 50 ? k.rgb(50, 205, 50) : k.rgb(255, 0, 0);
        k.shake(10);

        if (health <= 0) {
          setIsGameOver(true);
        }
      });

      ghosty.onCollide("bullet", (bullet) => {
        k.destroy(bullet);
        ghosty.hp -= 1;

        ghosty.color = k.rgb(255, 100, 100);
        k.wait(0.1, () => {
          if (ghosty.exists()) {
            ghosty.color = k.rgb(255, 255, 255);
          }
        });

        if (ghosty.hp <= 0) {
          k.addKaboom(ghosty.pos);
          k.destroy(ghosty);

          score += 100;
          defeated++;
          console.log('💯 Enemy defeated! New score:', score);
          setGameScore(score);
          setEnemiesDefeated(defeated);
          scoreLabel.text = `Score: ${score}`;

          if (defeated % 10 === 0) {
            currentWave++;
            setWave(currentWave);
            waveLabel.text = `Wave: ${currentWave}`;

            const announcement = k.add([
              k.text(`WAVE ${currentWave}!`, { size: 48 }),
              k.pos(k.center()),
              k.anchor("center"),
              k.opacity(1),
              k.z(200),
              k.color(255, 215, 0),
            ]);

            k.wait(1.5, () => k.destroy(announcement));
          }
        }
      });
    }

    // Spawn enemies continuously
    const spawnLoop = k.loop(1.5, () => {
      if (!isPaused) spawnEnemy();
    });

    const spawnWaveLoop = k.loop(3, () => {
      if (!isPaused && currentWave >= 3) {
        for (let i = 0; i < currentWave - 2; i++) {
          k.wait(i * 0.2, () => {
            if (!isPaused) spawnEnemy();
          });
        }
      }
    });

    // Instructions
    k.add([
      k.text("ARROW KEYS: Move | SPACE: Shoot", { size: 20 }),
      k.pos(k.center().x, k.height() - 30),
      k.anchor("center"),
      k.color(255, 255, 255),
    ]);

    return () => {
      spawnLoop.cancel();
      spawnWaveLoop.cancel();
      k.quit();
    };
  }, [session, isPaused]);

  if (!session) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-2">No Session Found</h2>
            <p className="text-muted-foreground mb-4">Please create a study session first.</p>
            <Button onClick={() => navigate("/")}>Go to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <div className="flex-1 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/")}
              >
                <ArrowLeft size={16} className="mr-2" />
                Exit Game
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Bean vs Ghosty Battle Arena</h1>
                <p className="text-sm text-muted-foreground">Answer questions to keep playing!</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Session</p>
                <p className="font-medium">{session.title}</p>
              </div>
            </div>
          </div>

          {/* Game Canvas */}
          <div className="flex justify-center mb-6">
            <div className="relative border-4 border-primary/20 rounded-lg overflow-hidden shadow-2xl">
              <canvas ref={canvasRef} />

              {/* Pause Overlay for Questions */}
              {currentQuestion && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50">
                  <div className="bg-background p-8 rounded-lg max-w-2xl w-full mx-4 border-2 border-primary">
                    <h3 className="text-xl font-bold text-foreground mb-4">Answer to Continue!</h3>
                    <p className="text-lg mb-6">{currentQuestion.text}</p>

                    <div className="space-y-3">
                      {currentQuestion.options.map((option, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          className="w-full text-left justify-start h-auto py-3 px-4"
                          onClick={() => handleAnswerQuestion(index)}
                        >
                          <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                          {option}
                        </Button>
                      ))}
                    </div>

                    <p className="text-sm text-destructive mt-4 text-center font-medium">
                      ⚠️ Wrong answer = Game Over!
                    </p>
                  </div>
                </div>
              )}

              {/* Game Over Overlay */}
              {isGameOver && (
                <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
                  <div className="bg-background p-8 rounded-lg text-center border-2 border-destructive">
                    <h2 className="text-4xl font-bold text-destructive mb-4">GAME OVER!</h2>
                    <p className="text-2xl mb-2">Final Score: <span className="text-primary font-bold">{gameScore}</span></p>
                    <p className="text-xl mb-6">Waves Survived: <span className="font-bold">{wave}</span></p>
                    <div className="flex gap-3">
                      <Button onClick={() => window.location.reload()}>
                        <Play size={16} className="mr-2" />
                        Play Again
                      </Button>
                      <Button variant="outline" onClick={() => navigate("/")}>
                        <ArrowLeft size={16} className="mr-2" />
                        Dashboard
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Score</p>
              <p className="text-2xl font-bold text-primary">{gameScore}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Health</p>
              <p className={`text-2xl font-bold ${gameHealth > 50 ? 'text-green-500' : 'text-red-500'}`}>
                {gameHealth}%
              </p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Wave</p>
              <p className="text-2xl font-bold text-purple-500">{wave}</p>
            </div>
            <div className="bg-card border border-border rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Questions</p>
              <p className="text-2xl font-bold text-orange-500">{askedQuestions.size}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
