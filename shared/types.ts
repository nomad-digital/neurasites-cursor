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

// A saved, trimmed audio clip for the user's soundboard
export interface SoundClip {
  id: string;
  userId: string;
  title: string;
  storagePath: string; // path in Firebase Storage (e.g., users/{uid}/clips/{clipId}.wav)
  duration: number; // clip duration in seconds
  sourceProjectId?: string; // optional link back to original project
  sourceStartSec?: number; // original start time used to create the clip
  sourceEndSec?: number; // original end time used to create the clip
  slot?: number; // optional UI slot/index for arranging buttons
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
