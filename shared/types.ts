import { Timestamp } from 'firebase/firestore';

export interface AudioClip {
  id: string;
  userId: string;
  title: string;
  audioUrl: string;
  duration: number;
  trimStart?: number;
  trimEnd?: number;
  color?: string;
  buttonPosition?: number;
  status: 'uploading' | 'ready' | 'processing' | 'failed';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  errorMessage?: string;
}

export interface User {
  id: string;
  email: string;
  displayName?: string;
  createdAt: Timestamp;
  photoURL?: string;
}
