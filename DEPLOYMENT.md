# Deployment Guide

This guide will help you deploy the Audio Transcription & Voice Editor App to production.

## Prerequisites

Before deploying, ensure you have:

1. **Firebase Project Setup**
   - Created a Firebase project
   - Enabled Authentication, Firestore, Storage, and Functions
   - Configured security rules
   - Set up billing (required for Cloud Functions)

2. **API Keys**
   - OpenAI API key for Whisper transcription
   - ElevenLabs API key for voice cloning

3. **Development Environment**
   - Node.js 18+
   - Firebase CLI
   - Expo CLI (for mobile apps)

## Step 1: Firebase Configuration

### 1.1 Initialize Firebase Project

```bash
firebase login
firebase use --add  # Select your project
```

### 1.2 Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### 1.3 Deploy Storage Rules

```bash
firebase deploy --only storage
```

### 1.4 Deploy Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

### 1.5 Configure Environment Variables

Set up your Cloud Functions environment variables:

```bash
firebase functions:config:set openai.api_key="your-openai-api-key"
firebase functions:config:set elevenlabs.api_key="your-elevenlabs-api-key"
```

## Step 2: Web App Deployment

### 2.1 Build Web App

```bash
cd web
npm run build
```

### 2.2 Deploy to Firebase Hosting

```bash
firebase deploy --only hosting
```

### 2.3 Configure Environment Variables

Create a `.env` file in the web directory:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=your-app-id
```

## Step 3: Mobile App Deployment

### 3.1 Install Expo CLI

```bash
npm install -g @expo/cli
```

### 3.2 Configure Firebase for React Native

1. Download your Firebase config files:
   - `google-services.json` for Android
   - `GoogleService-Info.plist` for iOS

2. Place them in the mobile directory

3. Update `mobile/utils/firebase.ts` with your actual Firebase config

### 3.3 Build for Development

```bash
cd mobile
npm start
```

### 3.4 Build for Production

#### Android APK

```bash
cd mobile
eas build --platform android
```

#### iOS App

```bash
cd mobile
eas build --platform ios
```

**Note:** iOS builds require an Apple Developer account and macOS.

## Step 4: Production Configuration

### 4.1 Security Rules

Ensure your Firestore and Storage rules are properly configured:

**Firestore Rules (`firestore.rules`):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    match /audioProjects/{projectId} {
      allow read, write: if request.auth != null && 
        request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && 
        request.auth.uid == request.resource.data.userId;
    }
  }
}
```

**Storage Rules (`storage.rules`):**
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/{allPaths=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 4.2 CORS Configuration

For web app file uploads, configure CORS for your Storage bucket:

```bash
gsutil cors set cors.json gs://your-project.appspot.com
```

Where `cors.json` contains:
```json
[
  {
    "origin": ["https://your-domain.com"],
    "method": ["GET", "POST", "PUT", "DELETE"],
    "maxAgeSeconds": 3600
  }
]
```

## Step 5: Monitoring and Maintenance

### 5.1 Enable Firebase Analytics

```bash
firebase analytics:enable
```

### 5.2 Set up Error Monitoring

Consider integrating Firebase Crashlytics for mobile apps and Firebase Performance Monitoring.

### 5.3 Monitor Usage and Costs

- Monitor Firebase usage in the Firebase Console
- Set up billing alerts
- Monitor API usage for OpenAI and ElevenLabs

## Step 6: Domain and SSL

### 6.1 Custom Domain (Optional)

1. Go to Firebase Hosting in the Firebase Console
2. Add your custom domain
3. Follow the verification steps
4. SSL certificates are automatically provisioned

### 6.2 Environment-Specific Configurations

Create separate Firebase projects for:
- Development
- Staging  
- Production

Update your environment variables accordingly.

## Troubleshooting

### Common Issues

1. **Functions deployment fails**
   - Ensure billing is enabled
   - Check Node.js version compatibility
   - Verify API keys are set correctly

2. **Web app build fails**
   - Check environment variables
   - Ensure all dependencies are installed
   - Verify Firebase configuration

3. **Mobile app builds fail**
   - Check Firebase configuration files
   - Ensure proper certificates for iOS
   - Verify Expo configuration

### Support

- Firebase Documentation: https://firebase.google.com/docs
- Expo Documentation: https://docs.expo.dev/
- OpenAI API Documentation: https://platform.openai.com/docs
- ElevenLabs Documentation: https://docs.elevenlabs.io/

## Cost Optimization

### Recommendations

1. **Implement Usage Quotas**
   - Set daily/monthly limits per user
   - Implement tiered pricing

2. **Optimize Audio Processing**
   - Cache voice clones
   - Compress audio files
   - Use appropriate audio formats

3. **Monitor and Alert**
   - Set up billing alerts
   - Monitor API usage
   - Implement rate limiting

## Security Considerations

1. **API Key Security**
   - Never expose API keys in client code
   - Use Firebase Functions for server-side operations
   - Implement proper authentication

2. **Data Privacy**
   - Implement user data deletion
   - Follow GDPR/privacy regulations
   - Encrypt sensitive data

3. **Access Control**
   - Implement proper user authentication
   - Use Firebase Security Rules
   - Validate all user inputs
