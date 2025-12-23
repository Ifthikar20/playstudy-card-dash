"""
Study Sessions API endpoints with AI content processing.
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from openai import OpenAI
from anthropic import Anthropic
import json
import io
import uuid
import logging
from docx import Document
from PyPDF2 import PdfReader
from pptx import Presentation

from app.config import settings
from app.dependencies import get_current_active_user, get_db
from app.models.user import User
from app.models.study_session import StudySession
from app.models.topic import Topic
from app.models.question import Question
from app.core.rate_limit import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


def build_topic_hierarchy(session: StudySession, db: Session) -> List[TopicSchema]:
    """
    Build hierarchical topic structure with questions for a study session.

    Args:
        session: StudySession database model
        db: Database session

    Returns:
        List of TopicSchema objects with nested subtopics and questions
    """
    from app.models.question import Question

    # Fetch all topics for this session
    all_topics = db.query(Topic).filter(
        Topic.study_session_id == session.id
    ).order_by(Topic.order_index).all()

    # Build hierarchical structure
    categories = [t for t in all_topics if t.is_category and t.parent_topic_id is None]

    result_topics = []

    for cat_idx, category in enumerate(categories):
        # Get subtopics for this category
        subtopics = [t for t in all_topics if t.parent_topic_id == category.id]

        category_schema = TopicSchema(
            id=f"category-{cat_idx+1}",
            db_id=category.id,
            title=category.title,
            description=category.description or "",
            isCategory=True,
            parentTopicId=None,
            questions=[],
            subtopics=[]
        )

        for sub_idx, subtopic in enumerate(subtopics):
            # Fetch questions for this subtopic
            questions = db.query(Question).filter(
                Question.topic_id == subtopic.id
            ).order_by(Question.order_index).all()

            questions_list = [
                QuestionSchema(
                    id=f"topic-{sub_idx+1}-q{q.order_index+1}",
                    question=q.question,
                    options=q.options,
                    correctAnswer=q.correct_answer,
                    explanation=q.explanation,
                    sourceText=q.source_text,
                    sourcePage=q.source_page
                )
                for q in questions
            ]

            subtopic_schema = TopicSchema(
                id=f"subtopic-{cat_idx+1}-{sub_idx+1}",
                db_id=subtopic.id,
                title=subtopic.title,
                description=subtopic.description or "",
                questions=questions_list,
                completed=subtopic.completed or False,
                score=subtopic.score,
                currentQuestionIndex=subtopic.current_question_index or 0,
                isCategory=False,
                parentTopicId=f"category-{cat_idx+1}",
                subtopics=[]
            )
            category_schema.subtopics.append(subtopic_schema)

        result_topics.append(category_schema)

    return result_topics


def analyze_content_complexity(text: str) -> dict:
    """
    Analyze content complexity and recommend topic/question counts.

    Args:
        text: Extracted text content

    Returns:
        Dictionary with analysis results including:
        - word_count: Total number of words
        - estimated_reading_time: Time to read in minutes
        - recommended_topics: Suggested number of topics
        - recommended_questions: Suggested questions per topic
        - complexity_score: 0-1 score of content complexity
        - unique_word_ratio: Vocabulary richness
    """
    words = text.split()
    word_count = len(words)

    # Calculate unique words ratio (vocabulary richness)
    unique_words = len(set(word.lower() for word in words if word.isalnum()))
    unique_word_ratio = unique_words / max(word_count, 1)

    # Average word length (longer words = more complex)
    avg_word_length = sum(len(word) for word in words) / max(word_count, 1)

    # Sentence count (approximate by counting periods, exclamation, question marks)
    sentences = len([c for c in text if c in '.!?'])
    avg_sentence_length = word_count / max(sentences, 1)

    # Calculate complexity score (0-1 scale)
    # Based on: vocabulary richness, average word length, sentence complexity
    complexity_score = min(1.0, (
        (unique_word_ratio * 0.4) +  # 40% weight on vocabulary
        (min(avg_word_length / 8, 1.0) * 0.3) +  # 30% weight on word length
        (min(avg_sentence_length / 25, 1.0) * 0.3)  # 30% weight on sentence length
    ))

    # Reading time (average reading speed: 200-250 words/minute)
    estimated_reading_time = max(1, round(word_count / 225))

    # Recommend topics based on word count and complexity - TRULY DYNAMIC scaling
    # Very short (< 100 words): 1 topic
    # Short (100-500 words): 2-4 topics
    # Medium (500-2000 words): 4-8 topics
    # Long (2000-5000 words): 8-15 topics
    # Very long (5000-10000 words): 15-30 topics
    # Extremely long (10000-20000 words): 30-60 topics
    # Massive (20000+ words): 60-100 topics
    if word_count < 100:
        base_topics = 1
    elif word_count < 500:
        base_topics = 3
    elif word_count < 2000:
        base_topics = 6
    elif word_count < 5000:
        base_topics = 12
    elif word_count < 10000:
        base_topics = 20
    elif word_count < 20000:
        base_topics = 45
    else:
        base_topics = 70

    # Adjust based on complexity
    recommended_topics = max(1, min(100, round(base_topics * (0.7 + complexity_score * 0.6))))

    # Recommend questions per topic based on content depth
    # More complex content = more questions to test understanding
    if word_count < 1000:
        base_questions = 8
    elif word_count < 3000:
        base_questions = 12
    else:
        base_questions = 15

    # Adjust based on complexity
    recommended_questions = max(5, min(50, round(base_questions * (0.8 + complexity_score * 0.4))))

    return {
        'word_count': word_count,
        'estimated_reading_time': estimated_reading_time,
        'recommended_topics': recommended_topics,
        'recommended_questions': recommended_questions,
        'complexity_score': round(complexity_score, 2),
        'unique_word_ratio': round(unique_word_ratio, 2),
        'avg_word_length': round(avg_word_length, 1),
        'avg_sentence_length': round(avg_sentence_length, 1)
    }


def detect_file_type_and_extract(content: str) -> tuple[str, str, str]:
    """
    Detect file type and extract text from uploaded content.

    Returns:
        tuple: (extracted_text, file_type, original_base64_content)
            - extracted_text: The text content extracted from the file
            - file_type: One of: 'pdf', 'pptx', 'docx', 'txt'
            - original_base64_content: The original base64 encoded file
    """
    import base64

    content_bytes = None
    file_type = 'txt'
    original_base64 = content

    # First, aggressively try base64 decode (most likely for file uploads)
    try:
        # Try base64 decode - this is the most common format for file uploads via JSON
        decoded = base64.b64decode(content, validate=False)
        # Check if it looks like a valid file (ZIP/docx or PDF)
        if decoded.startswith(b'PK\x03\x04') or decoded.startswith(b'%PDF'):
            content_bytes = decoded
    except Exception:
        pass

    # Process based on file type if we have bytes
    if content_bytes:
        # Office documents (ZIP/docx/pptx)
        if content_bytes.startswith(b'PK\x03\x04'):
            # Try PowerPoint first
            try:
                prs = Presentation(io.BytesIO(content_bytes))
                text_parts = []
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            text_parts.append(shape.text)
                text = '\n'.join(text_parts)
                if text.strip():
                    return (text, 'pptx', original_base64)
                raise ValueError("No text content found in PowerPoint")
            except Exception as pptx_error:
                # If PowerPoint fails, try Word document
                try:
                    doc = Document(io.BytesIO(content_bytes))
                    text = '\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
                    if text.strip():
                        return (text, 'docx', original_base64)
                    raise ValueError("No text content found in Word document")
                except Exception as docx_error:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to extract text from Office document. PowerPoint error: {str(pptx_error)}. Word error: {str(docx_error)}"
                    )

        # PDF file
        elif content_bytes.startswith(b'%PDF'):
            try:
                pdf_reader = PdfReader(io.BytesIO(content_bytes))
                text = '\n'.join([page.extract_text() for page in pdf_reader.pages])
                if text.strip():
                    return (text, 'pdf', original_base64)
                raise ValueError("No text content found in PDF")
            except Exception as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to extract text from PDF: {str(e)}"
                )

    # If we got here, treat as plain text
    cleaned_text = content.replace('\ufffd', '').strip()
    if cleaned_text and len(cleaned_text) > 10:
        return (cleaned_text, 'txt', original_base64)

    # Last resort - return original
    return (content, 'txt', original_base64)


def extract_text_from_content(content: str) -> str:
    """
    Extract readable text from uploaded content.
    Handles:
    - Plain text
    - Word documents (.docx)
    - PowerPoint presentations (.pptx, .ppt)
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
        # Office documents (ZIP/docx/pptx)
        if content_bytes.startswith(b'PK\x03\x04'):
            # Try PowerPoint first
            try:
                prs = Presentation(io.BytesIO(content_bytes))
                text_parts = []
                for slide in prs.slides:
                    for shape in slide.shapes:
                        if hasattr(shape, "text") and shape.text.strip():
                            text_parts.append(shape.text)
                text = '\n'.join(text_parts)
                if text.strip():
                    return text
                raise ValueError("No text content found in PowerPoint")
            except Exception as pptx_error:
                # If PowerPoint fails, try Word document
                try:
                    doc = Document(io.BytesIO(content_bytes))
                    text = '\n'.join([paragraph.text for paragraph in doc.paragraphs if paragraph.text.strip()])
                    if text.strip():
                        return text
                    raise ValueError("No text content found in Word document")
                except Exception as docx_error:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Failed to extract text from Office document. PowerPoint error: {str(pptx_error)}. Word error: {str(docx_error)}"
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
    sourceText: Optional[str] = None  # Source text snippet from document
    sourcePage: Optional[int] = None  # Page number in source document


