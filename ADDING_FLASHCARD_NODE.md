# Adding Flashcard Node to Existing React Flow Workflow

**Quick implementation guide for adding flashcard review nodes to your existing React Flow skill tree.**

---

## Overview

You already have React Flow set up. This guide shows how to:
1. Add a new **FlashcardNode** component
2. Show it after quiz completion
3. Handle flip card interactions
4. Mark as complete to unlock next topics

---

## 1. Add Flashcard Node Component

Create `src/components/workflow/FlashcardNode.tsx`:

```typescript
import React, { useState } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, CheckCircle } from 'lucide-react';

interface FlashcardNodeData {
  topicId: number;
  topicTitle: string;
  flashcardCount: number;
  completed: boolean;
  onStartReview: (topicId: number) => void;
}

export const FlashcardNode: React.FC<NodeProps<FlashcardNodeData>> = ({ data }) => {
  const { topicId, topicTitle, flashcardCount, completed, onStartReview } = data;

  return (
    <>
      <Handle type="target" position={Position.Left} />

      <Card className={`p-4 min-w-[200px] ${
        completed
          ? 'bg-purple-100 border-purple-500'
          : 'bg-blue-100 border-blue-500'
      }`}>
        <div className="flex flex-col items-center gap-3">
          {completed ? (
            <CheckCircle className="w-6 h-6 text-purple-600" />
          ) : (
            <BookOpen className="w-6 h-6 text-blue-600" />
          )}

          <div className="text-center">
            <h4 className="font-semibold text-sm mb-1">Flashcard Review</h4>
            <p className="text-xs text-gray-600 mb-1">{topicTitle}</p>
            <span className="text-xs text-gray-500">{flashcardCount} cards</span>
          </div>

          <Button
            size="sm"
            onClick={() => onStartReview(topicId)}
            variant={completed ? 'outline' : 'default'}
            className="w-full"
          >
            {completed ? 'Review Again' : 'Start Review'}
          </Button>
        </div>
      </Card>

      <Handle type="source" position={Position.Right} />
    </>
  );
};
```

---

## 2. Register the Node Type

Update your existing React Flow setup to include the new node type:

```typescript
// In your WorkflowCanvas component or wherever you initialize React Flow

import { FlashcardNode } from './FlashcardNode';

// Add to your nodeTypes
const nodeTypes = useMemo(
  () => ({
    // Your existing node types
    quizNode: QuizNode,
    topicNode: TopicNode,

    // NEW: Flashcard node
    flashcardNode: FlashcardNode,
  }),
  []
);

// Use in ReactFlow
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  // ... other props
/>
```

---

## 3. Create Flashcard Nodes After Quiz Completion

Update your node generation logic:

```typescript
const generateNodes = (topics: Topic[]) => {
  const nodes = [];

  topics.forEach((topic) => {
    // 1. Regular quiz/topic node
    nodes.push({
      id: `topic-${topic.id}`,
      type: 'quizNode',
      position: { x: topic.position_x, y: topic.position_y },
      data: {
        ...topic,
        onQuizComplete: handleQuizComplete,
      },
    });

    // 2. Add flashcard node if quiz is completed
    if (topic.quiz_completed) {
      nodes.push({
        id: `flashcard-${topic.id}`,
        type: 'flashcardNode',
        position: {
          x: topic.position_x + 250,  // Position to the right
          y: topic.position_y
        },
        data: {
          topicId: topic.id,
          topicTitle: topic.title,
          flashcardCount: topic.flashcard_count,
          completed: topic.flashcards_completed,
          onStartReview: handleStartFlashcardReview,
        },
      });
    }
  });

  return nodes;
};
```

---

## 4. Add Edge Connection

Connect quiz node to flashcard node:

```typescript
const generateEdges = (topics: Topic[]) => {
  const edges = [];

  topics.forEach((topic) => {
    // Connect quiz to flashcard review
    if (topic.quiz_completed) {
      edges.push({
        id: `edge-quiz-flashcard-${topic.id}`,
        source: `topic-${topic.id}`,
        target: `flashcard-${topic.id}`,
        type: 'smoothstep',
        animated: !topic.flashcards_completed,
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2,
          strokeDasharray: '5,5',
        },
      });
    }

    // Connect flashcard to next topic (if flashcards completed)
    if (topic.flashcards_completed && topic.next_topic_ids) {
      topic.next_topic_ids.forEach((nextId) => {
        edges.push({
          id: `edge-flashcard-next-${topic.id}-${nextId}`,
          source: `flashcard-${topic.id}`,
          target: `topic-${nextId}`,
          type: 'smoothstep',
          animated: true,
          style: {
            stroke: '#22c55e',
            strokeWidth: 2,
          },
        });
      });
    }
  });

  return edges;
};
```

---

## 5. Flashcard Review Modal/Page

Create the flip card interface:

