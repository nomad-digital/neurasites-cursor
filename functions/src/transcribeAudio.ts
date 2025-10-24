import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: functions.config().openai?.api_key || process.env.OPENAI_API_KEY,
});

export const transcribeAudio = async (data: any, context: functions.https.CallableContext) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { audioStoragePath, projectId } = data;

  if (!audioStoragePath || !projectId) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  try {
    // Update project status to transcribing
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      status: 'transcribing',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Download audio file from Firebase Storage
    const bucket = admin.storage().bucket();
    const file = bucket.file(audioStoragePath);
    
    // Create a temporary file path
    const tempFilePath = `/tmp/audio_${Date.now()}.wav`;
    await file.download({ destination: tempFilePath });

    // Transcribe using OpenAI Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: require('fs').createReadStream(tempFilePath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['word']
    });

    // Process transcription data
    const transcriptionWords = transcription.words?.map(word => ({
      word: word.word,
      start: word.start,
      end: word.end,
      confidence: (word as any).probability || 1.0
    })) || [];

    const fullTranscription = transcriptionWords.map(w => w.word).join(' ');

    // Update project with transcription
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      transcription: transcriptionWords,
      editedTranscription: fullTranscription,
      status: 'ready',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Clean up temporary file
    require('fs').unlinkSync(tempFilePath);

    return {
      success: true,
      transcription: fullTranscription,
      words: transcriptionWords
    };

  } catch (error) {
    console.error('Transcription error:', error);
    
    // Update project status to failed
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new functions.https.HttpsError('internal', 'Transcription failed');
  }
};
