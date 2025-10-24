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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.transcribeAudio = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const openai_1 = __importDefault(require("openai"));
const openai = new openai_1.default({
    apiKey: ((_a = functions.config().openai) === null || _a === void 0 ? void 0 : _a.api_key) || process.env.OPENAI_API_KEY,
});
const transcribeAudio = async (data, context) => {
    var _a;
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
        const transcriptionWords = ((_a = transcription.words) === null || _a === void 0 ? void 0 : _a.map(word => ({
            word: word.word,
            start: word.start,
            end: word.end,
            confidence: word.probability || 1.0
        }))) || [];
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
    }
    catch (error) {
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
exports.transcribeAudio = transcribeAudio;
//# sourceMappingURL=transcribeAudio.js.map