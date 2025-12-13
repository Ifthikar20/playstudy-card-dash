"""
Study Sessions API endpoints with AI content processing.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
import anthropic
import json
import io
from docx import Document
from PyPDF2 import PdfReader

from app.config import settings
from app.dependencies import get_current_active_user, get_db
from app.models.user import User
from app.models.study_session import StudySession
from app.models.topic import Topic
from app.models.question import Question
from app.core.rate_limit import limiter

router = APIRouter()


def extract_text_from_content(content: str) -> str:
    """
    Extract readable text from uploaded content.
    Handles:
    - Plain text
    - Word documents (.docx)
    - PDF files
    - Base64 encoded content

    Args:
        content: Raw content string (may be binary, text, or base64)

    Returns:
        Extracted text string
    """
    import base64

    content_bytes = None

    # First, aggressively try base64 decode (most likely for file uploads)
    try:
        # Try base64 decode - this is the most common format for file uploads via JSON
        decoded = base64.b64decode(content, validate=False)
        # Check if it looks like a valid file (ZIP/docx or PDF)
        if decoded.startswith(b'PK\x03\x04') or decoded.startswith(b'%PDF'):
            content_bytes = decoded
    except Exception:
        pass

    # If base64 didn't work and content looks like binary, try encoding it
    if content_bytes is None and (content.startswith('PK\x03\x04') or content.startswith('%PDF')):
        # Try different encodings to convert string to bytes
        for encoding in ['latin-1', 'iso-8859-1', 'cp1252', 'utf-8']:
            try:
                content_bytes = content.encode(encoding)
                break
            except (UnicodeEncodeError, UnicodeDecodeError):
                continue

    # Process based on file type if we have bytes
    if content_bytes:
        # Word document (ZIP/docx)
        if content_bytes.startswith(b'PK\x03\x04'):
            try:
                doc = Document(io.BytesIO(content_bytes))
                text = '\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
                if text.strip():
                    return text
                raise ValueError("No text content found in Word document")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to extract text from Word document: {str(e)}"
                )

        # PDF file
        elif content_bytes.startswith(b'%PDF'):
            try:
                pdf_reader = PdfReader(io.BytesIO(content_bytes))
                text = '\n'.join([page.extract_text() for page in pdf_reader.pages])
                if text.strip():
                    return text
                raise ValueError("No text content found in PDF")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to extract text from PDF: {str(e)}"
                )

    # If we got here, treat as plain text
    # Clean up any Unicode replacement characters
    cleaned_text = content.replace('\ufffd', '').strip()
    if cleaned_text and len(cleaned_text) > 10:
        return cleaned_text

    # Last resort - return original
    return content


class QuestionSchema(BaseModel):
    """Schema for a quiz question."""
    id: str
    question: str
    options: List[str]
    correctAnswer: int
    explanation: str


class TopicSchema(BaseModel):
    """Schema for a study topic."""
    id: str
    title: str
    description: str
    questions: List[QuestionSchema] = []
    completed: bool = False
    score: Optional[int] = None
    currentQuestionIndex: int = 0
    isCategory: bool = False
    parentTopicId: Optional[str] = None
    subtopics: List['TopicSchema'] = []

# Enable forward references for recursive schema
TopicSchema.model_rebuild()


class CreateStudySessionRequest(BaseModel):
    """Request schema for creating a study session."""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=10, max_length=10000000)  # 10MB limit for base64 encoded files
    num_topics: int = Field(default=4, ge=2, le=10)
    questions_per_topic: int = Field(default=10, ge=5, le=20)


class CreateStudySessionResponse(BaseModel):
    """Response schema for created study session."""
    id: int
    title: str
    studyContent: str
    extractedTopics: List[TopicSchema]
    progress: int
    topics: int
    hasFullStudy: bool
    hasSpeedRun: bool


@router.post("/create-with-ai", response_model=CreateStudySessionResponse)
@limiter.limit("5/minute")
async def create_study_session_with_ai(
    request: Request,
    data: CreateStudySessionRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Create a new study session and generate topics/questions using AI.

    This endpoint:
    1. Analyzes the provided content
    2. Extracts major topics using AI
    3. Generates quiz questions for each topic
    4. Saves everything to the database

    Rate Limits:
        - 5 requests per minute per user
    """
    try:
        # Extract text from content (handles Word docs, PDFs, plain text)
        extracted_text = extract_text_from_content(data.content)

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Content is too short or empty. Please provide substantial study material (at least 50 characters)."
            )

        # Initialize Anthropic client
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        # Step 1: Extract topics from content with hierarchical structure
        topics_prompt = f"""Analyze this study material and organize it into a hierarchical structure with categories and subtopics.

Study Material:
{extracted_text}

Requirements:
1. Create 2-4 major categories that organize the content at a high level
2. Within each category, identify 2-4 specific subtopics that can have quiz questions
3. Each subtopic should be substantial enough for {data.questions_per_topic} questions
4. Provide clear titles and brief descriptions for both categories and subtopics
5. Organize logically (foundational concepts first)
6. Aim for approximately {data.num_topics} total subtopics across all categories

Return ONLY a valid JSON object in this EXACT format:
{{
  "categories": [
    {{
      "title": "Category Title",
      "description": "Brief description of this category",
      "subtopics": [
        {{
          "title": "Subtopic Title",
          "description": "Brief description of what this subtopic covers"
        }}
      ]
    }}
  ]
}}"""

        # Call AI to extract topics
        topics_message = client.messages.create(
            model="claude-sonnet-4-5-20250929",
            max_tokens=2048,
            temperature=0.7,
            messages=[{"role": "user", "content": topics_prompt}]
        )

        topics_text = topics_message.content[0].text

        # Parse hierarchical topics
        try:
            start_idx = topics_text.find('{')
            end_idx = topics_text.rfind('}') + 1
            topics_json = json.loads(topics_text[start_idx:end_idx])
            categories_data = topics_json["categories"]
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse topics: {str(e)}")

        # Count total subtopics for the session
        total_subtopics = sum(len(cat.get("subtopics", [])) for cat in categories_data)

        # Step 2: Create study session
        study_session = StudySession(
            user_id=current_user.id,
            title=data.title,
            topic=categories_data[0]["title"] if categories_data else "General Study",
            study_content=extracted_text,  # Store the extracted text, not binary
            topics_count=total_subtopics,
            has_full_study=True,
            has_speed_run=True,
            status="in_progress"
        )
        db.add(study_session)
        db.flush()  # Get the session ID

        # Step 3: Create categories and subtopics with questions
        all_topics = []
        overall_idx = 0

        for cat_idx, category_data in enumerate(categories_data):
            # Create category topic in database
            category_topic = Topic(
                study_session_id=study_session.id,
                title=category_data["title"],
                description=category_data.get("description", ""),
                order_index=cat_idx,
                is_category=True,  # This is a category, not a leaf topic
                parent_topic_id=None
            )
            db.add(category_topic)
            db.flush()  # Get the category ID

            # Create category schema for response
            category_schema = TopicSchema(
                id=f"category-{cat_idx+1}",
                title=category_data["title"],
                description=category_data.get("description", ""),
                isCategory=True,
                parentTopicId=None,
                questions=[],
                subtopics=[]
            )

            # Process subtopics within this category
            subtopics_data = category_data.get("subtopics", [])
            for sub_idx, subtopic_data in enumerate(subtopics_data):
                # Create subtopic in database
                subtopic = Topic(
                    study_session_id=study_session.id,
                    parent_topic_id=category_topic.id,
                    title=subtopic_data["title"],
                    description=subtopic_data.get("description", ""),
                    order_index=sub_idx,
                    is_category=False
                )
                db.add(subtopic)
                db.flush()  # Get the subtopic ID

                # Generate questions for this subtopic
                questions_prompt = f"""Generate {data.questions_per_topic} multiple-choice questions about this subtopic from the study material.

Category: {category_data['title']}
Subtopic: {subtopic_data['title']}
Description: {subtopic_data.get('description', '')}

Study Material:
{extracted_text}

Requirements:
1. Generate exactly {data.questions_per_topic} questions
2. Each question must have exactly 4 options
3. Questions should test understanding of the material
4. Provide clear explanations
5. Return ONLY valid JSON

Return in this EXACT format:
{{
  "questions": [
    {{
      "question": "Question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctAnswer": 0,
      "explanation": "Why this answer is correct"
    }}
  ]
}}"""

                # Call AI to generate questions
                questions_message = client.messages.create(
                    model="claude-sonnet-4-5-20250929",
                    max_tokens=4096,
                    temperature=0.7,
                    messages=[{"role": "user", "content": questions_prompt}]
                )

                questions_text = questions_message.content[0].text

                # Parse questions
                try:
                    q_start = questions_text.find('{')
                    q_end = questions_text.rfind('}') + 1
                    questions_json = json.loads(questions_text[q_start:q_end])
                    questions_data = questions_json["questions"][:data.questions_per_topic]
                except (json.JSONDecodeError, KeyError, ValueError):
                    # If parsing fails, create default questions
                    questions_data = [{
                        "question": f"Question {i+1} about {subtopic_data['title']}",
                        "options": ["Option A", "Option B", "Option C", "Option D"],
                        "correctAnswer": 0,
                        "explanation": "This is a placeholder question."
                    } for i in range(data.questions_per_topic)]

                # Save questions to database
                questions_list = []
                for q_idx, q_data in enumerate(questions_data):
                    question = Question(
                        topic_id=subtopic.id,
                        question=q_data["question"],
                        options=q_data["options"],
                        correct_answer=q_data["correctAnswer"],
                        explanation=q_data["explanation"],
                        order_index=q_idx
                    )
                    db.add(question)
                    questions_list.append(QuestionSchema(
                        id=f"topic-{overall_idx+1}-q{q_idx+1}",
                        question=q_data["question"],
                        options=q_data["options"],
                        correctAnswer=q_data["correctAnswer"],
                        explanation=q_data["explanation"]
                    ))

                # Build subtopic response
                subtopic_schema = TopicSchema(
                    id=f"subtopic-{cat_idx+1}-{sub_idx+1}",
                    title=subtopic_data["title"],
                    description=subtopic_data.get("description", ""),
                    questions=questions_list,
                    completed=False,
                    score=None,
                    currentQuestionIndex=0,
                    isCategory=False,
                    parentTopicId=f"category-{cat_idx+1}",
                    subtopics=[]
                )
                category_schema.subtopics.append(subtopic_schema)
                overall_idx += 1

            # Add category to all_topics
            all_topics.append(category_schema)

        # Commit all changes
        db.commit()
        db.refresh(study_session)

        return CreateStudySessionResponse(
            id=study_session.id,
            title=study_session.title,
            studyContent=study_session.study_content,
            extractedTopics=all_topics,
            progress=0,
            topics=len(all_topics),
            hasFullStudy=True,
            hasSpeedRun=True
        )

    except anthropic.APIError as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"AI API error: {str(e)}")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create study session: {str(e)}")
