"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateModifiedAudio = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const generateModifiedAudio = async (data, context) => {
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
        if (projectData.userId !== context.auth.uid) {
            throw new functions.https.HttpsError('permission-denied', 'Access denied');
        }
        // Update project status to generating
        await admin.firestore().collection('audioProjects').doc(projectId).update({
            status: 'generating',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        // Detect changes in transcription
        const changes = detectTranscriptionChanges(projectData.transcription, editedTranscription);
        if (changes.length === 0) {
            // No changes, just update the project
            await admin.firestore().collection('audioProjects').doc(projectId).update({
                editedTranscription,
                status: 'completed',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'No changes detected' };
        }
        // For now, we'll use a simplified approach
        // In a production environment, you would implement the full audio processing pipeline
        // This includes:
        // 1. Extracting voice samples from original audio
        // 2. Using ElevenLabs API to clone the voice
        // 3. Generating new speech for edited text
        // 4. Stitching audio segments together
        // 5. Uploading the modified audio to Firebase Storage
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Update project with edited transcription (without actual audio generation for now)
        await admin.firestore().collection('audioProjects').doc(projectId).update({
            editedTranscription,
            status: 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return {
            success: true,
            message: 'Transcription updated successfully. Audio generation will be implemented in a future update.',
            changesDetected: changes.length
        };
    }
    catch (error) {
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
exports.generateModifiedAudio = generateModifiedAudio;
function detectTranscriptionChanges(originalWords, editedText) {
    var _a, _b;
    const originalText = originalWords.map(w => w.word).join(' ');
    const edits = [];
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
        }
        else {
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
                if (changeEnd > originalIndex)
                    break;
            }
            const originalSegment = originalWordsArray.slice(changeStart, changeEnd).join(' ');
            const editedSegment = editedWordsArray.slice(editedIndex, editedIndex + (changeEnd - changeStart)).join(' ');
            if (originalSegment !== editedSegment) {
                const startTime = ((_a = originalWords[changeStart]) === null || _a === void 0 ? void 0 : _a.start) || 0;
                const endTime = ((_b = originalWords[changeEnd - 1]) === null || _b === void 0 ? void 0 : _b.end) || startTime;
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
//# sourceMappingURL=generateModifiedAudio.js.map