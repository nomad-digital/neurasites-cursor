# DJ Soundboard App

A cross-platform application that allows users to upload audio clips, trim them, and play them instantly like a professional DJ soundboard. Perfect for radio DJs, podcasters, streamers, and content creators.

## Features

- **Audio Upload**: Support for MP3, WAV, M4A, AAC, and OGG files (up to 50MB)
- **Audio Trimming**: Precise trim controls to select exactly the portion you want to play
- **Instant Playback**: Click any button to play your audio clips instantly
- **Visual Soundboard**: Beautiful grid layout with numbered buttons for each clip
- **Cross-Platform**: Native mobile apps (iOS/Android) and web application
- **User Authentication**: Secure user accounts with Firebase Auth
- **Clip Management**: Save and organize your audio library

## Architecture

- **Mobile Apps**: React Native with Expo
- **Web App**: React with Vite and Material-UI
- **Backend**: Firebase (Auth, Firestore, Storage)

## Project Structure

```
dj-soundboard/
├── mobile/                 # React Native Expo app
├── web/                   # React web app
├── shared/                # Shared code/types
└── firebase.json          # Firebase config
```

## Setup Instructions

### Prerequisites

- Node.js 18+
- Firebase CLI
- Expo CLI (for mobile development)
- Firebase project

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

### 3. Configure Firebase

Copy `env.example` to `.env` and fill in your Firebase configuration values.

### 4. Deploy Firebase Rules

```bash
firebase deploy --only firestore:rules,storage:rules
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

## Usage

1. **Sign Up/Login**: Create an account or sign in
2. **Upload Audio**: Click "Add Clip" and select an audio file from your device
3. **Trim Your Clip**: Use the editor to select exactly the portion you want to play
4. **Save to Soundboard**: Your clip appears as a button on your soundboard
5. **Play Instantly**: Click any button to play that clip instantly
6. **Manage Your Library**: Edit, rename, or delete clips as needed

## Firebase Costs

- **Firebase Storage**: ~$0.026/GB for audio storage
- **Firebase Firestore**: Free tier covers most personal use cases
- All processing happens in the browser - no backend costs!

## Development

### Adding New Features

1. Update types in `shared/types.ts`
2. Add UI components in `mobile/screens/` or `web/src/screens/`
3. Test across all platforms

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

## Use Cases

- **Radio DJs**: Quick access to jingles, sound effects, and music clips
- **Podcasters**: Play intro music, sponsor messages, and transitions
- **Streamers**: Trigger sound effects and reactions during live streams
- **Content Creators**: Organize and play audio clips for video production
- **Event Hosts**: Play announcements, music, and sound effects at events

## Security

- Firebase Security Rules protect user data
- File uploads are validated and size-limited (50MB max)
- User authentication is required for all operations
- Each user can only access their own audio clips

## Troubleshooting

### Common Issues

1. **Firebase not initialized**: Check your Firebase configuration in the `.env` file
2. **Upload failures**: Ensure your audio file is under 50MB and in a supported format
3. **Clips not playing**: Check that your browser allows audio playback
4. **Trimming not working**: Make sure the trim end is after the trim start

### Browser Compatibility

- Chrome, Firefox, Safari, Edge (latest versions)
- Audio playback requires browser support for HTML5 audio
- File uploads work best with modern browsers

## License

This project is licensed under the MIT License.
