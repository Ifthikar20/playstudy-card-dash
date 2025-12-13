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

    # Try to detect and decode base64 content
    content_bytes = None

    # First, try base64 decode
    try:
        # Remove any whitespace and check if it looks like base64
        clean_content = content.strip()
        if len(clean_content) % 4 == 0 and all(c in 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=' for c in clean_content[:100]):
            content_bytes = base64.b64decode(clean_content)
    except Exception:
        pass

    # If base64 decode failed, try other methods
    if content_bytes is None:
        # Check if content starts with binary markers
        if content.startswith('PK\x03\x04') or content.startswith('%PDF'):
            # Try to convert string to bytes using different encodings
            for encoding in ['latin-1', 'iso-8859-1', 'cp1252']:
                try:
                    content_bytes = content.encode(encoding)
                    break
                except UnicodeEncodeError:
                    continue

            if content_bytes is None:
                # Last resort: use utf-8 with error handling
                content_bytes = content.encode('utf-8', errors='ignore')

    # Now try to extract text based on file type
    if content_bytes:
        # Check for Word document (ZIP/docx)
        if content_bytes.startswith(b'PK\x03\x04'):
            try:
                doc = Document(io.BytesIO(content_bytes))
                text = '\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
                if text.strip():
                    return text
                raise ValueError("No text content found in document")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to extract text from Word document: {str(e)}"
                )

        # Check for PDF
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

    # If we got here, assume it's plain text
    # Clean up any Unicode replacement characters
    cleaned_text = content.replace('\ufffd', '').strip()
    if cleaned_text:
        return cleaned_text

    # If all else fails, return the original content
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
    questions: List[QuestionSchema]
    completed: bool = False
    score: Optional[int] = None
    currentQuestionIndex: int = 0


class CreateStudySessionRequest(BaseModel):
    """Request schema for creating a study session."""
    title: str = Field(..., min_length=1, max_length=200)
    content: str = Field(..., min_length=10, max_length=50000)
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

        # Step 1: Extract topics from content
        topics_prompt = f"""Analyze this study material and extract {data.num_topics} major topics that should be covered.

Study Material:
{extracted_text}

Requirements:
1. Identify {data.num_topics} distinct, important topics from the material
2. Each topic should be substantial enough for {data.questions_per_topic} questions
3. Provide a clear title and brief description for each topic
4. Topics should be ordered logically (foundational concepts first)

Return ONLY a valid JSON object in this EXACT format:
{{
  "topics": [
    {{
      "title": "Topic Title",
      "description": "Brief description of what this topic covers"
    }}
  ]
}}"""

        # Call AI to extract topics
        topics_message = client.messages.create(
            model="claude-3-5-sonnet-20241022",
            max_tokens=2048,
            temperature=0.7,
            messages=[{"role": "user", "content": topics_prompt}]
        )

        topics_text = topics_message.content[0].text

        # Parse topics
        try:
            start_idx = topics_text.find('{')
            end_idx = topics_text.rfind('}') + 1
            topics_json = json.loads(topics_text[start_idx:end_idx])
            extracted_topics = topics_json["topics"][:data.num_topics]
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            raise HTTPException(status_code=500, detail=f"Failed to parse topics: {str(e)}")

        # Step 2: Create study session
        study_session = StudySession(
            user_id=current_user.id,
            title=data.title,
            topic=extracted_topics[0]["title"] if extracted_topics else "General Study",
            study_content=extracted_text,  # Store the extracted text, not binary
            topics_count=len(extracted_topics),
            has_full_study=True,
            has_speed_run=True,
            status="in_progress"
        )
        db.add(study_session)
        db.flush()  # Get the session ID

        # Step 3: Generate questions for each topic
        all_topics = []

        for idx, topic_data in enumerate(extracted_topics):
            # Create topic in database
            topic = Topic(
                study_session_id=study_session.id,
                title=topic_data["title"],
                description=topic_data.get("description", ""),
                order_index=idx
            )
            db.add(topic)
            db.flush()  # Get the topic ID

            # Generate questions for this topic
            questions_prompt = f"""Generate {data.questions_per_topic} multiple-choice questions about this topic from the study material.

Topic: {topic_data['title']}
Description: {topic_data.get('description', '')}

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
                model="claude-3-5-sonnet-20241022",
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
                    "question": f"Question {i+1} about {topic_data['title']}",
                    "options": ["Option A", "Option B", "Option C", "Option D"],
                    "correctAnswer": 0,
                    "explanation": "This is a placeholder question."
                } for i in range(data.questions_per_topic)]

            # Save questions to database
            questions_list = []
            for q_idx, q_data in enumerate(questions_data):
                question = Question(
                    topic_id=topic.id,
                    question=q_data["question"],
                    options=q_data["options"],
                    correct_answer=q_data["correctAnswer"],
                    explanation=q_data["explanation"],
                    order_index=q_idx
                )
                db.add(question)
                questions_list.append(QuestionSchema(
                    id=f"topic-{idx+1}-q{q_idx+1}",
                    question=q_data["question"],
                    options=q_data["options"],
                    correctAnswer=q_data["correctAnswer"],
                    explanation=q_data["explanation"]
                ))

            # Build topic response
            all_topics.append(TopicSchema(
                id=f"topic-{idx+1}",
                title=topic_data["title"],
                description=topic_data.get("description", ""),
                questions=questions_list,
                completed=False,
                score=None,
                currentQuestionIndex=0
            ))

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