class TopicSchema(BaseModel):
    """Schema for a study topic."""
    id: str
    db_id: Optional[int] = None  # Database ID for syncing progress
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
    content: str = Field(..., min_length=10, max_length=100000000)  # 100MB limit for base64 encoded files (large PDFs)
    num_topics: int = Field(default=4, ge=1, le=100)  # Dynamic: 1-100 topics based on content size
    questions_per_topic: int = Field(default=10, ge=5, le=50)  # Increased from 20 to 50
    progressive_load: bool = Field(default=False)  # DISABLED: Generate ALL questions upfront for better UX


class AnalyzeContentRequest(BaseModel):
    """Request schema for analyzing content before creating a session."""
    content: str = Field(..., min_length=10, max_length=100000000)  # 100MB limit


class ContentAnalysisResponse(BaseModel):
    """Response schema for content analysis."""
    word_count: int
    estimated_reading_time: int  # in minutes
    recommended_topics: int
    recommended_questions: int
    complexity_score: float  # 0-1 scale
    content_summary: str


class CreateStudySessionResponse(BaseModel):
    """Response schema for created study session."""
    id: str  # UUID as string
    title: str
    studyContent: str
    fileContent: Optional[str] = None  # Original file (base64)
    fileType: Optional[str] = None  # File type: pdf, pptx, docx, txt
    extractedTopics: List[TopicSchema]
    progress: int
    topics: int
    hasFullStudy: bool
    hasSpeedRun: bool
    createdAt: Optional[int] = None  # Unix timestamp in milliseconds


