import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as path from 'path';

interface AudioEdit {
  originalText: string;
  editedText: string;
  startTime: number;
  endTime: number;
  segmentId: string;
}

export const generateModifiedAudio = async (data: any, context: functions.https.CallableContext) => {
  // Verify authentication
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
  }

  const { projectId, editedTranscription } = data;

  if (!projectId || !editedTranscription) {
    throw new functions.https.HttpsError('invalid-argument', 'Missing required parameters');
  }

  try {
    // Get project data
    const projectDoc = await admin.firestore().collection('audioProjects').doc(projectId).get();
    if (!projectDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found');
    }

    const projectData = projectDoc.data();
    if (projectData!.userId !== context.auth.uid) {
      throw new functions.https.HttpsError('permission-denied', 'Access denied');
    }

    // Update project status to generating
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      status: 'generating',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Detect changes in transcription
    const originalTranscription = projectData!.transcription.map((w: any) => w.word).join(' ');
    const changes = detectTranscriptionChanges(projectData!.transcription, editedTranscription);

    if (changes.length === 0) {
      // No changes, just update the project
      await admin.firestore().collection('audioProjects').doc(projectId).update({
        editedTranscription,
        status: 'completed',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, message: 'No changes detected' };
    }

    // Download original audio file
    const bucket = admin.storage().bucket();
    const originalFile = bucket.file(projectData!.originalAudioUrl);
    const tempOriginalPath = `/tmp/original_${Date.now()}.wav`;
    await originalFile.download({ destination: tempOriginalPath });

    let modifiedAudioPath = tempOriginalPath;

    // Process each change
    for (const change of changes) {
      try {
        // Extract voice sample from original audio
        const voiceSamplePath = await extractVoiceSample(
          tempOriginalPath,
          change.startTime,
          change.endTime
        );

        // Clone voice using ElevenLabs API
        const clonedAudioPath = await generateVoiceClone(
          voiceSamplePath,
          change.editedText,
          context.auth.uid
        );

        // Replace audio segment
        modifiedAudioPath = await replaceAudioSegment(
          modifiedAudioPath,
          clonedAudioPath,
          change.startTime,
          change.endTime
        );

        // Clean up temporary files
        fs.unlinkSync(voiceSamplePath);
        fs.unlinkSync(clonedAudioPath);

      } catch (error) {
        console.error(`Error processing change ${change.segmentId}:`, error);
        // Continue with other changes
      }
    }

    // Upload modified audio to Firebase Storage
    const modifiedFileName = `modified_${Date.now()}.wav`;
    const modifiedStoragePath = `users/${context.auth.uid}/modified/${modifiedFileName}`;
    
    await bucket.upload(modifiedAudioPath, {
      destination: modifiedStoragePath,
      metadata: {
        contentType: 'audio/wav'
      }
    });

    // Update project with modified audio
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      editedTranscription,
      modifiedAudioUrl: modifiedStoragePath,
      status: 'completed',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Clean up temporary files
    fs.unlinkSync(tempOriginalPath);
    if (modifiedAudioPath !== tempOriginalPath) {
      fs.unlinkSync(modifiedAudioPath);
    }

    return { success: true, modifiedAudioUrl: modifiedStoragePath };

  } catch (error) {
    console.error('Audio generation error:', error);
    
    // Update project status to failed
    await admin.firestore().collection('audioProjects').doc(projectId).update({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : 'Unknown error occurred',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    throw new functions.https.HttpsError('internal', 'Audio generation failed');
  }
};

function detectTranscriptionChanges(originalWords: any[], editedText: string): AudioEdit[] {
  const originalText = originalWords.map(w => w.word).join(' ');
  const edits: AudioEdit[] = [];

  // Simple diff algorithm - find word-level changes
  const originalWordsArray = originalText.split(' ');
  const editedWordsArray = editedText.split(' ');

  let originalIndex = 0;
  let editedIndex = 0;

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

async function extractVoiceSample(audioPath: string, startTime: number, endTime: number): Promise<string> {
  const outputPath = `/tmp/voice_sample_${Date.now()}.wav`;
  
  return new Promise((resolve, reject) => {
    ffmpeg(audioPath)
      .seekInput(startTime)
      .duration(endTime - startTime)
      .output(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', reject)
      .run();
  });
}

async function generateVoiceClone(voiceSamplePath: string, text: string, userId: string): Promise<string> {
  const outputPath = `/tmp/cloned_audio_${Date.now()}.wav`;
  
  try {
    // First, clone the voice using ElevenLabs API
    const formData = new FormData();
    formData.append('files', fs.createReadStream(voiceSamplePath));
    formData.append('name', `voice_${userId}_${Date.now()}`);
    
    const cloneResponse = await axios.post(
      'https://api.elevenlabs.io/v1/voices/add',
      formData,
      {
        headers: {
          'xi-api-key': functions.config().elevenlabs?.api_key || process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    const voiceId = cloneResponse.data.voice_id;

    // Generate speech using the cloned voice
    const speechResponse = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.8,
          style: 0.0,
          use_speaker_boost: true
        }
      },
      {
        headers: {
          'xi-api-key': functions.config().elevenlabs?.api_key || process.env.ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer'
      }
    );

    fs.writeFileSync(outputPath, speechResponse.data);
    return outputPath;

  } catch (error) {
    console.error('Voice cloning error:', error);
    throw new Error('Failed to clone voice');
  }
}

async function replaceAudioSegment(
  originalAudioPath: string,
  newSegmentPath: string,
  startTime: number,
  endTime: number
): Promise<string> {
  const outputPath = `/tmp/modified_${Date.now()}.wav`;
  
  return new Promise((resolve, reject) => {
    // Create three segments: before, new, after
    const beforePath = `/tmp/before_${Date.now()}.wav`;
    const afterPath = `/tmp/after_${Date.now()}.wav`;
    
    // Extract before segment
    ffmpeg(originalAudioPath)
      .seekInput(0)
      .duration(startTime)
      .output(beforePath)
      .on('end', () => {
        // Extract after segment
        ffmpeg(originalAudioPath)
          .seekInput(endTime)
          .output(afterPath)
          .on('end', () => {
            // Concatenate all segments
            ffmpeg()
              .input(beforePath)
              .input(newSegmentPath)
              .input(afterPath)
              .complexFilter('[0:0][1:0][2:0]concat=n=3:v=0:a=1[out]')
              .outputOptions(['-map', '[out]'])
              .output(outputPath)
              .on('end', () => {
                // Clean up temporary files
                fs.unlinkSync(beforePath);
                fs.unlinkSync(afterPath);
                resolve(outputPath);
              })
              .on('error', reject)
              .run();
          })
          .on('error', reject)
          .run();
      })
      .on('error', reject)
      .run();
  });
}
