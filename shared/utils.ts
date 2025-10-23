import { TranscriptionWord, AudioEdit, TranscriptionSegment } from './types';

/**
 * Validates audio file type and size
 */
export function validateAudioFile(file: File): { isValid: boolean; error?: string } {
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/m4a', 'audio/aac'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (!allowedTypes.includes(file.type)) {
    return {
      isValid: false,
      error: 'Please select a valid audio file (MP3, WAV, M4A, AAC)'
    };
  }

  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size must be less than 50MB'
    };
  }

  return { isValid: true };
}

/**
 * Compares original transcription with edited version to identify changes
 */
export function detectTranscriptionChanges(
  originalWords: TranscriptionWord[],
  editedText: string
): AudioEdit[] {
  const originalText = originalWords.map(w => w.word).join(' ');
  const edits: AudioEdit[] = [];

  // Simple diff algorithm - find word-level changes
  const originalWordsArray = originalText.split(' ');
  const editedWordsArray = editedText.split(' ');

  let originalIndex = 0;
  let editedIndex = 0;
  let segmentStart = 0;

  while (originalIndex < originalWordsArray.length || editedIndex < editedWordsArray.length) {
    const originalWord = originalWordsArray[originalIndex];
    const editedWord = editedWordsArray[editedIndex];

    if (originalWord === editedWord) {
      originalIndex++;
      editedIndex++;
    } else {
      // Found a change - find the extent of the change
      const changeStart = originalIndex;
      let changeEnd = originalIndex;
      
      // Find where the sequences realign
      for (let i = originalIndex + 1; i < originalWordsArray.length; i++) {
        for (let j = editedIndex + 1; j < editedWordsArray.length; j++) {
          if (originalWordsArray[i] === editedWordsArray[j]) {
            changeEnd = i;
            break;
          }
        }
        if (changeEnd > originalIndex) break;
      }

      const originalSegment = originalWordsArray.slice(changeStart, changeEnd).join(' ');
      const editedSegment = editedWordsArray.slice(editedIndex, editedIndex + (changeEnd - changeStart)).join(' ');

      if (originalSegment !== editedSegment) {
        const startTime = originalWords[changeStart]?.start || 0;
        const endTime = originalWords[changeEnd - 1]?.end || startTime;

        edits.push({
          originalText: originalSegment,
          editedText: editedSegment,
          startTime,
          endTime,
          segmentId: `segment_${changeStart}_${changeEnd}`
        });
      }

      originalIndex = changeEnd > originalIndex ? changeEnd : originalIndex + 1;
      editedIndex += (changeEnd - changeStart);
    }
  }

  return edits;
}

/**
 * Groups words into segments for easier editing
 */
export function groupWordsIntoSegments(
  words: TranscriptionWord[],
  maxSegmentLength: number = 8
): TranscriptionSegment[] {
  const segments: TranscriptionSegment[] = [];
  let currentSegment: TranscriptionWord[] = [];
  let segmentId = 0;

  for (const word of words) {
    currentSegment.push(word);

    if (currentSegment.length >= maxSegmentLength || word.word.includes('.')) {
      segments.push({
        id: `segment_${segmentId}`,
        text: currentSegment.map(w => w.word).join(' '),
        start: currentSegment[0].start,
        end: currentSegment[currentSegment.length - 1].end,
        words: [...currentSegment],
        isEdited: false
      });
      currentSegment = [];
      segmentId++;
    }
  }

  // Add remaining words as final segment
  if (currentSegment.length > 0) {
    segments.push({
      id: `segment_${segmentId}`,
      text: currentSegment.map(w => w.word).join(' '),
      start: currentSegment[0].start,
      end: currentSegment[currentSegment.length - 1].end,
      words: [...currentSegment],
      isEdited: false
    });
  }

  return segments;
}

/**
 * Formats time duration in seconds to MM:SS format
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Extracts audio segment for voice cloning
 */
export function getAudioSegmentForCloning(
  words: TranscriptionWord[],
  targetWordIndex: number,
  contextSeconds: number = 3
): { start: number; end: number } {
  const targetWord = words[targetWordIndex];
  const start = Math.max(0, targetWord.start - contextSeconds);
  const end = Math.min(
    words[words.length - 1].end,
    targetWord.end + contextSeconds
  );
  
  return { start, end };
}

/**
 * Generates a unique filename for uploaded files
 */
export function generateUniqueFilename(originalName: string): string {
  const timestamp = Date.now();
  const randomString = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop();
  return `${timestamp}_${randomString}.${extension}`;
}
