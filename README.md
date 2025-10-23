# Audio Transcription & Voice Editor App

A cross-platform application that allows users to upload audio files, transcribe them using AI, edit the transcription, and generate modified audio with voice cloning technology.

## Features

- **Audio Upload**: Support for MP3, WAV, M4A, and AAC files (up to 50MB)
- **AI Transcription**: Automatic transcription using OpenAI Whisper API
- **Text Editing**: Edit transcriptions with real-time preview
- **Voice Cloning**: Generate modified audio using ElevenLabs voice cloning
- **Cross-Platform**: Native mobile apps (iOS/Android) and web application
- **User Authentication**: Secure user accounts with Firebase Auth
- **Project Management**: Save and manage audio projects

## Architecture

- **Mobile Apps**: React Native with Expo
- **Web App**: React with Vite and Material-UI
- **Backend**: Firebase (Auth, Firestore, Storage, Cloud Functions)
- **AI Services**: OpenAI Whisper API, ElevenLabs API

## Project Structure

```
neurasites-cursor/
├── mobile/                 # React Native Expo app
├── web/                   # React web app
├── functions/             # Firebase Cloud Functions
├── shared/                # Shared code/types
└── firebase.json          # Firebase config
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Firebase CLI
- Expo CLI
- Firebase project
- OpenAI API key
- ElevenLabs API key

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd neurasites-cursor
npm run install:all
```

### 2. Firebase Setup

1. Create a new Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password and Google Sign-In)
3. Create Firestore database
4. Create Storage bucket
5. Initialize Firebase Functions

```bash
firebase login
firebase use --add  # Select your project
```

### 3. Environment Variables

Copy `env.example` to `.env` and fill in your API keys:

```bash
cp env.example .env
```

Update the following variables:
- Firebase configuration values
- `OPENAI_API_KEY` - Your OpenAI API key
- `ELEVENLABS_API_KEY` - Your ElevenLabs API key

### 4. Firebase Functions Setup

```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

### 5. Run Applications

**Web App:**
```bash
cd web
npm run dev
```

**Mobile App:**
```bash
cd mobile
npm start
```

## API Costs

- **Whisper API**: ~$0.006 per minute of audio
- **ElevenLabs**: ~$0.20-0.30 per minute of generated audio
- **Firebase**: Storage ~$0.026/GB, Functions ~$0.40/million invocations

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Upload Audio**: Select an audio file from your device
3. **Wait for Transcription**: AI will transcribe your audio automatically
4. **Edit Transcription**: Modify the transcribed text as needed
5. **Generate Modified Audio**: AI will create new audio with your edits
6. **Play and Download**: Listen to the modified audio and save your projects

## Development

### Adding New Features

1. Update types in `shared/types.ts`
2. Implement backend logic in `functions/src/`
3. Add UI components in `mobile/screens/` or `web/src/screens/`
4. Test across all platforms

### Deployment

**Web App:**
```bash
cd web
npm run build
firebase deploy --only hosting
```

**Mobile Apps:**
```bash
cd mobile
eas build --platform all
```

## Security

- Firebase Security Rules protect user data
- API keys are stored securely in environment variables
- File uploads are validated and size-limited
- User authentication is required for all operations

## Troubleshooting

### Common Issues

1. **Firebase not initialized**: Check your Firebase configuration
2. **API key errors**: Verify your OpenAI and ElevenLabs API keys
3. **Upload failures**: Check file size and format requirements
4. **Transcription errors**: Ensure audio quality is good and language is supported

### Support

For issues and questions, please check the Firebase documentation and API documentation for the services used.

## License

This project is licensed under the MIT License.
