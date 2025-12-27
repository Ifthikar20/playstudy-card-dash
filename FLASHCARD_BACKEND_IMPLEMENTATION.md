# Flashcard System - Backend Implementation Guide

Complete implementation guide for the flashcard and workflow visualization backend.

---

## 📋 Table of Contents

1. [Database Models](#database-models)
2. [API Endpoints](#api-endpoints)
3. [Spaced Repetition Algorithm](#spaced-repetition-algorithm)
4. [AI Integration](#ai-integration)
5. [Migration Scripts](#migration-scripts)
6. [Testing](#testing)

---

## 1. Database Models

### Create `app/models/flashcard.py`

```python
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.database import Base

class Flashcard(Base):
    __tablename__ = "flashcards"

    id = Column(Integer, primary_key=True, index=True)
    topic_id = Column(Integer, ForeignKey("topics.id", ondelete="CASCADE"), nullable=False)

    # Content
    front = Column(Text, nullable=False)
    back = Column(Text, nullable=False)
    hint = Column(Text, nullable=True)
    order_index = Column(Integer, default=0)

    # Spaced Repetition (SM-2)
    ease_factor = Column(Float, default=2.5)
    interval_days = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)
    next_review_date = Column(DateTime, nullable=True)
    last_reviewed_at = Column(DateTime, nullable=True)

    # Statistics
    total_reviews = Column(Integer, default=0)
    correct_reviews = Column(Integer, default=0)

    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    topic = relationship("Topic", back_populates="flashcards")

    @property
    def accuracy(self) -> float:
        """Calculate accuracy percentage"""
        if self.total_reviews == 0:
            return 0.0
        return (self.correct_reviews / self.total_reviews) * 100

    @property
    def is_due(self) -> bool:
        """Check if flashcard is due for review"""
        if not self.next_review_date:
            return True
        return datetime.utcnow() >= self.next_review_date

    def calculate_next_review(self, quality: int) -> dict:
        """
        Calculate next review date using SM-2 algorithm

        Args:
            quality: User rating (0-5)
                0-2: Failed
                3: Hard
                4: Good
                5: Easy

        Returns:
            dict with updated values
        """
        # Quality less than 3 = failed
        if quality < 3:
            self.interval_days = 1
            self.repetitions = 0
            self.ease_factor = max(1.3, self.ease_factor - 0.2)
        else:
            # Successful review
            if self.repetitions == 0:
                self.interval_days = 1
            elif self.repetitions == 1:
                self.interval_days = 6
            else:
                self.interval_days = int(self.interval_days * self.ease_factor)

            self.repetitions += 1

            # Adjust ease factor based on quality
            self.ease_factor = max(
                1.3,
                self.ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
            )

            self.correct_reviews += 1

        # Update review stats
        self.total_reviews += 1
        self.last_reviewed_at = datetime.utcnow()
        self.next_review_date = datetime.utcnow() + timedelta(days=self.interval_days)

        return {
            "next_review_date": self.next_review_date,
            "interval_days": self.interval_days,
            "ease_factor": self.ease_factor,
            "repetitions": self.repetitions
        }
```

### Update `app/models/topic.py`

```python
from sqlalchemy import Column, Integer, String, Float, ARRAY
from sqlalchemy.orm import relationship
from app.database import Base

class Topic(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, index=True)
    # ... existing fields ...

    # Workflow visualization fields
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    workflow_stage = Column(String, default="locked")
    prerequisite_topic_ids = Column(ARRAY(Integer), default=[])

    # Relationships
    flashcards = relationship("Flashcard", back_populates="topic", cascade="all, delete-orphan")

    @property
    def flashcard_count(self) -> int:
        """Get count of flashcards for this topic"""
        return len(self.flashcards)

    @property
    def question_count(self) -> int:
        """Get count of questions for this topic"""
        return len(self.questions)
```

---

## 2. API Endpoints

### Create `app/api/v1/endpoints/flashcards.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.flashcard import Flashcard
from app.models.topic import Topic
from app.schemas.flashcard import FlashcardResponse, FlashcardReviewRequest, FlashcardReviewResponse
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/topics/{topic_id}/flashcards", response_model=dict)
async def get_topic_flashcards(
    topic_id: int,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get all flashcards for a topic

    Returns flashcards ordered by order_index, with review statistics
    """
    # Get topic
    topic = db.query(Topic).filter(Topic.id == topic_id).first()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Get flashcards
    flashcards = db.query(Flashcard)\
        .filter(Flashcard.topic_id == topic_id)\
        .order_by(Flashcard.order_index)\
        .all()

    # Calculate due for review count
    due_count = sum(1 for card in flashcards if card.is_due)

    return {
        "topic_id": topic.id,
        "topic_title": topic.title,
        "flashcards": [
            {
                "id": card.id,
                "front": card.front,
                "back": card.back,
                "hint": card.hint,
                "order_index": card.order_index,
                "ease_factor": card.ease_factor,
                "interval_days": card.interval_days,
                "repetitions": card.repetitions,
                "next_review_date": card.next_review_date,
                "last_reviewed_at": card.last_reviewed_at,
                "total_reviews": card.total_reviews,
                "correct_reviews": card.correct_reviews,
                "accuracy": card.accuracy,
                "is_due": card.is_due
            }
            for card in flashcards
        ],
        "total_flashcards": len(flashcards),
        "due_for_review": due_count
    }


@router.post("/flashcards/{flashcard_id}/review", response_model=dict)
async def submit_flashcard_review(
    flashcard_id: int,
    review: FlashcardReviewRequest,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Submit a flashcard review with quality rating

    Quality ratings:
    - 0-2: Failed (card shown again soon)
    - 3: Hard (passed but difficult)
    - 4: Good (passed with some effort)
    - 5: Easy (passed easily)
    """
    # Validate quality
    if not 0 <= review.quality <= 5:
        raise HTTPException(status_code=400, detail="Quality must be between 0 and 5")

    # Get flashcard
    flashcard = db.query(Flashcard).filter(Flashcard.id == flashcard_id).first()
    if not flashcard:
        raise HTTPException(status_code=404, detail="Flashcard not found")

    # Calculate next review using SM-2 algorithm
    result = flashcard.calculate_next_review(review.quality)

    # Save to database
    db.commit()
    db.refresh(flashcard)

    return {
        "flashcard_id": flashcard.id,
        "quality": review.quality,
        "next_review_date": result["next_review_date"],
        "interval_days": result["interval_days"],
        "ease_factor": result["ease_factor"],
        "repetitions": result["repetitions"],
        "total_reviews": flashcard.total_reviews,
        "correct_reviews": flashcard.correct_reviews,
        "accuracy": flashcard.accuracy
    }
```

### Create `app/api/v1/endpoints/workflow.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.study_session import StudySession
from app.models.topic import Topic
from app.core.auth import get_current_user

router = APIRouter()

@router.get("/sessions/{session_id}/workflow", response_model=dict)
async def get_workflow_visualization(
    session_id: str,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Get workflow visualization data for skill-tree UI

    Returns all topics with their positions, stages, and metadata
    """
    # Get study session
    session = db.query(StudySession)\
        .filter(StudySession.session_id == session_id)\
        .first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    # Get all topics for this session
    topics = db.query(Topic)\
        .filter(Topic.study_session_id == session.id)\
        .order_by(Topic.order_index)\
        .all()

    # Build workflow nodes
    workflow_nodes = []
    for topic in topics:
        workflow_nodes.append({
            "topic_id": topic.id,
            "title": topic.title,
            "description": topic.description or "",
            "is_category": topic.is_category,
            "parent_topic_id": topic.parent_topic_id,
            "order_index": topic.order_index,
            "workflow_stage": topic.workflow_stage,
            "position_x": topic.position_x,
            "position_y": topic.position_y,
            "prerequisite_topic_ids": topic.prerequisite_topic_ids or [],
            "question_count": topic.question_count,
            "flashcard_count": topic.flashcard_count,
            "completed": topic.completed,
            "score": topic.score,
            "current_question_index": topic.current_question_index
        })

    # Calculate overall progress
    completed_topics = sum(1 for t in topics if t.completed)
    progress = int((completed_topics / len(topics)) * 100) if topics else 0

    return {
        "session_id": session_id,
        "title": session.title,
        "progress": progress,
        "workflow_nodes": workflow_nodes,
        "total_nodes": len(workflow_nodes)
    }
```

### Update `app/api/v1/api.py`

```python
from fastapi import APIRouter
from app.api.v1.endpoints import flashcards, workflow

api_router = APIRouter()

# Include flashcard routes
api_router.include_router(
    flashcards.router,
    prefix="/study-sessions",
    tags=["flashcards"]
)

# Include workflow routes
api_router.include_router(
    workflow.router,
    prefix="/study-sessions",
    tags=["workflow"]
)
```

---

## 3. Spaced Repetition Algorithm

### SM-2 Algorithm Implementation

The **SuperMemo 2 (SM-2)** algorithm is implemented in the `Flashcard.calculate_next_review()` method.

**Key Points:**
- **Quality < 3:** Failed review, reset to 1 day
- **First review:** 1 day interval
- **Second review:** 6 days interval
- **Subsequent reviews:** interval × ease_factor

**Ease Factor Adjustment:**
```python
ease_factor = max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
```

**Example Review Schedule:**
```
Quality 4 (Good):
Review 1: Today → Next: +1 day
Review 2: +1 day → Next: +6 days
Review 3: +6 days → Next: +15 days (6 × 2.5)
Review 4: +15 days → Next: +37 days (15 × 2.5)
```

---

## 4. AI Integration

### Update AI Prompt to Generate Flashcards

Modify `app/services/ai_service.py`:

```python
async def generate_study_content(document_text: str, num_topics: int = 20):
    """
    Generate study content including questions AND flashcards

    Returns topics with:
    - 15-20 questions per topic
    - 3-5 flashcards per topic (NEW!)
    """

    prompt = f"""
Analyze the following document and create a comprehensive study guide.

Generate {num_topics} topics with:
1. 15-20 quiz questions (multiple choice)
2. 3-5 flashcards (NEW!)

For flashcards:
- Focus on KEY DEFINITIONS, CONCEPTS, TERMS
- Front: Concise question or term (max 100 characters)
- Back: Comprehensive but digestible answer (max 500 characters)
- Hint: Optional mnemonic or memory aid (max 100 characters)

Example flashcard:
{{
  "front": "What is load balancing?",
  "back": "Load balancing is the process of distributing network traffic across multiple servers to ensure no single server is overwhelmed, improving reliability and performance.",
  "hint": "Think about traffic distribution across multiple lanes"
}}

Return JSON in this format:
{{
  "subtopics": {{
    "0": {{
      "title": "Topic Title",
      "questions": [...],
      "flashcards": [
        {{
          "front": "Question or term",
          "back": "Answer or definition",
          "hint": "Optional memory aid"
        }}
      ]
    }}
  }}
}}

Document:
{document_text}
"""

    # Call AI API (Anthropic, OpenAI, etc.)
    response = await ai_client.generate(prompt)

    return response
```

### Save Flashcards to Database

Update `app/services/study_session_service.py`:

```python
async def create_flashcards_for_topic(
    db: Session,
    topic_id: int,
    flashcard_data: List[dict]
):
    """
    Create flashcards for a topic

    Args:
        topic_id: Topic ID
        flashcard_data: List of flashcard dicts from AI
    """
    for idx, card in enumerate(flashcard_data):
        flashcard = Flashcard(
            topic_id=topic_id,
            front=card["front"],
            back=card["back"],
            hint=card.get("hint"),
            order_index=idx
        )
        db.add(flashcard)

    db.commit()
```

---

## 5. Migration Scripts

### Create `migrations/add_flashcards_and_workflow.py`

```python
"""
Migration: Add flashcards table and workflow fields

Run with: python migrations/add_flashcards_and_workflow.py
"""

from sqlalchemy import create_engine, text
import os

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/playstudy_db")

engine = create_engine(DATABASE_URL)

def run_migration():
    with engine.connect() as conn:
        # Create flashcards table
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS flashcards (
                id SERIAL PRIMARY KEY,
                topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,

                -- Content
                front TEXT NOT NULL,
                back TEXT NOT NULL,
                hint TEXT,
                order_index INTEGER DEFAULT 0,

                -- Spaced repetition
                ease_factor FLOAT DEFAULT 2.5,
                interval_days INTEGER DEFAULT 1,
                repetitions INTEGER DEFAULT 0,
                next_review_date TIMESTAMP,
                last_reviewed_at TIMESTAMP,

                -- Statistics
                total_reviews INTEGER DEFAULT 0,
                correct_reviews INTEGER DEFAULT 0,

                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """))

        # Create index
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS idx_flashcards_topic_id
            ON flashcards(topic_id);
        """))

        # Add workflow fields to topics table
        conn.execute(text("""
            ALTER TABLE topics
            ADD COLUMN IF NOT EXISTS position_x FLOAT,
            ADD COLUMN IF NOT EXISTS position_y FLOAT,
            ADD COLUMN IF NOT EXISTS workflow_stage VARCHAR DEFAULT 'locked',
            ADD COLUMN IF NOT EXISTS prerequisite_topic_ids INTEGER[];
        """))

        # Initialize workflow_stage for existing topics
        conn.execute(text("""
            UPDATE topics
            SET workflow_stage = 'quiz_available'
            WHERE workflow_stage IS NULL;
        """))

        conn.commit()

    print("✅ Migration completed successfully!")

if __name__ == "__main__":
    run_migration()
```

---

## 6. Testing

### Test Flashcard Creation

```python
# tests/test_flashcards.py

def test_create_flashcards():
    """Test flashcard creation for a topic"""
    flashcards = [
        {"front": "What is Docker?", "back": "Containerization platform", "hint": "Think containers"},
        {"front": "What is Kubernetes?", "back": "Container orchestration", "hint": "Think K8s"}
    ]

    for card in flashcards:
        flashcard = Flashcard(
            topic_id=1,
            front=card["front"],
            back=card["back"],
            hint=card.get("hint")
        )
        db.add(flashcard)

    db.commit()

    # Verify
    saved = db.query(Flashcard).filter(Flashcard.topic_id == 1).all()
    assert len(saved) == 2
```

### Test Spaced Repetition

```python
def test_spaced_repetition():
    """Test SM-2 algorithm calculation"""
    flashcard = Flashcard(
        topic_id=1,
        front="Test",
        back="Answer"
    )

    # First review (quality 4 = Good)
    result = flashcard.calculate_next_review(quality=4)
    assert result["interval_days"] == 1
    assert flashcard.repetitions == 1

    # Second review (quality 4)
    result = flashcard.calculate_next_review(quality=4)
    assert result["interval_days"] == 6
    assert flashcard.repetitions == 2

    # Third review (quality 5 = Easy)
    result = flashcard.calculate_next_review(quality=5)
    assert result["interval_days"] > 6  # Should be interval × ease_factor
    assert flashcard.repetitions == 3
```

### Test Workflow Endpoint

```python
def test_workflow_visualization():
    """Test workflow endpoint returns correct data"""
    response = client.get(f"/api/v1/study-sessions/sessions/{session_id}/workflow")

    assert response.status_code == 200
    data = response.json()

    assert "workflow_nodes" in data
    assert len(data["workflow_nodes"]) > 0
    assert "question_count" in data["workflow_nodes"][0]
    assert "flashcard_count" in data["workflow_nodes"][0]
```

---

## 📚 Additional Resources

- **SM-2 Algorithm:** https://www.supermemo.com/en/archives1990-2015/english/ol/sm2
- **FastAPI Docs:** https://fastapi.tiangolo.com/
- **SQLAlchemy Relationships:** https://docs.sqlalchemy.org/en/14/orm/relationship_api.html

---

## ✅ Implementation Checklist

- [ ] Create `Flashcard` model
- [ ] Update `Topic` model with workflow fields
- [ ] Implement spaced repetition algorithm
- [ ] Create flashcard API endpoints
- [ ] Create workflow visualization endpoint
- [ ] Update AI prompt to generate flashcards
- [ ] Create migration script
- [ ] Write unit tests
- [ ] Test end-to-end flow
- [ ] Deploy to production

---

**Ready to implement?** Start with the database models, then move to API endpoints, and finally integrate with the AI service!
