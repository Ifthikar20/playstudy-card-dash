import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import kaboom from "kaboom";
import type { KaboomCtx } from "kaboom";

export default function PlatformerGamePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<KaboomCtx | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Kaboom
    const k = kaboom({
      canvas: canvasRef.current,
      width: 800,
      height: 480,
      background: [135, 206, 250],
      global: false,
    });

    gameRef.current = k;

    // Game constants
    const SPEED = 320;
    const JUMP_FORCE = 580;

    // Set gravity
    k.setGravity(1400);

    // Level design
    const LEVELS = [
      [
        "                                        ",
        "                                        ",
        "       $$$                  $$$         ",
        "      =====                =====       >",
        "                                       =",
        "   $                   $         $     =",
        "  ===   ^        ===   ===   ^   ===   =",
        "              ^                        =",
        "                                       =",
        "========  =====  ========  ============",
      ],
      [
        "                                        ",
        "    $$$                     $$$        >",
        "   =====                   =====      ==",
        "                  $$$                  =",
        "     ^           =====     ^     ^     =",
        "   =====                         ===   =",
        "              ^        ===             =",
        "                                       =",
        "======  ======  =======  ==============",
      ],
    ];

    let currentLevel = 0;
    let score = 0;

    // Main game scene
    k.scene("game", () => {
      // Add clouds
      for (let i = 0; i < 8; i++) {
        k.add([
          k.text("☁️", { size: k.rand(40, 80) }),
          k.pos(k.rand(0, 1500), k.rand(20, 150)),
          k.opacity(k.rand(0.5, 0.8)),
          k.z(-100),
          "cloud",
          { speed: k.rand(10, 30) },
        ]);
      }

      // Sun
      k.add([
        k.text("☀️", { size: 70 }),
        k.pos(700, 50),
        k.z(-99),
      ]);

      // Flying objects (chairs, birds, lamps)
      for (let i = 0; i < 6; i++) {
        k.add([
          k.text(k.choose(["🪑", "🐦", "🪔", "🎈", "🦅"]), { size: k.rand(24, 36) }),
          k.pos(k.rand(100, 1200), k.rand(30, 180)),
          k.anchor("center"),
          k.z(-5),
          "flyingObject",
          {
            startY: k.rand(30, 180),
            amplitude: k.rand(20, 50),
            speed: k.rand(1, 3),
          },
        ]);
      }

      // Flowers and trees at bottom decoration
      for (let i = 0; i < 15; i++) {
        k.add([
          k.text(k.choose(["🌸", "🌺", "🌻", "🌷", "🌳", "🌲"]), { size: k.rand(20, 40) }),
          k.pos(k.rand(0, 1400), k.rand(260, 290)),
          k.anchor("center"),
          k.z(-3),
        ]);
      }

      // Create player (using emoji)
      const player = k.add([
        k.text("🫘", { size: 32 }),
        k.pos(32, 200),
        k.area(),
        k.body(),
        k.anchor("center"),
        k.scale(1.2),
        "player",
      ]);

      // Create level from map
      k.addLevel(LEVELS[currentLevel], {
        tileWidth: 32,
        tileHeight: 32,
        tiles: {
          "=": () => [
            k.rect(32, 32),
            k.color(124, 252, 0), // Lawn green
            k.area(),
            k.body({ isStatic: true }),
            k.anchor("center"),
            k.outline(2, k.rgb(34, 139, 34)),
          ],
          "$": () => [
            k.text("🪙", { size: 24 }),
            k.area(),
            k.anchor("center"),
            "coin",
          ],
          "^": () => [
            k.text("👻", { size: 28 }),
            k.area(),
            k.body(),
            k.anchor("center"),
            "enemy",
            { dir: 1, speed: k.rand(40, 80) },
          ],
          ">": () => [
            k.text("🌀", { size: 48 }),
            k.area(),
            k.anchor("center"),
            k.scale(1.5),
            "portal",
          ],
        },
      });

      // Store initial positions
      const flyingObjects = k.get("flyingObject");
      flyingObjects.forEach((obj: any) => {
        obj.startY = obj.pos.y;
      });

      // Animate clouds
      k.onUpdate("cloud", (cloud: any) => {
        cloud.pos.x -= cloud.speed * k.dt();
        if (cloud.pos.x < -100) {
          cloud.pos.x = 1600;
        }
      });

      // Animate flying objects
      k.onUpdate("flyingObject", (obj: any) => {
        obj.pos.y = obj.startY + Math.sin(k.time() * obj.speed) * obj.amplitude;
      });

      // Spawn butterflies
      k.loop(1, () => {
        if (k.rand() > 0.5) {
          k.add([
            k.text(k.choose(["🦋", "🐝"]), { size: 18 }),
            k.pos(player.pos.x + k.rand(-200, 200), k.rand(100, 250)),
            k.z(-10),
            "particle",
            { life: 3, vx: k.rand(-30, 30), vy: k.rand(-20, 20) },
          ]);
        }
      });

      k.onUpdate("particle", (p: any) => {
        p.pos.x += p.vx * k.dt();
        p.pos.y += p.vy * k.dt();
        p.life -= k.dt();
        if (p.life <= 0) k.destroy(p);
      });

      // Camera follow
      player.onUpdate(() => {
        k.camPos(player.pos.x + 100, k.height() / 2);
      });

      // Player movement
      k.onKeyDown("left", () => {
        player.move(-SPEED, 0);
      });

      k.onKeyDown("right", () => {
        player.move(SPEED, 0);
      });

      k.onKeyDown("a", () => {
        player.move(-SPEED, 0);
      });

      k.onKeyDown("d", () => {
        player.move(SPEED, 0);
      });

      // Jump
      k.onKeyPress("space", () => {
        if (player.isGrounded()) {
          player.jump(JUMP_FORCE);
        }
      });

      k.onKeyPress("up", () => {
        if (player.isGrounded()) {
          player.jump(JUMP_FORCE);
        }
      });

      k.onKeyPress("w", () => {
        if (player.isGrounded()) {
          player.jump(JUMP_FORCE);
        }
      });

      // Collect coins
      player.onCollide("coin", (coin: any) => {
        k.destroy(coin);
        score += 100;
        // Sparkle effect
        for (let i = 0; i < 5; i++) {
          k.add([
            k.text("✨", { size: 16 }),
            k.pos(coin.pos.x + k.rand(-20, 20), coin.pos.y + k.rand(-20, 20)),
            k.lifespan(0.5),
            k.move(k.UP, k.rand(50, 100)),
          ]);
        }
      });

      // Enemy AI
      k.onUpdate("enemy", (enemy: any) => {
        enemy.move(enemy.dir * enemy.speed, 0);
        if (k.rand() < 0.005) enemy.dir *= -1;
      });

      // Enemy collision
      player.onCollide("enemy", (enemy: any) => {
        if (player.pos.y < enemy.pos.y - 10) {
          k.add([
            k.text("💥", { size: 40 }),
            k.pos(enemy.pos),
            k.lifespan(0.3),
          ]);
          k.destroy(enemy);
          player.jump(JUMP_FORCE / 2);
          score += 200;
        } else {
          k.go("lose");
        }
      });

      // Reach portal
      player.onCollide("portal", () => {
        currentLevel++;
        if (currentLevel >= LEVELS.length) {
          k.go("win");
        } else {
          k.go("game");
        }
      });

      // Fall off screen
      player.onUpdate(() => {
        if (player.pos.y > k.height() + 100) {
          k.go("lose");
        }
      });

      // UI
      k.onDraw(() => {
        k.drawText({
          text: "🪙 " + score,
          pos: k.vec2(k.camPos().x - k.width() / 2 + 20, 20),
          size: 28,
        });
        k.drawText({
          text: "Level " + (currentLevel + 1),
          pos: k.vec2(k.camPos().x + k.width() / 2 - 120, 20),
          size: 24,
        });
      });
    });

    // Lose scene
    k.scene("lose", () => {
      k.add([
        k.text("Game Over!", { size: 48 }),
        k.pos(k.width() / 2, k.height() / 2 - 30),
        k.anchor("center"),
        k.color(255, 100, 100),
      ]);

      k.add([
        k.text("Score: " + score, { size: 32 }),
        k.pos(k.width() / 2, k.height() / 2 + 30),
        k.anchor("center"),
      ]);

      k.add([
        k.text("Press SPACE to retry", { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 80),
        k.anchor("center"),
      ]);

      k.onKeyPress("space", () => {
        currentLevel = 0;
        score = 0;
        k.go("game");
      });
    });

    // Win scene
    k.scene("win", () => {
      k.add([
        k.text("You Win!", { size: 56 }),
        k.pos(k.width() / 2, k.height() / 2 - 30),
        k.anchor("center"),
        k.color(255, 215, 0),
      ]);

      k.add([
        k.text("Final Score: " + score, { size: 32 }),
        k.pos(k.width() / 2, k.height() / 2 + 30),
        k.anchor("center"),
      ]);

      k.add([
        k.text("Press SPACE to play again", { size: 24 }),
        k.pos(k.width() / 2, k.height() / 2 + 80),
        k.anchor("center"),
      ]);

      k.onKeyPress("space", () => {
        currentLevel = 0;
        score = 0;
        k.go("game");
      });
    });

    // Start game
    k.go("game");

    return () => {
      k.quit();
    };
  }, []);

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
                onClick={() => navigate("/dashboard/browse-games")}
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Games
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Bean Platformer Adventure</h1>
                <p className="text-sm text-muted-foreground">Classic platformer with coins and enemies!</p>
              </div>
            </div>
          </div>

          {/* Game Canvas */}
          <div className="flex justify-center mb-6">
            <div className="border-4 border-primary/20 rounded-lg overflow-hidden shadow-2xl">
              <canvas ref={canvasRef} />
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-card border border-border rounded-lg p-6 max-w-2xl mx-auto">
            <h2 className="text-lg font-bold mb-3">How to Play</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium mb-1">🎮 Controls:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>← → or A/D: Move</li>
                  <li>↑ or W or SPACE: Jump</li>
                </ul>
              </div>
              <div>
                <p className="font-medium mb-1">🎯 Objectives:</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>🪙 Collect coins (+100 pts)</li>
                  <li>👻 Jump on enemies (+200 pts)</li>
                  <li>🌀 Reach the portal to win!</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
