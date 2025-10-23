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
