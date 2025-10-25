import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Grid,
  Chip,
} from '@mui/material';
import { Add, Edit, VolumeUp, Logout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { getDownloadURL } from 'firebase/storage';
import { signOut } from 'firebase/auth';
import { auth, db, getStorageRef } from '../utils/firebase';
import type { AudioClip } from '../types';

interface LoadedClip extends Omit<AudioClip, 'audioUrl'> {
  audioElement?: HTMLAudioElement;
  audioUrl?: string;
}

export default function HomeScreen() {
  const [clips, setClips] = useState<LoadedClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingClipId, setPlayingClipId] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; clipId: string | null }>({
    open: false,
    clipId: null,
  });
  const navigate = useNavigate();
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const clipsQuery = query(
      collection(db, 'audioClips'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(clipsQuery, async (snapshot) => {
      const clipsData = await Promise.all(
        snapshot.docs.map(async (docSnapshot) => {
          const clipData = {
            id: docSnapshot.id,
            ...docSnapshot.data()
          } as LoadedClip;

          // Load audio URL
          if (clipData.audioUrl) {
            try {
              const url = await getDownloadURL(getStorageRef(clipData.audioUrl));
              clipData.audioUrl = url;

              // Create audio element
              const audioElement = new Audio(url);
              audioElement.preload = 'auto';
              
              // Set up audio element with trim points
              if (clipData.trimStart !== undefined) {
                audioElement.currentTime = clipData.trimStart;
              }

              audioElement.addEventListener('ended', () => {
                setPlayingClipId(null);
              });

              audioElement.addEventListener('timeupdate', () => {
                // Stop at trim end if set
                if (clipData.trimEnd !== undefined && audioElement.currentTime >= clipData.trimEnd) {
                  audioElement.pause();
                  audioElement.currentTime = clipData.trimStart || 0;
                  setPlayingClipId(null);
                }
              });

              audioElementsRef.current.set(clipData.id, audioElement);
            } catch (error) {
              console.error('Error loading audio:', error);
            }
          }

          return clipData;
        })
      );
      
      setClips(clipsData);
      setLoading(false);
    });

    return () => {
      unsubscribe();
      // Cleanup audio elements
      audioElementsRef.current.forEach(audio => {
        audio.pause();
        audio.src = '';
      });
      audioElementsRef.current.clear();
    };
  }, []);

  const handlePlayClip = async (clip: LoadedClip) => {
    const audioElement = audioElementsRef.current.get(clip.id);
    
    if (!audioElement) return;

    // Stop any currently playing clip
    if (playingClipId && playingClipId !== clip.id) {
      const currentAudio = audioElementsRef.current.get(playingClipId);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    }

    // If this clip is already playing, stop it
    if (playingClipId === clip.id) {
      audioElement.pause();
      audioElement.currentTime = clip.trimStart || 0;
      setPlayingClipId(null);
      return;
    }

    // Reset to trim start and play
    audioElement.currentTime = clip.trimStart || 0;
    setPlayingClipId(clip.id);
    
    try {
      await audioElement.play();
    } catch (error) {
      console.error('Error playing audio:', error);
      setPlayingClipId(null);
    }
  };

  const handleDeleteClip = async () => {
    if (!deleteDialog.clipId) return;

    try {
      // Stop audio if playing
      const audioElement = audioElementsRef.current.get(deleteDialog.clipId);
      if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElementsRef.current.delete(deleteDialog.clipId);
      }

      await deleteDoc(doc(db, 'audioClips', deleteDialog.clipId));
      setDeleteDialog({ open: false, clipId: null });
    } catch (error) {
      console.error('Failed to delete clip:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getClipDuration = (clip: LoadedClip) => {
    if (clip.trimStart !== undefined && clip.trimEnd !== undefined) {
      return clip.trimEnd - clip.trimStart;
    }
    return clip.duration;
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
        <Box>
          <Typography variant="h3" component="h1" fontWeight="bold">
            🎵 DJ Soundboard
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            Click any button to play your audio clips instantly
          </Typography>
        </Box>
        <Box display="flex" gap={2}>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => navigate('/upload')}
            size="large"
          >
            Add Clip
          </Button>
          <Button
            variant="outlined"
            startIcon={<Logout />}
            onClick={handleSignOut}
            size="large"
          >
            Sign Out
          </Button>
        </Box>
      </Box>

      {clips.length === 0 ? (
        <Card sx={{ p: 4, textAlign: 'center' }}>
          <VolumeUp sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            No Audio Clips Yet
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            Upload your first audio clip to get started with your soundboard
          </Typography>
          <Button
            variant="contained"
            size="large"
            startIcon={<Add />}
            onClick={() => navigate('/upload')}
          >
            Add Your First Clip
          </Button>
        </Card>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            <strong>Pro Tip:</strong> You have {clips.length} clip{clips.length !== 1 ? 's' : ''} in your soundboard. 
            Click any button to play instantly, click again to stop!
          </Alert>

          <Grid container spacing={2}>
            {clips.map((clip, index) => {
              const isPlaying = playingClipId === clip.id;
              const clipDuration = getClipDuration(clip);
              
              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={clip.id}>
                  <Card 
                    sx={{ 
                      height: '100%',
                      position: 'relative',
                      transition: 'all 0.2s',
                      transform: isPlaying ? 'scale(1.05)' : 'scale(1)',
                      boxShadow: isPlaying ? 6 : 1,
                      '&:hover': {
                        transform: 'scale(1.02)',
                        boxShadow: 3,
                      }
                    }}
                  >
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                        <Chip 
                          label={`#${index + 1}`} 
                          size="small" 
                          color="primary"
                        />
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/editor/${clip.id}`)}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                      </Box>

                      <Button
                        fullWidth
                        variant={isPlaying ? "contained" : "outlined"}
                        color={isPlaying ? "secondary" : "primary"}
                        onClick={() => handlePlayClip(clip)}
                        sx={{ 
                          py: 4,
                          fontSize: '1.1rem',
                          fontWeight: 'bold',
                          mb: 2,
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {isPlaying && (
                          <Box
                            sx={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.3) 50%, transparent 100%)',
                              animation: 'shimmer 1.5s infinite',
                              '@keyframes shimmer': {
                                '0%': { transform: 'translateX(-100%)' },
                                '100%': { transform: 'translateX(100%)' }
                              }
                            }}
                          />
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 1
                          }}
                        >
                          {isPlaying && <VolumeUp />}
                          {clip.title}
                        </Box>
                      </Button>

                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {formatDuration(clipDuration)}
                        </Typography>
                        
                        {(clip.trimStart !== undefined || clip.trimEnd !== undefined) && (
                          <Chip 
                            label="Trimmed" 
                            size="small" 
                            color="success"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, clipId: null })}
      >
        <DialogTitle>Delete Clip</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this audio clip? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, clipId: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteClip} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