@router.post("/analyze-content", response_model=ContentAnalysisResponse)
@limiter.limit("10/minute")
async def analyze_content(
    request: Request,
    data: AnalyzeContentRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Analyze content and provide recommendations for topics and questions.

    This endpoint analyzes the uploaded content and returns:
    - Word count and estimated reading time
    - Recommended number of topics
    - Recommended questions per topic
    - Complexity score

    Rate Limits:
        - 10 requests per minute per user
    """
    try:
        # Extract text from content (handles Word docs, PDFs, plain text)
        extracted_text = extract_text_from_content(data.content)

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Content is too short or empty. Please provide substantial study material (at least 50 characters)."
            )

        # Analyze content complexity
        analysis = analyze_content_complexity(extracted_text)

        # Generate a brief summary (first 200 characters)
        content_preview = extracted_text[:200].strip()
        if len(extracted_text) > 200:
            content_preview += "..."

        return ContentAnalysisResponse(
            word_count=analysis['word_count'],
            estimated_reading_time=analysis['estimated_reading_time'],
            recommended_topics=analysis['recommended_topics'],
            recommended_questions=analysis['recommended_questions'],
            complexity_score=analysis['complexity_score'],
            content_summary=content_preview
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze content: {str(e)}"
        )


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
    2. Extracts major topics using AI (dynamically based on content)
    3. Generates quiz questions for each topic
    4. Saves everything to the database

    Rate Limits:
        - 5 requests per minute per user
    """
    try:
        # Validate file size before processing
        # Note: Base64 encoding increases file size by ~33%, so 35MB raw = ~47MB encoded
        MAX_FILE_SIZE_MB = 35
        MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024
        content_size = len(data.content)

        if content_size > MAX_FILE_SIZE_BYTES:
            logger.error(f"❌ File too large: {content_size / (1024*1024):.1f}MB (max: {MAX_FILE_SIZE_MB}MB)")
            raise HTTPException(
                status_code=413,
                detail=f"File size ({content_size / (1024*1024):.1f}MB) exceeds maximum allowed size ({MAX_FILE_SIZE_MB}MB). Please use a smaller file or split it into multiple documents."
            )

        logger.info(f"📁 Processing file: {content_size / (1024*1024):.1f}MB")

        # Extract text and detect file type
        extracted_text, file_type, file_content = detect_file_type_and_extract(data.content)

        if not extracted_text or len(extracted_text.strip()) < 50:
            raise HTTPException(
                status_code=400,
                detail="Content is too short or empty. Please provide substantial study material (at least 50 characters)."
            )

        # Check document size and use chunking for large documents
        estimated_tokens = len(extracted_text) // 4  # Rough estimate: 1 token ≈ 4 characters
        logger.info(f"📊 Document size: {len(extracted_text):,} chars, ~{estimated_tokens:,} estimated tokens")

        # Claude 3.5 Haiku has 200k token context window
        # Use chunking for documents that would exceed safe limits
        # Reduced from 100k to account for prompt overhead (instructions, subtopics list, etc.)
        CHUNK_SIZE_TOKENS = 60000  # 60k tokens per chunk (~240k chars) - leaves room for 90k prompt overhead
        OVERLAP_TOKENS = 5000  # 5k token overlap between chunks for context preservation

        chunk_size_chars = CHUNK_SIZE_TOKENS * 4
        overlap_chars = OVERLAP_TOKENS * 4

        # Split document into chunks if necessary
        document_chunks = []
        if estimated_tokens > CHUNK_SIZE_TOKENS:
            logger.info(f"📚 Large document detected. Splitting into chunks of ~{CHUNK_SIZE_TOKENS:,} tokens with {OVERLAP_TOKENS:,} token overlap...")

            # Split into overlapping chunks
            current_pos = 0
            chunk_num = 1
            while current_pos < len(extracted_text):
                end_pos = min(current_pos + chunk_size_chars, len(extracted_text))
                chunk = extracted_text[current_pos:end_pos]
                document_chunks.append(chunk)
                logger.info(f"  📄 Chunk {chunk_num}: {len(chunk):,} chars (~{len(chunk)//4:,} tokens)")

                # Move forward with overlap
                current_pos = end_pos - overlap_chars
                if current_pos >= len(extracted_text) - overlap_chars:
                    break  # Last chunk
                chunk_num += 1

            logger.info(f"✅ Created {len(document_chunks)} chunks for processing")
        else:
            # Document fits in one chunk
            document_chunks = [extracted_text]
            logger.info(f"✅ Document fits in single chunk, no splitting needed")

        # Analyze content to get smart recommendations (use first chunk for analysis)
        analysis = analyze_content_complexity(document_chunks[0])

        # Progressive loading: For large documents (>5000 words), start with fewer topics
        is_large_doc = analysis['word_count'] > 5000
        initial_topics = data.num_topics

        if data.progressive_load and is_large_doc:
            # Start with only 2-3 categories and 4-6 subtopics for quick initial load
            initial_topics = min(6, data.num_topics)
            logger.info(f"📚 Large document detected ({analysis['word_count']} words). Using progressive load: {initial_topics} initial topics")

        # Calculate number of categories based on topics to generate
        # For 2-5 topics: 2 categories
        # For 6-10 topics: 3 categories
        # For 11-15 topics: 4 categories
        # For 16-20 topics: 5 categories
        num_categories = max(2, min(5, (initial_topics + 3) // 4))
        subtopics_per_category = max(1, initial_topics // num_categories)  # Allow single subtopic per category

        # Initialize AI client (prefer Claude Haiku for speed, fallback to DeepSeek)
        use_claude = bool(settings.ANTHROPIC_API_KEY)

        if use_claude:
            anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
            logger.info("🚀 Using Claude Haiku for fast generation")
        else:
            deepseek_client = OpenAI(
                api_key=settings.DEEPSEEK_API_KEY,
                base_url="https://api.deepseek.com"
            )
            logger.info("⏱️ Using DeepSeek (consider adding ANTHROPIC_API_KEY for 10x speed)")

        # Step 1: Extract topics from content with hierarchical structure (DYNAMIC PROMPT)
        topics_prompt = f"""Analyze this study material and organize it into a hierarchical structure with categories and subtopics.

Study Material:
{extracted_text}

Content Analysis:
- Word Count: {analysis['word_count']}
- Complexity Score: {analysis['complexity_score']}
- Estimated Reading Time: {analysis['estimated_reading_time']} minutes

Requirements:
1. Create approximately {num_categories} major categories that organize the content at a high level
2. Within each category, identify as many specific subtopics as needed to cover the material (aim for {subtopics_per_category} or more per category)
3. Each subtopic can support varying numbers of questions (3-20 based on content depth)
4. Provide clear titles and brief descriptions for both categories and subtopics
5. Organize logically (foundational concepts first, building to advanced topics)
6. Create AT LEAST {initial_topics} total subtopics across all categories (focus on the most important topics first)
7. For complex content, create more detailed subtopics; for simpler content, keep subtopics broader
8. Ensure subtopics are distinct and cover different aspects of the material
9. Focus on core concepts and foundational topics first

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
        if use_claude:
            topics_response = anthropic_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=2048,
                temperature=0.7,
                messages=[{"role": "user", "content": topics_prompt}]
            )
            topics_text = topics_response.content[0].text
        else:
            topics_response = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                max_tokens=2048,
                temperature=0.7,
                messages=[{"role": "user", "content": topics_prompt}]
            )
            topics_text = topics_response.choices[0].message.content

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

        # Generate a smart title if the provided title is generic (contains "Study Session" and a date)
        session_title = data.title
        if "Study Session" in session_title and any(char.isdigit() for char in session_title):
            # Use the first category as the title for better organization
            if categories_data and len(categories_data) > 0:
                first_category = categories_data[0]["title"]
                # If multiple categories, add a subtitle
                if len(categories_data) > 1:
                    session_title = f"{first_category} + {len(categories_data) - 1} more"
                else:
                    session_title = first_category

        # Step 2: Create study session
        study_session = StudySession(
            user_id=current_user.id,
            title=session_title,
            topic=categories_data[0]["title"] if categories_data else "General Study",
            study_content=extracted_text,  # Store the extracted text
            file_content=file_content,  # Store original file (base64)
            file_type=file_type,  # Store file type (pdf, pptx, docx, txt)
            topics_count=total_subtopics,
            has_full_study=True,
            has_speed_run=True,
            status="in_progress"
        )
        db.add(study_session)
        db.flush()  # Get the session ID

        # Step 3: Create categories and subtopics first, then batch generate ALL questions
        all_topics = []
        subtopic_map = {}  # Map to track subtopics for batch question assignment
        overall_idx = 0

        # First pass: Create all categories and subtopics in database
        for cat_idx, category_data in enumerate(categories_data):
            # Create category topic in database
            category_topic = Topic(
                study_session_id=study_session.id,
                title=category_data["title"],
                description=category_data.get("description", ""),
                order_index=cat_idx,
                is_category=True,
                parent_topic_id=None
            )
            db.add(category_topic)
            db.flush()

            # Create category schema
            category_schema = TopicSchema(
                id=f"category-{cat_idx+1}",
                db_id=category_topic.id,
                title=category_data["title"],
                description=category_data.get("description", ""),
                isCategory=True,
                parentTopicId=None,
                questions=[],
                subtopics=[]
            )

            # Create all subtopics for this category
            subtopics_data = category_data.get("subtopics", [])
            for sub_idx, subtopic_data in enumerate(subtopics_data):
                subtopic = Topic(
                    study_session_id=study_session.id,
                    parent_topic_id=category_topic.id,
                    title=subtopic_data["title"],
                    description=subtopic_data.get("description", ""),
                    order_index=sub_idx,
                    is_category=False
                )
                db.add(subtopic)
                db.flush()

                # Track subtopic for later question assignment
                subtopic_key = f"{cat_idx}-{sub_idx}"
                subtopic_map[subtopic_key] = {
                    "topic": subtopic,
                    "category_data": category_data,
                    "subtopic_data": subtopic_data,
                    "schema": TopicSchema(
                        id=f"subtopic-{cat_idx+1}-{sub_idx+1}",
                        db_id=subtopic.id,
                        title=subtopic_data["title"],
                        description=subtopic_data.get("description", ""),
                        questions=[],
                        completed=False,
                        score=None,
                        currentQuestionIndex=0,
                        isCategory=False,
                        parentTopicId=f"category-{cat_idx+1}",
                        subtopics=[]
                    ),
                    "category_schema": category_schema
                }
                overall_idx += 1

            all_topics.append(category_schema)

        # Step 4: Generate questions by processing each document chunk
        # For large documents, this processes multiple chunks separately and merges results
        logger.info(f"📡 Processing {len(document_chunks)} document chunk(s) to generate questions...")

        # Generate questions for ALL subtopics during initial creation
        # This ensures maximum question coverage from the uploaded document

        # Get list of all subtopic keys
        all_subtopic_keys = list(subtopic_map.keys())

        logger.info(f"📚 Generating questions for ALL {len(all_subtopic_keys)} subtopics to maximize coverage")
        logger.info(f"  Subtopics: {all_subtopic_keys}")

        # BATCH SUBTOPICS: Process in groups to avoid AI refusing due to response size
        # With 6 subtopics per batch, max ~180 questions per request (6 * 30) - manageable for AI
        SUBTOPICS_PER_BATCH = 6
        subtopic_batches = []

        # Split subtopics into batches
        for i in range(0, len(all_subtopic_keys), SUBTOPICS_PER_BATCH):
            batch_keys = all_subtopic_keys[i:i + SUBTOPICS_PER_BATCH]
            subtopic_batches.append(batch_keys)

        logger.info(f"📦 Split {len(all_subtopic_keys)} subtopics into {len(subtopic_batches)} batches of up to {SUBTOPICS_PER_BATCH}")

        # Collect questions from all chunks
        all_chunk_questions = {}  # {subtopic_key: [questions]}

        # Process each chunk with batched subtopics
        for chunk_idx, chunk_text in enumerate(document_chunks, 1):
            logger.info(f"📄 Processing chunk {chunk_idx}/{len(document_chunks)}...")

            # Process each batch of subtopics for this chunk
            for batch_num, batch_keys in enumerate(subtopic_batches, 1):
                logger.info(f"  📦 Batch {batch_num}/{len(subtopic_batches)}: Processing {len(batch_keys)} subtopics")

                # Build subtopics list for this batch only
                subtopics_list = ""
                for subtopic_key in batch_keys:
                    subtopic_info = subtopic_map[subtopic_key]
                    category_data = subtopic_info["category_data"]
                    subtopic_data = subtopic_info["subtopic_data"]
                    cat_idx, sub_idx = map(int, subtopic_key.split('-'))

                    subtopics_list += f"\n[Subtopic {cat_idx}-{sub_idx}]\n"
                    subtopics_list += f"Category: {category_data['title']}\n"
                    subtopics_list += f"Subtopic: {subtopic_data['title']}\n"
                    subtopics_list += f"Description: {subtopic_data.get('description', '')}\n"

                # Build prompt for this chunk and subtopic batch
                batch_prompt = f"""Generate TRICKY and CHALLENGING multiple-choice questions for EACH of the following subtopics from the study material.

IMPORTANT: Generate MAXIMUM questions per subtopic based on content depth:
- Simple subtopic with limited content: 5-10 questions minimum
- Moderate subtopic with decent coverage: 10-15 questions
- Complex subtopic with extensive material: 15-30 questions
- Generate questions for ALL listed subtopics below
- GOAL: Create the MAXIMUM number of quality, non-duplicate questions the content supports
- Extract every testable concept from the material
- Cover different aspects and difficulty levels

DIFFICULTY LEVEL: CHALLENGING
- Make questions that require DEEP analysis and critical thinking
- Use tricky distractors that would fool someone who only skimmed the material
- Test subtle distinctions and nuanced understanding
- Require application of concepts, not just memorization
- Include "all of the above" or "none of the above" when appropriate
- Use comparative questions (e.g., "Which is the PRIMARY..." "What is the MAIN difference...")
- Create questions that test WHY and HOW, not just WHAT

Study Material (Chunk {chunk_idx} of {len(document_chunks)}):
{chunk_text}

SUBTOPICS TO COVER ({len(batch_keys)} subtopics in this batch):
{subtopics_list}

Requirements:
1. Generate MAXIMUM questions for EACH subtopic (5-30 questions based on content depth)
2. NO DUPLICATES - each question must test a unique concept
3. Each question must have exactly 4 PLAUSIBLE options (all should seem correct to someone who doesn't understand deeply)
4. Questions should be TRICKY and CHALLENGING - test deep understanding and critical thinking
5. Distractors should be subtle and based on common misconceptions
6. Provide detailed explanations that explain why the correct answer is right AND why the distractors are wrong
7. For EACH question, include the EXACT source text from the study material with FULL CONTEXT
8. Source text should include the complete sentence(s) or paragraph that contains the answer
9. Include enough surrounding context (2-4 sentences) so students can easily locate it in their document
10. The sourceText must be VERBATIM from the study material - copy it EXACTLY as it appears
11. Return ONLY valid JSON

Return in this EXACT format (use subtopic keys like "0-0", "0-1", "1-0" etc):
{{
  "subtopics": {{
    "0-0": {{
      "questions": [
        {{
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Why this answer is correct",
          "sourceText": "The complete sentence or paragraph from the study material with context."
        }}
      ]
    }},
    "0-1": {{
      "questions": [...]
    }}
  }}
}}"""

                # Make API call for this batch
                prompt_tokens = len(batch_prompt) // 4  # Rough estimate
                logger.info(f"    📊 Batch {batch_num} prompt length: {len(batch_prompt):,} characters (~{prompt_tokens:,} tokens)")

                # Claude 3.5 Haiku has 200k context window, but we should stay well under that
                MAX_PROMPT_TOKENS = 150000
                if prompt_tokens > MAX_PROMPT_TOKENS:
                    logger.error(f"❌ Chunk {chunk_idx} Batch {batch_num} prompt too large: {prompt_tokens:,} tokens (max: {MAX_PROMPT_TOKENS:,})")
                    raise HTTPException(
                        status_code=413,
                        detail=f"Document chunk {chunk_idx} batch {batch_num} is too large for processing (~{prompt_tokens:,} tokens). The document may need to be split into smaller files."
                    )

                try:
                    if use_claude:
                        batch_response = anthropic_client.messages.create(
                            model="claude-3-5-haiku-20241022",
                            max_tokens=8192,  # Maximum output tokens for Claude 3.5 Haiku
                            temperature=0.7,
                            messages=[{"role": "user", "content": batch_prompt}]
                        )
                        batch_text = batch_response.content[0].text
                    else:
                        batch_response = deepseek_client.chat.completions.create(
                            model="deepseek-chat",
                            max_tokens=32000,  # Increased from 16000 to allow MORE questions
                            temperature=0.7,
                            messages=[{"role": "user", "content": batch_prompt}]
                        )
                        batch_text = batch_response.choices[0].message.content
                except Exception as api_error:
                    logger.error(f"❌ AI API call failed for chunk {chunk_idx} batch {batch_num}: {type(api_error).__name__}: {str(api_error)}")
                    # Check if it's a context length error
                    error_msg = str(api_error).lower()
                    if any(keyword in error_msg for keyword in ['context', 'token', 'too long', 'maximum', 'limit']):
                        raise HTTPException(
                            status_code=413,
                            detail=f"Chunk {chunk_idx} batch {batch_num} is too large for AI processing. Try using a smaller document."
                        )
                    else:
                        raise HTTPException(
                            status_code=500,
                            detail=f"AI API error on chunk {chunk_idx} batch {batch_num}: {str(api_error)}"
                        )

                # Log AI response details
                logger.info(f"    📨 Batch {batch_num} - Received AI response, length: {len(batch_text)} characters")

                # Parse batch response with detailed error logging
                try:
                    start_idx = batch_text.find('{')
                    end_idx = batch_text.rfind('}') + 1

                    if start_idx == -1 or end_idx == 0:
                        logger.error(f"❌ Chunk {chunk_idx} Batch {batch_num} - No JSON found in AI response")
                        logger.error(f"❌ AI returned: {batch_text[:500]}...")  # Log first 500 chars
                        chunk_questions = {}
                    else:
                        json_str = batch_text[start_idx:end_idx]
                        batch_json = json.loads(json_str)
                        chunk_questions = batch_json.get("subtopics", {})

                        logger.info(f"    ✅ Batch {batch_num} - Parsed {len(chunk_questions)} subtopics")
                        for key in chunk_questions.keys():
                            q_count = len(chunk_questions[key].get("questions", []))
                            if q_count > 0:
                                logger.info(f"      - Subtopic {key}: {q_count} questions")

                except (json.JSONDecodeError, KeyError, ValueError) as e:
                    logger.error(f"❌ Chunk {chunk_idx} Batch {batch_num} - Failed to parse questions: {e}")
                    chunk_questions = {}

                # Merge questions from this batch into all_chunk_questions
                for subtopic_key, subtopic_data in chunk_questions.items():
                    questions = subtopic_data.get("questions", [])
                    if questions:
                        if subtopic_key not in all_chunk_questions:
                            all_chunk_questions[subtopic_key] = []
                        all_chunk_questions[subtopic_key].extend(questions)
                        logger.debug(f"    🔄 Added {len(questions)} questions for subtopic {subtopic_key}")

        # Log merged results
        logger.info(f"🎯 Merging complete - Total subtopics with questions: {len(all_chunk_questions)}")
        for key, questions in all_chunk_questions.items():
            logger.info(f"  - Subtopic {key}: {len(questions)} total questions from all chunks")

        # Use merged questions as the final subtopics_questions
        subtopics_questions = {key: {"questions": questions} for key, questions in all_chunk_questions.items()}

        # Step 5: Assign questions to subtopics
        question_counter = 0
        logger.info(f"🔄 Assigning questions to {len(subtopic_map)} subtopics...")
        logger.debug(f"🗂️ Subtopic keys in map: {list(subtopic_map.keys())}")
        logger.debug(f"🗂️ Subtopic keys in AI response: {list(subtopics_questions.keys())}")

        for subtopic_key, subtopic_info in subtopic_map.items():
            subtopic = subtopic_info["topic"]
            subtopic_schema = subtopic_info["schema"]
            category_schema = subtopic_info["category_schema"]

            # Get questions for this subtopic from batch response
            questions_data = subtopics_questions.get(subtopic_key, {}).get("questions", [])

            # Skip if no questions generated
            if not questions_data:
                # Expected to have questions for all subtopics
                logger.warning(f"⚠️ No questions generated for subtopic '{subtopic_key}' ('{subtopic.title}') - SKIPPING (may lack relevant content in document)")
                continue
            else:
                logger.info(f"✅ Found {len(questions_data)} questions for subtopic '{subtopic_key}' ('{subtopic.title}')")

            # Save ALL questions to database (no limit - variable per topic)
            # Get existing questions for this topic to check for duplicates
            existing_questions = db.query(Question).filter(Question.topic_id == subtopic.id).all()
            existing_question_texts = {q.question.lower().strip() for q in existing_questions}

            questions_list = []
            duplicates_skipped = 0

            for q_idx, q_data in enumerate(questions_data):
                question_text = q_data.get("question", f"Question {q_idx+1}")

                # Check for duplicate questions (case-insensitive)
                if question_text.lower().strip() in existing_question_texts:
                    logger.debug(f"⏭️ Skipping duplicate question: {question_text[:50]}...")
                    duplicates_skipped += 1
                    continue

                # Ensure options is a list
                options = q_data.get("options", ["A", "B", "C", "D"])
                if isinstance(options, str):
                    try:
                        options = json.loads(options)
                    except json.JSONDecodeError:
                        options = ["Option A", "Option B", "Option C", "Option D"]

                question = Question(
                    topic_id=subtopic.id,
                    question=question_text,
                    options=options,
                    correct_answer=q_data.get("correctAnswer", 0),
                    explanation=q_data.get("explanation", ""),
                    source_text=q_data.get("sourceText"),
                    order_index=len(questions_list)  # Use actual index in list
                )
                db.add(question)

                # Add to existing set to catch duplicates within this batch
                existing_question_texts.add(question_text.lower().strip())

                questions_list.append(QuestionSchema(
                    id=f"q-{question_counter}",
                    question=q_data.get("question", f"Question {q_idx+1}"),
                    options=options,
                    correctAnswer=q_data.get("correctAnswer", 0),
                    explanation=q_data.get("explanation", ""),
                    sourceText=q_data.get("sourceText")
                ))
                question_counter += 1

            # Log duplicate detection results
            if duplicates_skipped > 0:
                logger.info(f"  ⏭️ Skipped {duplicates_skipped} duplicate questions for '{subtopic.title}'")

            # Update subtopic schema with questions
            subtopic_schema.questions = questions_list
            category_schema.subtopics.append(subtopic_schema)

        # Validate that questions were generated for a reasonable number of subtopics
        subtopics_with_questions = len([k for k, v in subtopics_questions.items() if v.get("questions")])
        total_subtopics = len(subtopic_map)

        if question_counter == 0:
            logger.error("❌ FATAL: No questions were generated for any subtopic! AI generation completely failed.")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail="Failed to generate questions. The AI did not return any valid questions. This may be due to document format or content issues. Please try:\n1. A different document\n2. Splitting the document into smaller files\n3. Converting to PDF format if using Word/PowerPoint"
            )

        # Enforce minimum question count for good study sessions
        MIN_QUESTIONS_REQUIRED = 20  # At least 20 questions for a meaningful study session
        if question_counter < MIN_QUESTIONS_REQUIRED:
            logger.error(f"❌ Only {question_counter} questions generated (minimum: {MIN_QUESTIONS_REQUIRED})")
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Not enough questions generated ({question_counter}/{MIN_QUESTIONS_REQUIRED} required). The document may be too short, too complex, or in an unsupported format. Please try:\n1. A longer or more detailed document\n2. Converting to PDF format\n3. Checking that the content is educational material"
            )

        # Log coverage statistics
        coverage_percent = (subtopics_with_questions / total_subtopics * 100) if total_subtopics > 0 else 0
        logger.info(f"📊 Question generation coverage: {subtopics_with_questions}/{total_subtopics} subtopics ({coverage_percent:.1f}%)")
        logger.info(f"✅ Successfully generated {question_counter} total questions across {subtopics_with_questions} subtopics")

        # Commit all changes
        db.commit()
        db.refresh(study_session)

        return CreateStudySessionResponse(
            id=str(study_session.id),  # Convert UUID to string
            title=study_session.title,
            studyContent=study_session.study_content,
            fileContent=study_session.file_content,
            fileType=study_session.file_type,
            extractedTopics=all_topics,
            progress=0,
            topics=len(all_topics),
            hasFullStudy=True,
            hasSpeedRun=True,
            createdAt=int(study_session.created_at.timestamp() * 1000) if study_session.created_at else None
        )

    except HTTPException:
        # Re-raise HTTP exceptions (like 413 for file size)
        db.rollback()
        raise
    except Exception as api_error:
        logger.error(f"❌ Error in create_study_session_with_ai: {type(api_error).__name__}: {str(api_error)}")
        logger.error(f"❌ Full error: {repr(api_error)}", exc_info=True)
        if "openai" in str(type(api_error).__module__):
            db.rollback()
            raise HTTPException(status_code=500, detail=f"DeepSeek API error: {str(api_error)}")
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create study session: {str(api_error)}")


@router.get("/{session_id}", response_model=CreateStudySessionResponse)
async def get_study_session(
    session_id: str,  # UUID as string
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Get a study session with all its topics and questions.

    Returns the complete session data including the hierarchical topic structure
    with all questions, allowing users to resume their study progress.
    """
    # Validate UUID format
    try:
        uuid_obj = uuid.UUID(session_id)
    except ValueError:
        logger.error(f"❌ Invalid session ID format: {session_id} (expected UUID)")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session ID format. Expected UUID, got: '{session_id}'. This may be an old session that is no longer compatible."
        )

    # Fetch session with eager loading of topics and questions
    session = db.query(StudySession).filter(
        StudySession.id == uuid_obj,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    # Fetch all topics for this session
    all_topics = db.query(Topic).filter(
        Topic.study_session_id == uuid_obj
    ).order_by(Topic.order_index).all()

    # Build hierarchical structure
    categories = [t for t in all_topics if t.is_category and t.parent_topic_id is None]

    result_topics = []

    for cat_idx, category in enumerate(categories):
        # Get subtopics for this category
        subtopics = [t for t in all_topics if t.parent_topic_id == category.id]

        category_schema = TopicSchema(
            id=f"category-{cat_idx+1}",
            db_id=category.id,  # Include database ID
            title=category.title,
            description=category.description or "",
            isCategory=True,
            parentTopicId=None,
            questions=[],
            subtopics=[]
        )

        for sub_idx, subtopic in enumerate(subtopics):
            # Fetch questions for this subtopic
            questions = db.query(Question).filter(
                Question.topic_id == subtopic.id
            ).order_by(Question.order_index).all()

            questions_list = [
                QuestionSchema(
                    id=f"topic-{sub_idx+1}-q{q.order_index+1}",
                    question=q.question,
                    options=q.options,
                    correctAnswer=q.correct_answer,
                    explanation=q.explanation,
                    sourceText=q.source_text,
                    sourcePage=q.source_page
                )
                for q in questions
            ]

            subtopic_schema = TopicSchema(
                id=f"subtopic-{cat_idx+1}-{sub_idx+1}",
                db_id=subtopic.id,  # Include database ID for progress sync
                title=subtopic.title,
                description=subtopic.description or "",
                questions=questions_list,
                completed=subtopic.completed or False,
                score=subtopic.score,
                currentQuestionIndex=subtopic.current_question_index or 0,
                isCategory=False,
                parentTopicId=f"category-{cat_idx+1}",
                subtopics=[]
            )
            category_schema.subtopics.append(subtopic_schema)

        result_topics.append(category_schema)

    # Calculate progress
    total_subtopics = sum(len(cat.subtopics) for cat in result_topics)
    completed_subtopics = sum(
        sum(1 for st in cat.subtopics if st.completed)
        for cat in result_topics
    )
    progress = int((completed_subtopics / total_subtopics * 100) if total_subtopics > 0 else 0)

    return CreateStudySessionResponse(
        id=str(session.id),  # Convert UUID to string
        title=session.title,
        studyContent=session.study_content or "",
        fileContent=session.file_content,
        fileType=session.file_type,
        extractedTopics=result_topics,
        progress=progress,
        topics=total_subtopics,
        hasFullStudy=session.has_full_study or False,
        hasSpeedRun=session.has_speed_run or False,
        createdAt=int(session.created_at.timestamp() * 1000) if session.created_at else None
    )


@router.post("/{session_id}/generate-more-questions")
async def generate_more_questions(
    session_id: str,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Generate questions for remaining subtopics that don't have questions yet.

    This implements progressive loading - initially only first few subtopics have questions,
    calling this endpoint generates questions for the next batch.
    """
    logger.info(f"📚 Generating more questions for session {session_id}")

    # Validate UUID
    try:
        uuid_obj = uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid session ID format")

    # Fetch session
    session = db.query(StudySession).filter(
        StudySession.id == uuid_obj,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    # Get all topics for this session
    all_topics = db.query(Topic).filter(
        Topic.study_session_id == uuid_obj
    ).order_by(Topic.order_index).all()

    # Find subtopics without questions
    subtopics_without_questions = []
    for topic in all_topics:
        if not topic.is_category:  # Only check actual subtopics
            question_count = db.query(Question).filter(Question.topic_id == topic.id).count()
            if question_count == 0:
                subtopics_without_questions.append(topic)

    if not subtopics_without_questions:
        logger.info(f"✅ All subtopics already have questions for session {session_id}")
        return {"message": "All subtopics already have questions", "generated": 0}

    logger.info(f"📊 Found {len(subtopics_without_questions)} subtopics without questions")

    # Generate questions for next batch (first 3 without questions)
    BATCH_SIZE = 3
    next_batch = subtopics_without_questions[:BATCH_SIZE]

    logger.info(f"🔄 Generating questions for next {len(next_batch)} subtopics...")

    # Extract text from stored file content
    if not session.file_content:
        raise HTTPException(status_code=400, detail="No file content available for this session")

    extracted_text, _, _ = detect_file_type_and_extract(session.file_content)

    # Initialize AI client
    use_claude = bool(settings.ANTHROPIC_API_KEY)
    if use_claude:
        anthropic_client = Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        logger.info("🚀 Using Claude Haiku for question generation")
    else:
        deepseek_client = OpenAI(
            api_key=settings.DEEPSEEK_API_KEY,
            base_url="https://api.deepseek.com"
        )
        logger.info("⏱️ Using DeepSeek")

    # Build prompt for next batch
    subtopics_list = ""
    subtopic_map = {}

    # Get parent categories to build proper context
    categories = db.query(Topic).filter(
        Topic.study_session_id == uuid_obj,
        Topic.is_category == True,
        Topic.parent_topic_id == None
    ).all()

    for topic in next_batch:
        # Find parent category
        parent = db.query(Topic).filter(Topic.id == topic.parent_topic_id).first()
        category_title = parent.title if parent else "General"

        # Create mapping key (we'll use topic db_id)
        key = f"topic-{topic.id}"
        subtopic_map[key] = topic

        subtopics_list += f"\n[Subtopic {key}]\n"
        subtopics_list += f"Category: {category_title}\n"
        subtopics_list += f"Subtopic: {topic.title}\n"
        subtopics_list += f"Description: {topic.description or ''}\n"

    # Build prompt
    batch_prompt = f"""Generate TRICKY and CHALLENGING multiple-choice questions for EACH of the following subtopics from the study material.

IMPORTANT: Generate a VARIABLE number of questions per subtopic based on content depth:
- Simple subtopic with limited content: 3-5 questions
- Moderate subtopic with decent coverage: 6-10 questions
- Complex subtopic with extensive material: 10-20 questions
- Generate questions for ALL listed subtopics below
- The goal is to create AS MANY quality questions as the content supports

DIFFICULTY LEVEL: CHALLENGING
- Make questions that require DEEP analysis and critical thinking
- Use tricky distractors that would fool someone who only skimmed the material
- Test subtle distinctions and nuanced understanding
- Require application of concepts, not just memorization
- Include "all of the above" or "none of the above" when appropriate
- Use comparative questions (e.g., "Which is the PRIMARY..." "What is the MAIN difference...")
- Create questions that test WHY and HOW, not just WHAT

Study Material:
{extracted_text[:400000]}

SUBTOPICS TO COVER:
{subtopics_list}

Requirements:
1. Generate as many questions as appropriate for EACH subtopic (3-20 questions based on content depth)
2. Prioritize quality over quantity - each question should test real understanding
3. Each question must have exactly 4 PLAUSIBLE options (all should seem correct to someone who doesn't understand deeply)
4. Questions should be TRICKY and CHALLENGING - test deep understanding and critical thinking
5. Distractors should be subtle and based on common misconceptions
6. Provide detailed explanations that explain why the correct answer is right AND why the distractors are wrong
7. For EACH question, include the EXACT source text from the study material with FULL CONTEXT
8. Source text should include the complete sentence(s) or paragraph that contains the answer
9. Include enough surrounding context (2-4 sentences) so students can easily locate it in their document
10. The sourceText must be VERBATIM from the study material - copy it EXACTLY as it appears
11. Return ONLY valid JSON

Return in this EXACT format (use subtopic keys like "topic-123", "topic-456" etc):
{{
  "subtopics": {{
    "topic-123": {{
      "questions": [
        {{
          "question": "Question text?",
          "options": ["Option A", "Option B", "Option C", "Option D"],
          "correctAnswer": 0,
          "explanation": "Why this answer is correct",
          "sourceText": "The complete sentence or paragraph from the study material with context."
        }}
      ]
    }},
    "topic-456": {{
      "questions": [...]
    }}
  }}
}}"""

    # Make API call
    logger.info(f"📊 Prompt length: {len(batch_prompt):,} characters")

    try:
        if use_claude:
            batch_response = anthropic_client.messages.create(
                model="claude-3-5-haiku-20241022",
                max_tokens=8192,
                temperature=0.7,
                messages=[{"role": "user", "content": batch_prompt}]
            )
            batch_text = batch_response.content[0].text
        else:
            batch_response = deepseek_client.chat.completions.create(
                model="deepseek-chat",
                max_tokens=16000,
                temperature=0.7,
                messages=[{"role": "user", "content": batch_prompt}]
            )
            batch_text = batch_response.choices[0].message.content
    except Exception as api_error:
        logger.error(f"❌ AI API call failed: {type(api_error).__name__}: {str(api_error)}")
        raise HTTPException(status_code=500, detail=f"AI API error: {str(api_error)}")

    # Parse response
    logger.info(f"📨 Received AI response, length: {len(batch_text)} characters")

    try:
        start_idx = batch_text.find('{')
        end_idx = batch_text.rfind('}') + 1

        if start_idx == -1 or end_idx == 0:
            logger.error(f"❌ No JSON found in AI response")
            raise HTTPException(status_code=500, detail="Failed to parse AI response")

        json_str = batch_text[start_idx:end_idx]
        batch_json = json.loads(json_str)
        subtopics_questions = batch_json.get("subtopics", {})

        logger.info(f"✅ Parsed {len(subtopics_questions)} subtopics from AI response")
        for key in subtopics_questions.keys():
            q_count = len(subtopics_questions[key].get("questions", []))
            logger.info(f"  - Subtopic {key}: {q_count} questions")

    except (json.JSONDecodeError, KeyError, ValueError) as e:
        logger.error(f"❌ Failed to parse questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response: {str(e)}")

    # Save questions to database
    total_questions_generated = 0

    for key, topic in subtopic_map.items():
        questions_data = subtopics_questions.get(key, {}).get("questions", [])

        if not questions_data:
            logger.warning(f"⚠️ No questions generated for subtopic '{key}' ('{topic.title}')")
            continue

        logger.info(f"✅ Saving {len(questions_data)} questions for subtopic '{topic.title}'")

        for q_idx, q_data in enumerate(questions_data):
            # Ensure options is a list
            options = q_data.get("options", ["A", "B", "C", "D"])
            if isinstance(options, str):
                try:
                    options = json.loads(options)
                except json.JSONDecodeError:
                    options = ["Option A", "Option B", "Option C", "Option D"]

            question = Question(
                topic_id=topic.id,
                question=q_data.get("question", f"Question {q_idx+1}"),
                options=options,
                correct_answer=q_data.get("correctAnswer", 0),
                explanation=q_data.get("explanation", ""),
                source_text=q_data.get("sourceText"),
                order_index=q_idx
            )
            db.add(question)
            total_questions_generated += 1

    # Commit to database
    try:
        db.commit()
        logger.info(f"✅ Successfully saved {total_questions_generated} questions to database")
    except Exception as e:
        db.rollback()
        logger.error(f"❌ Failed to save questions: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to save questions: {str(e)}")

    # Count remaining subtopics without questions
    remaining_count = len(subtopics_without_questions) - len(next_batch)

    logger.info(f"✅ Generated {total_questions_generated} questions for {len(next_batch)} subtopics")
    logger.info(f"📊 Remaining subtopics without questions: {remaining_count}")

    return {
        "message": f"Successfully generated questions for {len(next_batch)} subtopics",
        "generated": len(next_batch),
        "totalQuestions": total_questions_generated,
        "remaining": remaining_count,
        "hasMore": remaining_count > 0
    }


@router.delete("/{session_id}")
async def delete_study_session(
    session_id: str,  # UUID as string
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Delete a study session and all its associated data.

    This will cascade delete all topics and questions associated with the session.
    """
    # Validate UUID format
    try:
        uuid_obj = uuid.UUID(session_id)
    except ValueError:
        logger.error(f"❌ Invalid session ID format: {session_id} (expected UUID)")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session ID format. Expected UUID, got: '{session_id}'."
        )

    session = db.query(StudySession).filter(
        StudySession.id == uuid_obj,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    db.delete(session)
    db.commit()

    return {"message": "Study session deleted successfully", "id": session_id}


@router.patch("/{session_id}/archive")
async def archive_study_session(
    session_id: str,  # UUID as string
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Archive a study session.

    Changes the session status to 'archived'.
    """
    # Validate UUID format
    try:
        uuid_obj = uuid.UUID(session_id)
    except ValueError:
        logger.error(f"❌ Invalid session ID format: {session_id} (expected UUID)")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session ID format. Expected UUID, got: '{session_id}'."
        )

    session = db.query(StudySession).filter(
        StudySession.id == uuid_obj,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    session.status = "archived"
    db.commit()
    db.refresh(session)

    return {"message": "Study session archived successfully", "id": session_id}


class UpdateTopicProgressRequest(BaseModel):
    """Request schema for updating topic progress."""
    score: int = Field(..., ge=0, le=100)  # Score as percentage 0-100
    current_question_index: int = Field(..., ge=0)
    completed: bool = False


class UpdateUserXPRequest(BaseModel):
    """Request schema for updating user XP."""
    xp_to_add: int = Field(..., ge=0, le=1000)  # XP to add (capped at 1000 per call)


@router.patch("/{session_id}/topics/{topic_id}/progress")
@limiter.limit("60/minute")
async def update_topic_progress(
    request: Request,
    session_id: str,
    topic_id: int,  # Database topic ID
    data: UpdateTopicProgressRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Update topic progress (score, current question index, completion status).

    This endpoint is called after each answer to persist user progress.

    Rate Limits:
        - 60 requests per minute per user
    """
    # Validate UUID format
    try:
        uuid_obj = uuid.UUID(session_id)
    except ValueError:
        logger.error(f"❌ Invalid session ID format: {session_id} (expected UUID)")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid session ID format. Expected UUID, got: '{session_id}'."
        )

    # Verify session belongs to user
    session = db.query(StudySession).filter(
        StudySession.id == uuid_obj,
        StudySession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Study session not found")

    # Find the topic
    topic = db.query(Topic).filter(
        Topic.id == topic_id,
        Topic.study_session_id == uuid_obj
    ).first()

    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")

    # Update topic progress
    topic.score = data.score
    topic.current_question_index = data.current_question_index
    topic.completed = data.completed

    # Update session progress (percentage of completed subtopics)
    all_topics = db.query(Topic).filter(
        Topic.study_session_id == uuid_obj,
        Topic.is_category == False  # Only count leaf topics
    ).all()

    completed_topics = sum(1 for t in all_topics if t.completed)
    total_topics = len(all_topics)
    session.progress = int((completed_topics / total_topics * 100) if total_topics > 0 else 0)

    db.commit()
    db.refresh(topic)

    return {
        "message": "Topic progress updated successfully",
        "topic_id": topic_id,
        "score": topic.score,
        "current_question_index": topic.current_question_index,
        "completed": topic.completed,
        "session_progress": session.progress
    }


@router.patch("/user/xp")
@limiter.limit("100/minute")
async def update_user_xp(
    request: Request,
    data: UpdateUserXPRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    """
    Add XP to the current user's total.

    This endpoint is called after each correct answer.

    Rate Limits:
        - 100 requests per minute per user
    """
    # Update user XP
    current_user.xp += data.xp_to_add
    current_user.updated_at = datetime.utcnow()

    # Calculate level (simple formula: level = floor(xp / 100) + 1)
    # Every 100 XP = 1 level
    current_user.level = (current_user.xp // 100) + 1

    db.commit()
    db.refresh(current_user)

    return {
        "message": "XP updated successfully",
        "xp": current_user.xp,
        "xp_added": data.xp_to_add,
        "level": current_user.level
    }
