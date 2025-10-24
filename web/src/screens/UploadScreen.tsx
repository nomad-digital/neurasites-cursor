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
} from '@mui/material';
import { CloudUpload, CheckCircle } from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useNavigate } from 'react-router-dom';
import { ref, uploadBytesResumable } from 'firebase/storage';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { auth, storage, db, functions } from '../utils/firebase';
// import { validateAudioFile, generateUniqueFilename } from '../utils/helpers';

export default function UploadScreen() {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    await handleFileUpload(file);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.aac']
    },
    maxFiles: 1,
    disabled: uploading,
  });

  const handleFileUpload = async (file: File) => {
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in first');
      return;
    }

    // Validate file (simplified for now)
    if (!file.type.startsWith('audio/')) {
      setError('Please select an audio file');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError('');

    try {
      // Generate unique filename
      const fileName = `${Date.now()}_${file.name}`;
      const storagePath = `users/${user.uid}/original/${fileName}`;

      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath);
      const uploadTask = uploadBytesResumable(storageRef, file);

      // Track upload progress
      uploadTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      });

      // Wait for upload to complete
      await uploadTask;

      // Create project document in Firestore
      const projectRef = doc(db, 'audioProjects', '');
      const projectId = projectRef.id;
      const projectData = {
        id: projectId,
        userId: user.uid,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        originalAudioUrl: storagePath,
        status: 'uploading',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(projectRef, projectData);

      // Trigger transcription
      const transcribeFunction = httpsCallable(functions, 'transcribeAudioFunction');
      await transcribeFunction({
        audioStoragePath: storagePath,
        projectId: projectId,
      });

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
      <Typography variant="h4" component="h1" gutterBottom textAlign="center">
        Upload Audio
      </Typography>
      
      <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ mb: 4 }}>
        Select an audio file to start editing
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
              borderColor: isDragActive ? 'primary.main' : 'grey.300',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: uploading ? 'not-allowed' : 'pointer',
              bgcolor: isDragActive ? 'action.hover' : 'background.paper',
              transition: 'all 0.2s ease-in-out',
              opacity: uploading ? 0.6 : 1,
            }}
          >
            <input {...getInputProps()} />
            
            {uploading ? (
              <Box>
                <Box sx={{ mb: 2 }}>Uploading...</Box>
                <Typography variant="h6" gutterBottom>
                  Uploading... {Math.round(uploadProgress)}%
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={uploadProgress} 
                  sx={{ width: '100%', maxWidth: 300, mx: 'auto' }}
                />
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
                  MP3, WAV, M4A, AAC (max 50MB)
                </Typography>
              </Box>
            )}
          </Box>
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
              <ListItemText primary="MP3 files" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="WAV files" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="M4A files" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="AAC files" />
            </ListItem>
            <ListItem>
              <ListItemIcon>
                <CheckCircle color="success" />
              </ListItemIcon>
              <ListItemText primary="Maximum file size: 50MB" />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    </Box>
  );
}
