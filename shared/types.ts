import { Timestamp } from 'firebase/firestore';

export interface AudioProject {
  id: string;
  userId: string;
  title: string;
  originalAudioUrl: string;
  transcription: TranscriptionWord[];
  editedTranscription?: string;
  modifiedAudioUrl?: string;
  status: 'uploading' | 'transcribing' | 'ready' | 'generating' | 'completed' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  errorMessage?: string;
}

export interface TranscriptionWord {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  photoURL?: string;
}

export interface TranscriptionSegment {
  id: string;
  text: string;
  start: number;
  end: number;
  words: TranscriptionWord[];
  editedText?: string;
  isEdited: boolean;
}

export interface AudioEdit {
  originalText: string;
  editedText: string;
  startTime: number;
  endTime: number;
  segmentId: string;
}

export interface VoiceCloneSettings {
  stability: number;
  similarityBoost: number;
  style: number;
  useSpeakerBoost: boolean;
}

export interface ProcessingStatus {
  step: 'uploading' | 'transcribing' | 'ready' | 'generating' | 'completed' | 'failed';
  progress: number;
  message: string;
  error?: string;
}

// A saved, trimmed audio clip that can be played on a soundboard
export interface SoundClip {
  id: string;
  userId: string;
  // Source project this clip was trimmed from
  projectId: string;
  title: string;
  description?: string;
  // Start/end in seconds within the original audio
  startTime: number;
  endTime: number;
  // Firebase Storage path where the trimmed clip is stored
  audioStoragePath: string;
  // Optional ordering or grouping for soundboard
  order?: number;
  color?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