```typescript
// src/components/flashcards/FlashcardReviewModal.tsx

import React, { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface Flashcard {
  id: number;
  front: string;
  back: string;
  hint?: string;
}

interface FlashcardReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  flashcards: Flashcard[];
  onComplete: () => void;
}

export const FlashcardReviewModal: React.FC<FlashcardReviewModalProps> = ({
  isOpen,
  onClose,
  flashcards,
  onComplete,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentCard = flashcards[currentIndex];
  const progress = ((currentIndex + 1) / flashcards.length) * 100;

  const handleFlip = () => setIsFlipped(!isFlipped);

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setIsFlipped(false);
    } else {
      // All cards reviewed - mark as complete
      onComplete();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        {/* Progress */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span>Card {currentIndex + 1} of {flashcards.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} />
        </div>

        {/* Flashcard */}
        <div
          className={`min-h-[300px] p-8 border-2 rounded-lg cursor-pointer transition-all ${
            isFlipped ? 'bg-blue-50 border-blue-500' : 'bg-white border-gray-300'
          }`}
          onClick={handleFlip}
        >
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-sm text-gray-500 mb-2">
              {isFlipped ? 'Answer' : 'Question'}
            </div>
            <h2 className="text-2xl font-semibold">
              {isFlipped ? currentCard.back : currentCard.front}
            </h2>
            {isFlipped && currentCard.hint && (
              <p className="mt-4 text-sm text-gray-600 italic">
                💡 {currentCard.hint}
              </p>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex justify-between items-center mt-4">
          <Button variant="ghost" onClick={onClose}>
            Exit
          </Button>

          <div className="flex gap-2">
            {!isFlipped ? (
              <Button onClick={handleFlip}>
                Show Answer
              </Button>
            ) : (
              <Button onClick={handleNext}>
                {currentIndex < flashcards.length - 1 ? 'Next Card' : 'Complete Review'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

---

## 6. Wire It All Together

In your main workflow component:

```typescript
import { useState } from 'react';
import { FlashcardReviewModal } from '@/components/flashcards/FlashcardReviewModal';

export const WorkflowPage = () => {
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [flashcards, setFlashcards] = useState([]);

  const handleStartFlashcardReview = async (topicId: number) => {
    // Fetch flashcards for this topic
    const response = await fetch(`/api/v1/study-sessions/topics/${topicId}/flashcards`);
    const data = await response.json();

    setFlashcards(data.flashcards);
    setSelectedTopicId(topicId);
    setReviewModalOpen(true);
  };

  const handleReviewComplete = async () => {
    // Mark flashcards as completed
    await fetch(`/api/v1/study-sessions/topics/${selectedTopicId}/flashcards/complete`, {
      method: 'POST',
    });

    // Refresh workflow to unlock next topics
    refreshWorkflow();
  };

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        // ... other props
      />

      <FlashcardReviewModal
        isOpen={reviewModalOpen}
        onClose={() => setReviewModalOpen(false)}
        flashcards={flashcards}
        onComplete={handleReviewComplete}
      />
    </>
  );
};
```

---

## 7. Backend Endpoint for Completion

Add endpoint to mark flashcards as completed:

```python
# backend/app/api/v1/endpoints/flashcards.py

@router.post("/topics/{topic_id}/flashcards/complete")
async def mark_flashcards_complete(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Mark all flashcards for a topic as completed"""

    # Update topic status
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    topic.flashcards_completed = True
    topic.workflow_stage = "completed"

    # Unlock next topics (based on prerequisites)
    unlock_next_topics(db, topic_id)

    db.commit()

    return {"success": True, "topic_id": topic_id}
```

---

## 8. Visual Flow Summary

```
┌─────────────────┐         ┌──────────────────────┐         ┌─────────────────┐
│  Topic A Quiz   │────────►│  Flashcard Review    │────────►│  Topic B Quiz   │
│  15 questions   │ Complete│  5 flip cards        │ Complete│  (Now Unlocked) │
│  ✓ Completed    │         │  Click to start      │         │                 │
└─────────────────┘         └──────────────────────┘         └─────────────────┘
                                      │
                                      │ User clicks
                                      ▼
                            ┌──────────────────────┐
                            │  Flashcard Modal     │
                            │  - Flip cards        │
                            │  - Progress bar      │
                            │  - Next/Complete     │
                            └──────────────────────┘
```

---

## Quick Implementation Checklist

- [ ] Add FlashcardNode component to existing React Flow
- [ ] Register `flashcardNode` in nodeTypes
- [ ] Update node generation to create flashcard nodes after quiz completion
- [ ] Add edges connecting quiz → flashcard → next topic
- [ ] Create FlashcardReviewModal with flip card UI
- [ ] Add handleStartFlashcardReview function
- [ ] Add handleReviewComplete to mark as done and unlock next topics
- [ ] Backend: Add completion endpoint
- [ ] Test: Complete quiz → See flashcard node → Review cards → Next topic unlocks

---

## Key Points

1. **No new libraries needed** - You already have React Flow
2. **Just add a new node type** - FlashcardNode component
3. **Simple flip card modal** - Click to flip, click to advance
4. **Completion unlocks next topics** - Standard workflow progression
5. **Estimated time**: 2-3 hours to implement

---

**This integrates seamlessly with your existing React Flow skill tree!** 🎯
