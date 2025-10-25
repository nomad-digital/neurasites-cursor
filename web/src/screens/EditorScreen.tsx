import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Slider,
  IconButton,
  Divider,
} from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { db, getStorageRef, functions } from '../utils/firebase';
import type { AudioProject } from '../types';

export default function EditorScreen() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  // const wavesurferRef = useRef<any>(null); // Will be used for waveform visualization
  
  const [project, setProject] = useState<AudioProject | null>(null);
  const [editedTranscription, setEditedTranscription] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trimRange, setTrimRange] = useState<number[]>([0, 0]);
  const [clipTitle, setClipTitle] = useState('');
  const [savingClip, setSavingClip] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  useEffect(() => {
    if (!projectId) return;

    // Listen to project changes
    const unsubscribe = onSnapshot(
      doc(db, 'audioProjects', projectId),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const projectData = { id: docSnapshot.id, ...docSnapshot.data() } as AudioProject;
          setProject(projectData);
          setEditedTranscription(projectData.editedTranscription || '');

          // Load audio file
          if (projectData.originalAudioUrl) {
            try {
              const url = await getDownloadURL(getStorageRef(projectData.originalAudioUrl));
              setAudioUrl(url);
            } catch (error) {
              console.error('Error loading audio:', error);
              setError('Failed to load audio file');
            }
          }

          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [projectId]);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
      const handleDurationChange = () => {
        setDuration(audio.duration);
        if (trimRange[1] === 0 && audio.duration) {
          const initialEnd = Math.min(5, Math.floor(audio.duration));
          setTrimRange([0, initialEnd]);
        }
      };
      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => setIsPlaying(false);

      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('durationchange', handleDurationChange);
      audio.addEventListener('play', handlePlay);
      audio.addEventListener('pause', handlePause);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('durationchange', handleDurationChange);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
      };
    }
  }, [audioUrl]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };

  const handleSeek = (_event: Event, newValue: number | number[]) => {
    if (!audioRef.current) return;
    const time = Array.isArray(newValue) ? newValue[0] : newValue;
    audioRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const handleTrimChange = (_event: Event, newValue: number | number[]) => {
    if (Array.isArray(newValue)) {
      const [start, end] = newValue;
      setTrimRange([Math.max(0, start), Math.min(duration || end, end)]);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSaveClip = async () => {
    if (!project) return;
    const [start, end] = trimRange;
    if (end <= start) {
      setError('Invalid trim range');
      return;
    }
    setSavingClip(true);
    setError('');
    setSaveMessage('');
    try {
      const createClip = httpsCallable(functions, 'createTrimmedClipFunction');
      await createClip({ projectId: project.id, startTime: start, endTime: end, title: clipTitle || project.title });
      setSaveMessage('Clip saved to your soundboard');
      setClipTitle('');
    } catch (e: any) {
      setError(e?.message || 'Failed to save clip');
    } finally {
      setSavingClip(false);
    }
  };

  const handleGenerateAudio = async () => {
    if (!project || !editedTranscription.trim()) {
      setError('Please edit the transcription first');
      return;
    }

    setGenerating(true);
    setError('');
    
    try {
      const generateFunction = httpsCallable(functions, 'generateModifiedAudioFunction');
      await generateFunction({
        projectId: project.id,
        editedTranscription: editedTranscription.trim(),
      });

      setError('Audio generation started! Check back in a few minutes.');
    } catch (error: any) {
      setError(error.message || 'Failed to generate audio');
    } finally {
      setGenerating(false);
    }
  };

  const saveTranscription = async () => {
    if (!project) return;

    try {
      await updateDoc(doc(db, 'audioProjects', project.id), {
        editedTranscription,
        updatedAt: new Date(),
      });
    } catch (error) {
      console.error('Error saving transcription:', error);
      setError('Failed to save transcription');
    }
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

      {error && (
        <Alert severity={error.includes('started') ? 'success' : 'error'} sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Audio Player
          </Typography>
          
          {audioUrl && (
            <>
              <audio ref={audioRef} src={audioUrl} preload="metadata" />
              
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <IconButton onClick={togglePlayPause} size="large">
                  {isPlaying ? <Pause /> : <PlayArrow />}
                </IconButton>
                
                <Box flex={1}>
                  <Slider
                    value={currentTime}
                    onChange={handleSeek}
                    max={duration || 0}
                    disabled={!duration}
                    sx={{ mx: 1 }}
                  />
                </Box>
                
                <Typography variant="body2" minWidth={80}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Typography>
              </Box>

              <Typography variant="body2" color="text.secondary">
                Status: {project.status}
              </Typography>
            </>
          )}
        </CardContent>
      </Card>

      {audioUrl && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Trim Clip
            </Typography>
            {saveMessage && (
              <Alert severity="success" sx={{ mb: 2 }}>{saveMessage}</Alert>
            )}
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <Typography variant="body2" minWidth={48}>{formatTime(trimRange[0])}</Typography>
              <Box flex={1}>
                <Slider
                  value={trimRange}
                  onChange={handleTrimChange}
                  max={duration || 0}
                  disabled={!duration}
                />
              </Box>
              <Typography variant="body2" minWidth={48}>{formatTime(trimRange[1])}</Typography>
            </Box>

            <Box display="flex" gap={2} alignItems="center">
              <TextField
                label="Clip title"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                size="small"
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                onClick={handleSaveClip}
                disabled={savingClip || !duration || trimRange[1] <= trimRange[0]}
              >
                {savingClip ? <CircularProgress size={20} color="inherit" /> : 'Save to Soundboard'}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Transcription Editor
          </Typography>
          
          <TextField
            fullWidth
            multiline
            rows={8}
            value={editedTranscription}
            onChange={(e) => setEditedTranscription(e.target.value)}
            onBlur={saveTranscription}
            placeholder="Edit the transcription here..."
            disabled={project.status !== 'ready' && project.status !== 'completed'}
            sx={{ mb: 2 }}
          />
          
          <Typography variant="body2" color="text.secondary">
            {project.status === 'ready' || project.status === 'completed' 
              ? 'You can edit the transcription above. Changes are saved automatically.'
              : 'Transcription is being processed. Please wait...'
            }
          </Typography>
        </CardContent>
      </Card>

      {project.status === 'ready' && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Button
              variant="contained"
              size="large"
              onClick={handleGenerateAudio}
              disabled={generating}
              fullWidth
              sx={{ py: 1.5 }}
            >
              {generating ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Generate Modified Audio'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {project.status === 'completed' && project.modifiedAudioUrl && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Audio Generation Complete
            </Typography>
            <Typography variant="body1" paragraph>
              Your modified audio has been generated successfully!
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate(`/playback/${project.id}`)}
              fullWidth
              sx={{ py: 1.5 }}
            >
              Play Modified Audio
            </Button>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
