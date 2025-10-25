import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  TextField,
  Button,
} from '@mui/material';
import { CloudUpload, CheckCircle } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, storage, db } from '../utils/firebase';

export default function UploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const [clipName, setClipName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const navigate = useNavigate();

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    
    setSelectedFile(file);
    setClipName(file.name.replace(/\.[^/.]+$/, '')); // Remove file extension
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac', '.ogg']
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleFileUpload = async () => {
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in first');
      return;
    }

    if (!selectedFile) {
      setError('Please select an audio file');
      return;
    }

    if (!clipName.trim()) {
      setError('Please enter a clip name');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Generate unique filename
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const storagePath = `users/${user.uid}/clips/${fileName}`;

      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, selectedFile);

      // Track upload progress
      uploadTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      });

      // Wait for upload to complete
      await uploadTask;

      // Create audio element to get duration
      const audioElement = new Audio();
      audioElement.src = URL.createObjectURL(selectedFile);
      
      await new Promise<void>((resolve) => {
        audioElement.addEventListener('loadedmetadata', () => {
          resolve();
        });
      });

      const duration = audioElement.duration;
      URL.revokeObjectURL(audioElement.src);

      // Create clip document in Firestore
      const clipRef = doc(db, 'audioClips', '');
      const clipId = clipRef.id;
      const clipData = {
        id: clipId,
        userId: user.uid,
        title: clipName.trim(),
        audioUrl: storagePath,
        duration: duration,
        status: 'ready',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(clipRef, clipData);

      navigate('/');
    } catch (error: any) {
      setError(error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Upload Audio Clip
        </Typography>
        <Button variant="outlined" onClick={() => navigate('/')}>
          Back to Soundboard
        </Button>
      </Box>
      
      <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
        Upload an audio clip to add to your soundboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Box
            {...getRootProps()}
            sx={{
              border: '2px dashed',
              borderColor: isDragActive ? 'primary.main' : selectedFile ? 'success.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              opacity: uploading ? 0.6 : 1,
              mb: 3,
            }}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <Box>
                <Typography variant="h6" gutterBottom>
                  Uploading... {Math.round(uploadProgress)}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={uploadProgress} 
                  sx={{ width: '100%', maxWidth: 300, mx: 'auto' }}
                />
              </Box>
            ) : selectedFile ? (
              <Box>
                <CheckCircle sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  File Selected: {selectedFile.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Click to choose a different file
                </Typography>
              </Box>
            ) : (
              <Box>
                <CloudUpload sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  {isDragActive ? 'Drop the audio file here' : 'Choose Audio File'}
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Drag and drop an audio file here, or click to select
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  MP3, WAV, M4A, AAC, OGG (max 50MB)
                </Typography>
              </Box>
            )}
          </Box>

          {selectedFile && (
            <>
              <TextField
                fullWidth
                label="Clip Name"
                value={clipName}
                onChange={(e) => setClipName(e.target.value)}
                placeholder="Enter a name for your audio clip"
                sx={{ mb: 3 }}
                disabled={uploading}
              />

              <Button
                variant="contained"
                size="large"
                fullWidth
                onClick={handleFileUpload}
                disabled={uploading || !clipName.trim()}
                sx={{ py: 1.5 }}
              >
                Upload to Soundboard
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Supported formats:
          </Typography>
          <List dense>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="MP3, WAV, M4A, AAC, OGG files" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="Maximum file size: 50MB" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="After uploading, you can trim the clip in the editor" />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}
