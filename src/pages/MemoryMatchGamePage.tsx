import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import kaboom from "kaboom";
import type { KaboomCtx } from "kaboom";

export default function MemoryMatchGamePage() {
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<KaboomCtx | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Kaboom
    const k = kaboom({
      canvas: canvasRef.current,
      width: 1200,
      height: 800,
      background: [20, 20, 40],
      global: false,
    });

    gameRef.current = k;

    // Game data - words and definitions to match
    const matchPairs = [
      { word: "Algorithm", definition: "Step-by-step procedure for solving a problem" },
      { word: "Iterate", definition: "To repeat a process multiple times" },
      { word: "Variable", definition: "A container that stores data values" },
      { word: "Function", definition: "A reusable block of code" },
      { word: "Debug", definition: "To find and fix errors in code" },
      { word: "Array", definition: "An ordered collection of items" },
    ];

    // Game state
    const cards: any[] = [];
    let flippedCards: any[] = [];
    let matchedPairs = 0;
    let canFlip = true;
    let moves = 0;

    // Create shuffled card data
    function createCardData() {
      const cardData: any[] = [];

      // Add word cards and definition cards
      matchPairs.forEach((pair, index) => {
        cardData.push({
          id: index,
          text: pair.word,
          type: 'word',
          isFlipped: false,
          isMatched: false
        });
        cardData.push({
          id: index,
          text: pair.definition,
          type: 'definition',
          isFlipped: false,
          isMatched: false
        });
      });

      // Shuffle cards
      return cardData.sort(() => Math.random() - 0.5);
    }

    const cardData = createCardData();

    k.scene("game", () => {
      // UI Elements
      const titleText = k.add([
        k.text("Memory Match: Words & Definitions", { size: 32 }),
        k.pos(k.width() / 2, 40),
        k.anchor("center"),
        k.color(255, 255, 255),
      ]);

      const movesText = k.add([
        k.text("Moves: 0", { size: 24 }),
        k.pos(50, 100),
        k.color(200, 200, 200),
      ]);

      const matchesText = k.add([
        k.text(`Matches: 0/${matchPairs.length}`, { size: 24 }),
        k.pos(k.width() - 50, 100),
        k.anchor("topright"),
        k.color(200, 200, 200),
      ]);

      const instructionText = k.add([
        k.text("Click cards to flip and match words with definitions!", { size: 18 }),
        k.pos(k.width() / 2, 740),
        k.anchor("center"),
        k.color(150, 150, 150),
      ]);

      // Create cards in a grid
      const columns = 4;
      const rows = 3;
      const cardWidth = 240;
      const cardHeight = 140;
      const padding = 20;
      const startX = (k.width() - (columns * (cardWidth + padding) - padding)) / 2;
      const startY = 180;

      cardData.forEach((data, index) => {
        const col = index % columns;
        const row = Math.floor(index / columns);
        const x = startX + col * (cardWidth + padding);
        const y = startY + row * (cardHeight + padding);

        // Card background
        const card = k.add([
          k.rect(cardWidth, cardHeight, { radius: 8 }),
          k.pos(x, y),
          k.color(60, 60, 100),
          k.area(),
          k.anchor("topleft"),
          "card",
          {
            cardData: data,
            cardText: null as any,
            backText: null as any,
          }
        ]);

        // Card back text (shows when not flipped)
        const backText = k.add([
          k.text("?", { size: 64 }),
          k.pos(x + cardWidth / 2, y + cardHeight / 2),
          k.anchor("center"),
          k.color(150, 150, 200),
          k.z(1),
        ]);

        // Card front text (shows word or definition)
        const cardText = k.add([
          k.text(data.text, {
            size: data.type === 'word' ? 24 : 16,
            width: cardWidth - 20,
          }),
          k.pos(x + cardWidth / 2, y + cardHeight / 2),
          k.anchor("center"),
          k.color(255, 255, 255),
          k.opacity(0),
          k.z(1),
        ]);

        card.cardText = cardText;
        card.backText = backText;

        // Hover effect
        card.onHover(() => {
          if (!data.isMatched && canFlip) {
            card.color = k.rgb(80, 80, 120);
          }
        });

        card.onHoverEnd(() => {
          if (!data.isMatched) {
            card.color = data.isFlipped ? k.rgb(100, 150, 200) : k.rgb(60, 60, 100);
          }
        });

        // Click to flip
        card.onClick(() => {
          if (!canFlip || data.isFlipped || data.isMatched) return;

          flipCard(card);
        });

        cards.push(card);
      });

      function flipCard(card: any) {
        const data = card.cardData;

        if (flippedCards.length >= 2) return;

        // Flip animation
        data.isFlipped = true;
        card.color = k.rgb(100, 150, 200);
        card.backText.opacity = 0;
        card.cardText.opacity = 1;

        flippedCards.push(card);

        // Check for match when 2 cards are flipped
        if (flippedCards.length === 2) {
          moves++;
          movesText.text = `Moves: ${moves}`;
          canFlip = false;

          k.wait(1, () => {
            checkMatch();
          });
        }
      }

      function checkMatch() {
        const [card1, card2] = flippedCards;
        const data1 = card1.cardData;
        const data2 = card2.cardData;

        // Check if IDs match (same pair) but different types (word vs definition)
        if (data1.id === data2.id && data1.type !== data2.type) {
          // Match found!
          data1.isMatched = true;
          data2.isMatched = true;
          card1.color = k.rgb(80, 200, 120);
          card2.color = k.rgb(80, 200, 120);

          matchedPairs++;
          matchesText.text = `Matches: ${matchedPairs}/${matchPairs.length}`;

          // Check win condition
          if (matchedPairs === matchPairs.length) {
            k.wait(0.5, () => {
              showWinScreen();
            });
          }
        } else {
          // No match - flip back
          k.wait(0.8, () => {
            flipBack(card1);
            flipBack(card2);
          });
        }

        flippedCards = [];
        canFlip = true;
      }

      function flipBack(card: any) {
        const data = card.cardData;
        data.isFlipped = false;
        card.color = k.rgb(60, 60, 100);
        card.backText.opacity = 1;
        card.cardText.opacity = 0;
      }

      function showWinScreen() {
        // Dim background
        k.add([
          k.rect(k.width(), k.height()),
          k.pos(0, 0),
          k.color(0, 0, 0),
          k.opacity(0.7),
          k.z(10),
        ]);

        // Win message
        k.add([
          k.text(`🎉 You Win! 🎉\n\nCompleted in ${moves} moves`, {
            size: 48,
          }),
          k.pos(k.width() / 2, k.height() / 2 - 50),
          k.anchor("center"),
          k.color(255, 255, 100),
          k.z(11),
        ]);

        // Restart button
        const restartBtn = k.add([
          k.rect(200, 60, { radius: 8 }),
          k.pos(k.width() / 2, k.height() / 2 + 80),
          k.anchor("center"),
          k.color(100, 200, 100),
          k.area(),
          k.z(11),
          "restart",
        ]);

        k.add([
          k.text("Play Again", { size: 24 }),
          k.pos(k.width() / 2, k.height() / 2 + 80),
          k.anchor("center"),
          k.color(255, 255, 255),
          k.z(12),
        ]);

        restartBtn.onClick(() => {
          k.go("game");
        });

        restartBtn.onHover(() => {
          restartBtn.color = k.rgb(120, 220, 120);
        });

        restartBtn.onHoverEnd(() => {
          restartBtn.color = k.rgb(100, 200, 100);
        });
      }

      // Instructions box
      k.add([
        k.rect(600, 80, { radius: 8 }),
        k.pos(k.width() / 2, 750),
        k.anchor("center"),
        k.color(40, 40, 60),
        k.opacity(0.8),
      ]);

      k.add([
        k.text("💡 Tip: Match each word with its correct definition", {
          size: 16,
        }),
        k.pos(k.width() / 2, 750),
        k.anchor("center"),
        k.color(200, 200, 255),
      ]);
    });

    // Start the game
    k.go("game");

    // Cleanup on unmount
    return () => {
      if (gameRef.current) {
        gameRef.current.quit();
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard/browse-games")}
            className="gap-2"
          >
            <ArrowLeft size={16} />
            Back to Games
          </Button>
        </div>

        {/* Game Canvas */}
        <div className="flex-1 flex items-center justify-center p-4 bg-muted/20">
          <div className="relative">
            <canvas
              ref={canvasRef}
              className="rounded-lg shadow-2xl border-2 border-border"
            />
          </div>
        </div>
      </main>
    </div>
  );
}
