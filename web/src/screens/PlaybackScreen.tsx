import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Slider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { PlayArrow, Pause, Share, Delete } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { getDownloadURL } from 'firebase/storage';
import { db, getStorageRef } from '../utils/firebase';
import type { AudioProject } from '../types';

export default function PlaybackScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const originalAudioRef = useRef<HTMLAudioElement>(null);
  const modifiedAudioRef = useRef<HTMLAudioElement>(null);
  
  const [project, setProject] = useState<AudioProject | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [modifiedAudioUrl, setModifiedAudioUrl] = useState<string | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingModified, setIsPlayingModified] = useState(false);
  const [originalCurrentTime, setOriginalCurrentTime] = useState(0);
  const [modifiedCurrentTime, setModifiedCurrentTime] = useState(0);
  const [originalDuration, setOriginalDuration] = useState(0);
  const [modifiedDuration, setModifiedDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState(false);

  useEffect(() => {
    if (!projectId) return;

    // Listen to project changes
    const unsubscribe = onSnapshot(
      doc(db, 'audioProjects', projectId),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const projectData = { id: docSnapshot.id, ...docSnapshot.data() } as AudioProject;
          setProject(projectData);

          // Load audio files
          if (projectData.originalAudioUrl) {
            try {
              const url = await getDownloadURL(getStorageRef(projectData.originalAudioUrl));
              setOriginalAudioUrl(url);
            } catch (error) {
              console.error('Error loading original audio:', error);
            }
          }

          if (projectData.modifiedAudioUrl) {
            try {
              const url = await getDownloadURL(getStorageRef(projectData.modifiedAudioUrl));
              setModifiedAudioUrl(url);
            } catch (error) {
              console.error('Error loading modified audio:', error);
            }
          }

          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    const originalAudio = originalAudioRef.current;

    if (originalAudio) {
      const handleTimeUpdate = () => setOriginalCurrentTime(originalAudio.currentTime);
      const handleDurationChange = () => setOriginalDuration(originalAudio.duration);
      const handlePlay = () => setIsPlayingOriginal(true);
      const handlePause = () => setIsPlayingOriginal(false);
      const handleEnded = () => setIsPlayingOriginal(false);

      originalAudio.addEventListener('timeupdate', handleTimeUpdate);
      originalAudio.addEventListener('durationchange', handleDurationChange);
      originalAudio.addEventListener('play', handlePlay);
      originalAudio.addEventListener('pause', handlePause);
      originalAudio.addEventListener('ended', handleEnded);

      return () => {
        originalAudio.removeEventListener('timeupdate', handleTimeUpdate);
        originalAudio.removeEventListener('durationchange', handleDurationChange);
        originalAudio.removeEventListener('play', handlePlay);
        originalAudio.removeEventListener('pause', handlePause);
        originalAudio.removeEventListener('ended', handleEnded);
      };
    }
  }, [originalAudioUrl]);

  useEffect(() => {
    // const modifiedAudio = modifiedAudioRef.current;

    if (modifiedAudioRef.current) {
      const modifiedAudio = modifiedAudioRef.current;
      const handleTimeUpdate = () => setModifiedCurrentTime(modifiedAudio.currentTime);
      const handleDurationChange = () => setModifiedDuration(modifiedAudio.duration);
      const handlePlay = () => setIsPlayingModified(true);
      const handlePause = () => setIsPlayingModified(false);
      const handleEnded = () => setIsPlayingModified(false);

      modifiedAudio.addEventListener('timeupdate', handleTimeUpdate);
      modifiedAudio.addEventListener('durationchange', handleDurationChange);
      modifiedAudio.addEventListener('play', handlePlay);
      modifiedAudio.addEventListener('pause', handlePause);
      modifiedAudio.addEventListener('ended', handleEnded);

      return () => {
        modifiedAudio.removeEventListener('timeupdate', handleTimeUpdate);
        modifiedAudio.removeEventListener('durationchange', handleDurationChange);
        modifiedAudio.removeEventListener('play', handlePlay);
        modifiedAudio.removeEventListener('pause', handlePause);
        modifiedAudio.removeEventListener('ended', handleEnded);
      };
    }
  }, [modifiedAudioUrl]);

  const toggleOriginalPlayback = () => {
    if (!originalAudioRef.current) return;

    if (isPlayingOriginal) {
      originalAudioRef.current.pause();
    } else {
      // Stop modified audio if playing
      if (modifiedAudioRef.current && isPlayingModified) {
        modifiedAudioRef.current.pause();
      }
      originalAudioRef.current.play();
    }
  };

  const toggleModifiedPlayback = () => {
    if (!modifiedAudioRef.current) return;

    if (isPlayingModified) {
      modifiedAudioRef.current.pause();
    } else {
      // Stop original audio if playing
      if (originalAudioRef.current && isPlayingOriginal) {
        originalAudioRef.current.pause();
      }
      modifiedAudioRef.current.play();
    }
  };

  const handleSeekOriginal = (_event: Event, newValue: number | number[]) => {
    if (!originalAudioRef.current) return;
    const time = Array.isArray(newValue) ? newValue[0] : newValue;
    originalAudioRef.current.currentTime = time;
    setOriginalCurrentTime(time);
  };

  const handleSeekModified = (_event: Event, newValue: number | number[]) => {
    if (!modifiedAudioRef.current) return;
    const time = Array.isArray(newValue) ? newValue[0] : newValue;
    modifiedAudioRef.current.currentTime = time;
    setModifiedCurrentTime(time);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDeleteProject = async () => {
    try {
      await deleteDoc(doc(db, 'audioProjects', projectId!));
      setDeleteDialog(false);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const handleShare = () => {
    // For now, just show an alert - sharing implementation would require additional setup
    alert('Sharing functionality will be implemented in a future update');
  };

  const handleBack = () => {
    navigate('/');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  if (!project) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography variant="h6" color="error">
          Project not found
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          {project.title}
        </Typography>
        <Button variant="outlined" onClick={handleBack}>
          Back to Projects
        </Button>
      </Box>

      <Box display="grid" gridTemplateColumns={{ xs: '1fr', md: '1fr 1fr' }} gap={3} mb={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Original Audio
            </Typography>
            
            {originalAudioUrl && (
              <>
                <audio ref={originalAudioRef} src={originalAudioUrl} preload="metadata" />
                
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <IconButton onClick={toggleOriginalPlayback} size="large">
                    {isPlayingOriginal ? <Pause /> : <PlayArrow />}
                  </IconButton>
                  
                  <Box flex={1}>
                    <Slider
                      value={originalCurrentTime}
                      onChange={handleSeekOriginal}
                      max={originalDuration || 0}
                      disabled={!originalDuration}
                      sx={{ mx: 1 }}
                    />
                  </Box>
                  
                  <Typography variant="body2" minWidth={80}>
                    {formatTime(originalCurrentTime)} / {formatTime(originalDuration)}
                  </Typography>
                </Box>
              </>
            )}
            
            <Typography variant="body2" color="text.secondary">
              Original recording
            </Typography>
          </CardContent>
        </Card>

        {project.modifiedAudioUrl && (
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Modified Audio
              </Typography>
              
              {modifiedAudioUrl && (
                <>
                  <audio ref={modifiedAudioRef} src={modifiedAudioUrl} preload="metadata" />
                  
                  <Box display="flex" alignItems="center" gap={2} mb={2}>
                    <IconButton onClick={toggleModifiedPlayback} size="large">
                      {isPlayingModified ? <Pause /> : <PlayArrow />}
                    </IconButton>
                    
                    <Box flex={1}>
                      <Slider
                        value={modifiedCurrentTime}
                        onChange={handleSeekModified}
                        max={modifiedDuration || 0}
                        disabled={!modifiedDuration}
                        sx={{ mx: 1 }}
                      />
                    </Box>
                    
                    <Typography variant="body2" minWidth={80}>
                      {formatTime(modifiedCurrentTime)} / {formatTime(modifiedDuration)}
                    </Typography>
                  </Box>
                </>
              )}
              
              <Typography variant="body2" color="text.secondary">
                AI generated with your edits
              </Typography>
            </CardContent>
          </Card>
        )}
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Final Transcription
          </Typography>
          <Typography variant="body1" sx={{ 
            backgroundColor: 'grey.50', 
            p: 2, 
            borderRadius: 1,
            fontFamily: 'monospace',
            lineHeight: 1.6
          }}>
            {project.editedTranscription || 'No transcription available'}
          </Typography>
        </CardContent>
      </Card>

      <Box display="flex" gap={2} justifyContent="center">
        <Button
          variant="contained"
          startIcon={<Share />}
          onClick={handleShare}
          size="large"
        >
          Share Project
        </Button>
        
        <Button
          variant="contained"
          color="error"
          startIcon={<Delete />}
          onClick={() => setDeleteDialog(true)}
          size="large"
        >
          Delete Project
        </Button>
      </Box>

      <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)}>
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
