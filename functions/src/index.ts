import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { transcribeAudio } from './transcribeAudio';
import { generateModifiedAudio } from './generateModifiedAudio';
import { createTrimmedClip } from './createTrimmedClip';

// Initialize Firebase Admin
admin.initializeApp();

export const transcribeAudioFunction = functions.https.onCall(transcribeAudio);
export const generateModifiedAudioFunction = functions.https.onCall(generateModifiedAudio);
export const createTrimmedClipFunction = functions.https.onCall(createTrimmedClip);
