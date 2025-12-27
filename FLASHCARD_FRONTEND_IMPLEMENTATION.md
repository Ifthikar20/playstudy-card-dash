# Flashcard System - Frontend Implementation Guide

Complete implementation guide for the flashcard and workflow visualization frontend.

---

## 📋 Table of Contents

1. [Component Architecture](#component-architecture)
2. [Workflow Visualization](#workflow-visualization)
3. [Flashcard Review UI](#flashcard-review-ui)
4. [State Management](#state-management)
5. [API Integration](#api-integration)
6. [Styling Guide](#styling-guide)

---

## 1. Component Architecture

### Project Structure

```
src/
├── components/
│   ├── workflow/
│   │   ├── WorkflowCanvas.tsx         # Main skill-tree visualization
│   │   ├── WorkflowNode.tsx           # Individual topic node
│   │   ├── FlashcardNode.tsx          # Flashcard review node
│   │   └── NodeConnector.tsx          # Prerequisite connections
│   ├── flashcards/
│   │   ├── FlashcardReview.tsx        # Flashcard review container
│   │   ├── FlashcardCard.tsx          # Individual flashcard
│   │   ├── FlashcardRating.tsx        # Quality rating buttons
│   │   └── ReviewProgress.tsx         # Progress indicator
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       └── badge.tsx
├── hooks/
│   ├── useWorkflow.ts                 # Workflow data fetching
│   ├── useFlashcards.ts               # Flashcard management
│   └── useSpacedRepetition.ts         # Review logic
├── types/
│   ├── workflow.ts                    # Workflow types
│   └── flashcard.ts                   # Flashcard types
└── lib/
    └── api.ts                         # API client
```

---

## 2. Workflow Visualization

### Install Dependencies

```bash
npm install @xyflow/react
# or
npm install reactflow  # Alternative
# or
npm install d3         # Alternative for custom implementation
```

### Types Definition

Create `src/types/workflow.ts`:

```typescript
export type WorkflowStage =
  | 'locked'
  | 'quiz_available'
  | 'quiz_completed'
  | 'flashcard_review'
  | 'completed';

export interface WorkflowNode {
  topic_id: number;
  title: string;
  description: string;
  is_category: boolean;
  parent_topic_id: number | null;
  order_index: number;
  workflow_stage: WorkflowStage;
  position_x: number;
  position_y: number;
  prerequisite_topic_ids: number[];
  question_count: number;
  flashcard_count: number;
  completed: boolean;
  score: number | null;
  current_question_index: number;
}

export interface WorkflowData {
  session_id: string;
  title: string;
  progress: number;
  workflow_nodes: WorkflowNode[];
  total_nodes: number;
}
```

### Workflow Canvas Component

Create `src/components/workflow/WorkflowCanvas.tsx`:

```typescript
import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowNode as WorkflowNodeComponent } from './WorkflowNode';
import { FlashcardNode } from './FlashcardNode';
import { WorkflowNode as WorkflowNodeType } from '@/types/workflow';

interface WorkflowCanvasProps {
  workflowNodes: WorkflowNodeType[];
  onNodeClick: (node: WorkflowNodeType) => void;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({
  workflowNodes,
  onNodeClick,
}) => {
  // Convert workflow nodes to React Flow nodes
  const nodes = useMemo(() => {
    const flowNodes: Node[] = [];

    workflowNodes.forEach((node) => {
      // Main topic/quiz node
      flowNodes.push({
        id: `topic-${node.topic_id}`,
        type: 'workflowNode',
        position: { x: node.position_x, y: node.position_y },
        data: {
          node,
          onClick: () => onNodeClick(node),
        },
      });

      // Separate flashcard review node (if quiz completed)
      if (node.workflow_stage === 'quiz_completed' || node.workflow_stage === 'flashcard_review') {
        flowNodes.push({
          id: `flashcard-${node.topic_id}`,
          type: 'flashcardNode',
          position: { x: node.position_x + 200, y: node.position_y },
          data: {
            node,
            onClick: () => onNodeClick(node),
          },
        });
      }
    });

    return flowNodes;
  }, [workflowNodes, onNodeClick]);

  // Create edges (connections) based on prerequisites
  const edges = useMemo(() => {
    const flowEdges: Edge[] = [];

    workflowNodes.forEach((node) => {
      // Connect prerequisites to this node
      node.prerequisite_topic_ids.forEach((prereqId) => {
        flowEdges.push({
          id: `edge-${prereqId}-${node.topic_id}`,
          source: `topic-${prereqId}`,
          target: `topic-${node.topic_id}`,
          type: 'smoothstep',
          animated: node.workflow_stage === 'locked',
          style: {
            stroke: node.workflow_stage === 'locked' ? '#999' : '#22c55e',
            strokeWidth: 2,
          },
        });
      });

      // Connect quiz node to flashcard node
      if (node.workflow_stage === 'quiz_completed' || node.workflow_stage === 'flashcard_review') {
        flowEdges.push({
          id: `edge-quiz-flashcard-${node.topic_id}`,
          source: `topic-${node.topic_id}`,
          target: `flashcard-${node.topic_id}`,
          type: 'straight',
          animated: true,
          style: {
            stroke: '#3b82f6',
            strokeWidth: 2,
            strokeDasharray: '5,5',
          },
        });
      }
    });

    return flowEdges;
  }, [workflowNodes]);

  // Custom node types
  const nodeTypes = useMemo(
    () => ({
      workflowNode: WorkflowNodeComponent,
      flashcardNode: FlashcardNode,
    }),
    []
  );

  return (
    <div className="w-full h-screen">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
};
```

### Workflow Node Component

Create `src/components/workflow/WorkflowNode.tsx`:

```typescript
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lock, CheckCircle, PlayCircle } from 'lucide-react';
import { WorkflowNode as WorkflowNodeType } from '@/types/workflow';

interface WorkflowNodeProps {
  data: {
    node: WorkflowNodeType;
    onClick: () => void;
  };
}

export const WorkflowNode: React.FC<WorkflowNodeProps> = ({ data }) => {
  const { node, onClick } = data;

  // Stage-based styling
  const getStageColor = () => {
    switch (node.workflow_stage) {
      case 'locked':
        return 'bg-gray-200 border-gray-400';
      case 'quiz_available':
        return 'bg-green-100 border-green-500';
      case 'quiz_completed':
        return 'bg-blue-100 border-blue-500';
      case 'completed':
        return 'bg-purple-100 border-purple-500';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const getStageIcon = () => {
    switch (node.workflow_stage) {
      case 'locked':
        return <Lock className="w-4 h-4 text-gray-600" />;
      case 'quiz_available':
        return <PlayCircle className="w-4 h-4 text-green-600" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-purple-600" />;
      default:
        return null;
    }
  };

  return (
    <>
      <Handle type="target" position={Position.Left} />

      <Card
        className={`p-4 min-w-[200px] cursor-pointer transition-all hover:shadow-lg ${getStageColor()}`}
        onClick={onClick}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm">{node.title}</h3>
          {getStageIcon()}
        </div>

        <p className="text-xs text-gray-600 mb-2 line-clamp-2">
          {node.description}
        </p>

        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">
            {node.question_count} questions
          </span>

          {node.score !== null && (
            <Badge variant="secondary" className="text-xs">
              {node.score}%
            </Badge>
          )}
        </div>

        {node.workflow_stage === 'locked' && node.prerequisite_topic_ids.length > 0 && (
          <div className="mt-2 text-xs text-gray-500 flex items-center gap-1">
            <Lock className="w-3 h-3" />
            Complete prerequisites first
          </div>
        )}
      </Card>

      <Handle type="source" position={Position.Right} />
    </>
  );
};
```

### Flashcard Review Node

Create `src/components/workflow/FlashcardNode.tsx`:

```typescript
import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen } from 'lucide-react';
import { WorkflowNode } from '@/types/workflow';

interface FlashcardNodeProps {
  data: {
    node: WorkflowNode;
    onClick: () => void;
  };
}

export const FlashcardNode: React.FC<FlashcardNodeProps> = ({ data }) => {
  const { node, onClick } = data;

  return (
    <>
      <Handle type="target" position={Position.Left} />

      <Card className="p-4 min-w-[180px] bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-400">
        <div className="flex flex-col items-center text-center">
          <BookOpen className="w-6 h-6 text-blue-600 mb-2" />

          <h4 className="font-semibold text-sm mb-1">Review Flashcards</h4>

          <span className="text-xs text-gray-600 mb-3">
            {node.flashcard_count} cards
          </span>

          <Button
            size="sm"
            onClick={onClick}
            className="w-full"
            variant={node.workflow_stage === 'completed' ? 'outline' : 'default'}
          >
            {node.workflow_stage === 'completed' ? 'Review Again' : 'Start Review'}
          </Button>
        </div>
      </Card>

      <Handle type="source" position={Position.Right} />
    </>
  );
};
```

---

## 3. Flashcard Review UI

### Flashcard Types

Create `src/types/flashcard.ts`:

```typescript
export interface Flashcard {
  id: number;
  front: string;
  back: string;
  hint: string | null;
  order_index: number;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  next_review_date: string | null;
  last_reviewed_at: string | null;
  total_reviews: number;
  correct_reviews: number;
  accuracy: number;
  is_due: boolean;
}

export interface FlashcardReviewData {
  topic_id: number;
  topic_title: string;
  flashcards: Flashcard[];
  total_flashcards: number;
  due_for_review: number;
}

export type FlashcardQuality = 0 | 1 | 2 | 3 | 4 | 5;
```

### Flashcard Review Container

Create `src/components/flashcards/FlashcardReview.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { FlashcardCard } from './FlashcardCard';
import { FlashcardRating } from './FlashcardRating';
import { ReviewProgress } from './ReviewProgress';
import { useFlashcards } from '@/hooks/useFlashcards';
import { FlashcardQuality } from '@/types/flashcard';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle } from 'lucide-react';

interface FlashcardReviewProps {
  topicId: number;
  onComplete: () => void;
  onBack: () => void;
}

export const FlashcardReview: React.FC<FlashcardReviewProps> = ({
  topicId,
  onComplete,
  onBack,
}) => {
  const { flashcards, loading, submitReview } = useFlashcards(topicId);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentCard = flashcards[currentIndex];
  const isLastCard = currentIndex === flashcards.length - 1;

  const handleFlip = () => {
    setShowBack(!showBack);
  };

  const handleRating = async (quality: FlashcardQuality) => {
    if (!currentCard || isSubmitting) return;

    setIsSubmitting(true);

    try {
      await submitReview(currentCard.id, quality);

      // Move to next card or complete
      if (isLastCard) {
        onComplete();
      } else {
        setCurrentIndex(currentIndex + 1);
        setShowBack(false);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading flashcards...</div>;
  }

  if (!flashcards.length) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <p className="text-gray-600 mb-4">No flashcards available for this topic.</p>
        <Button onClick={onBack}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>

        <ReviewProgress
          current={currentIndex + 1}
          total={flashcards.length}
        />
      </div>

      {/* Flashcard */}
      <FlashcardCard
        card={currentCard}
        showBack={showBack}
        onFlip={handleFlip}
      />

      {/* Rating Buttons */}
      {showBack ? (
        <FlashcardRating
          onRate={handleRating}
          disabled={isSubmitting}
        />
      ) : (
        <div className="flex justify-center mt-6">
          <Button onClick={handleFlip} size="lg">
            Show Answer
          </Button>
        </div>
      )}

      {/* Completion Message */}
      {isLastCard && showBack && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg text-center">
          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-sm text-green-800">
            Last card! Rate this card to complete your review.
          </p>
        </div>
      )}
    </div>
  );
};
```

### Flashcard Card Component

Create `src/components/flashcards/FlashcardCard.tsx`:

```typescript
import React from 'react';
import { Card } from '@/components/ui/card';
import { Flashcard } from '@/types/flashcard';
import { Lightbulb } from 'lucide-react';

interface FlashcardCardProps {
  card: Flashcard;
  showBack: boolean;
  onFlip: () => void;
}

export const FlashcardCard: React.FC<FlashcardCardProps> = ({
  card,
  showBack,
  onFlip,
}) => {
  return (
    <Card
      className="min-h-[300px] p-8 cursor-pointer transition-all hover:shadow-xl"
      onClick={onFlip}
    >
      <div className="flex flex-col h-full justify-center">
        {/* Front */}
        <div className="text-center mb-6">
          <div className="text-xs text-gray-500 mb-2">
            {showBack ? 'Answer' : 'Question'}
          </div>
          <h2 className="text-2xl font-semibold">
            {showBack ? card.back : card.front}
          </h2>
        </div>

        {/* Hint (if back is shown and hint exists) */}
        {showBack && card.hint && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-600 mt-1 flex-shrink-0" />
              <div>
                <div className="text-xs font-semibold text-yellow-800 mb-1">Hint</div>
                <p className="text-sm text-yellow-700">{card.hint}</p>
              </div>
            </div>
          </div>
        )}

        {/* Statistics (if reviewed before) */}
        {showBack && card.total_reviews > 0 && (
          <div className="mt-6 text-xs text-gray-500 text-center">
            Reviewed {card.total_reviews} times • {card.accuracy.toFixed(0)}% accuracy
          </div>
        )}

        {/* Tap to flip hint */}
        {!showBack && (
          <div className="text-xs text-gray-400 text-center mt-4">
            Tap to flip
          </div>
        )}
      </div>
    </Card>
  );
};
```

### Flashcard Rating Component

Create `src/components/flashcards/FlashcardRating.tsx`:

```typescript
import React from 'react';
import { Button } from '@/components/ui/button';
import { FlashcardQuality } from '@/types/flashcard';

interface FlashcardRatingProps {
  onRate: (quality: FlashcardQuality) => void;
  disabled?: boolean;
}

export const FlashcardRating: React.FC<FlashcardRatingProps> = ({
  onRate,
  disabled = false,
}) => {
  const ratings = [
    { quality: 0, label: 'Failed', color: 'bg-red-500 hover:bg-red-600', description: 'Completely forgot' },
    { quality: 3, label: 'Hard', color: 'bg-orange-500 hover:bg-orange-600', description: 'Barely remembered' },
    { quality: 4, label: 'Good', color: 'bg-blue-500 hover:bg-blue-600', description: 'Some effort' },
    { quality: 5, label: 'Easy', color: 'bg-green-500 hover:bg-green-600', description: 'Instantly recalled' },
  ];

  return (
    <div className="mt-6">
      <div className="text-sm text-gray-600 text-center mb-4">
        How well did you know this?
      </div>

      <div className="grid grid-cols-2 gap-3">
        {ratings.map((rating) => (
          <Button
            key={rating.quality}
            onClick={() => onRate(rating.quality as FlashcardQuality)}
            disabled={disabled}
            className={`${rating.color} text-white flex flex-col items-center py-6 h-auto`}
          >
            <span className="font-semibold text-lg mb-1">{rating.label}</span>
            <span className="text-xs opacity-90">{rating.description}</span>
          </Button>
        ))}
      </div>

      <div className="text-xs text-gray-500 text-center mt-4">
        Your rating determines when you'll see this card again
      </div>
    </div>
  );
};
```

### Review Progress Component

Create `src/components/flashcards/ReviewProgress.tsx`:

```typescript
import React from 'react';
import { Progress } from '@/components/ui/progress';

interface ReviewProgressProps {
  current: number;
  total: number;
}

export const ReviewProgress: React.FC<ReviewProgressProps> = ({
  current,
  total,
}) => {
  const percentage = (current / total) * 100;

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-gray-700">
        {current} / {total}
      </span>
      <Progress value={percentage} className="w-32" />
    </div>
  );
};
```

---

## 4. State Management

### Custom Hooks

Create `src/hooks/useWorkflow.ts`:

```typescript
import { useState, useEffect } from 'react';
import { WorkflowData } from '@/types/workflow';
import { api } from '@/lib/api';

export const useWorkflow = (sessionId: string) => {
  const [workflow, setWorkflow] = useState<WorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        setLoading(true);
        const data = await api.get<WorkflowData>(
          `/study-sessions/sessions/${sessionId}/workflow`
        );
        setWorkflow(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load workflow');
      } finally {
        setLoading(false);
      }
    };

    if (sessionId) {
      fetchWorkflow();
    }
  }, [sessionId]);

  return { workflow, loading, error };
};
```

Create `src/hooks/useFlashcards.ts`:

```typescript
import { useState, useEffect } from 'react';
import { Flashcard, FlashcardReviewData, FlashcardQuality } from '@/types/flashcard';
import { api } from '@/lib/api';

export const useFlashcards = (topicId: number) => {
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFlashcards = async () => {
      try {
        setLoading(true);
        const data = await api.get<FlashcardReviewData>(
          `/study-sessions/topics/${topicId}/flashcards`
        );
        setFlashcards(data.flashcards);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load flashcards');
      } finally {
        setLoading(false);
      }
    };

    if (topicId) {
      fetchFlashcards();
    }
  }, [topicId]);

  const submitReview = async (flashcardId: number, quality: FlashcardQuality) => {
    try {
      await api.post(`/study-sessions/flashcards/${flashcardId}/review`, {
        quality,
      });
    } catch (err) {
      throw new Error('Failed to submit review');
    }
  };

  return { flashcards, loading, error, submitReview };
};
```

---

## 5. API Integration

Create `src/lib/api.ts`:

```typescript
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const token = localStorage.getItem('auth_token');

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const api = new ApiClient();
```

---

## 6. Styling Guide

### Workflow Node States

```css
/* Locked (gray) */
.node-locked {
  background: #e5e7eb;
  border-color: #9ca3af;
}

/* Available (green) */
.node-available {
  background: #dcfce7;
  border-color: #22c55e;
}

/* Quiz Completed (blue) */
.node-completed {
  background: #dbeafe;
  border-color: #3b82f6;
}

/* Fully Completed (purple) */
.node-finished {
  background: #f3e8ff;
  border-color: #a855f7;
}
```

### Flashcard Animations

```css
/* Flip animation */
.flashcard-flip {
  animation: flip 0.6s ease-in-out;
}

@keyframes flip {
  0% {
    transform: rotateY(0deg);
  }
  50% {
    transform: rotateY(90deg);
  }
  100% {
    transform: rotateY(0deg);
  }
}
```

---

## ✅ Implementation Checklist

### Workflow Visualization
- [ ] Install React Flow or D3.js
- [ ] Create WorkflowCanvas component
- [ ] Create WorkflowNode component
- [ ] Create FlashcardNode component
- [ ] Implement prerequisite connections
- [ ] Add stage-based styling
- [ ] Test node interactions

### Flashcard Review
- [ ] Create FlashcardReview container
- [ ] Create FlashcardCard component
- [ ] Create FlashcardRating component
- [ ] Create ReviewProgress component
- [ ] Implement flip animation
- [ ] Add keyboard shortcuts (space to flip, 0-5 to rate)

### State Management
- [ ] Create useWorkflow hook
- [ ] Create useFlashcards hook
- [ ] Implement API client
- [ ] Add error handling
- [ ] Add loading states

### Integration
- [ ] Connect workflow to session page
- [ ] Connect flashcard review to workflow nodes
- [ ] Test end-to-end flow
- [ ] Add analytics tracking

---

## 🎨 UI/UX Best Practices

1. **Visual Feedback:** Always show loading states and animations
2. **Keyboard Shortcuts:** Space to flip, 0-5 to rate
3. **Mobile Responsive:** Ensure workflow is pannable/zoomable on mobile
4. **Accessibility:** Add ARIA labels and keyboard navigation
5. **Error Handling:** Show friendly error messages with retry options

---

## 📚 Additional Resources

- [React Flow Docs](https://reactflow.dev/)
- [D3.js Graph Layouts](https://d3js.org/)
- [Spaced Repetition UX](https://ncase.me/remember/)
- [shadcn/ui Components](https://ui.shadcn.com/)

---

**Ready to build?** Start with the workflow visualization, then add the flashcard review UI, and finally connect everything together!
