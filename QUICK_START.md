# DJ Soundboard - Quick Start Guide

Get your soundboard up and running in minutes!

## 🚀 Quick Setup

### 1. Install Dependencies

```bash
# Install all dependencies
npm run install:all

# Or install individually
cd web && npm install
cd ../shared && npm install
```

### 2. Configure Firebase

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** authentication
3. Create a **Firestore database** (start in production mode or test mode)
4. Create a **Storage bucket**
5. Get your Firebase configuration from Project Settings

### 3. Set Up Environment Variables

Copy the Firebase configuration to your environment:

```bash
# In the /workspace directory
cp env.example .env
```

Edit `.env` and add your Firebase configuration values.

### 4. Deploy Firebase Rules

```bash
firebase login
firebase use --add  # Select your project
firebase deploy --only firestore:rules,storage:rules
```

### 5. Run the App

```bash
# Web App
cd web
npm run dev
```

Visit `http://localhost:5173` and start building your soundboard!

## 📱 Using the App

### Upload Your First Clip

1. Click **"Add Clip"** button
2. Drag & drop or select an audio file (MP3, WAV, M4A, AAC, OGG)
3. Give it a name (e.g., "Intro Music", "Applause", "Drum Roll")
4. Click **"Upload to Soundboard"**

### Trim Your Clip

1. Click the **Edit** icon on any clip
2. Play the audio and find the exact portion you want
3. Use the **trim slider** to select start and end points
4. Or use **"Set to Current Time"** buttons for precision
5. Click **"Save Clip"**

### Play Clips on Your Soundboard

1. Return to the home screen
2. Click any button to play that clip instantly
3. Click again to stop playback
4. Each clip shows its duration and trim status

## 🎯 Pro Tips

- **Keyboard Shortcuts**: Consider adding keyboard bindings for quick access (feature coming soon!)
- **Organization**: Use clear, descriptive names for your clips
- **Trim Tightly**: Trim clips to exactly what you need for instant response
- **Test Audio**: Make sure your clips are normalized to similar volumes

## 🎨 Customization Ideas

- Add custom colors to clips (edit the AudioClip type to include color)
- Implement keyboard shortcuts for each button
- Add categories/folders for organizing clips
- Create clip playlists for sequences

## 🔧 Troubleshooting

### Audio Won't Play
- Check browser audio permissions
- Ensure file uploaded successfully
- Try a different audio format

### Upload Fails
- File must be under 50MB
- Use supported formats: MP3, WAV, M4A, AAC, OGG
- Check your Firebase Storage rules are deployed

### Clips Not Showing
- Verify you're signed in with the same account
- Check Firebase Firestore rules are deployed
- Open browser console for error messages

## 📚 Next Steps

- **Mobile App**: Install dependencies in `/mobile` and run with Expo
- **Deploy Web**: Build and deploy to Firebase Hosting
- **Add Features**: Customize the app to your needs
- **Share**: Deploy and share with your team!

## 🆘 Need Help?

- Check the main [README.md](./README.md) for detailed setup
- Review Firebase documentation for configuration issues
- Check browser console for error messages

---

Happy DJing! 🎵🎧
