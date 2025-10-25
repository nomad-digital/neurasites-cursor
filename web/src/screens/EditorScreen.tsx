import { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Slider,
  IconButton,
  TextField,
} from '@mui/material';
import { PlayArrow, Pause, Save, Delete } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { getDownloadURL } from 'firebase/storage';
import { db, getStorageRef } from '../utils/firebase';
import type { AudioClip } from '../types';

export default function EditorScreen() {
  const { clipId } = useParams<{ clipId: string }>();
  const navigate = useNavigate();
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const [clip, setClip] = useState<AudioClip | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const [clipTitle, setClipTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!clipId) return;

    // Listen to clip changes
    const unsubscribe = onSnapshot(
      doc(db, 'audioClips', clipId),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const clipData = { id: docSnapshot.id, ...docSnapshot.data() } as AudioClip;
          setClip(clipData);
          setClipTitle(clipData.title);

          // Load audio file
          if (clipData.audioUrl) {
            try {
              const url = await getDownloadURL(getStorageRef(clipData.audioUrl));
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
  }, [clipId]);

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      const audio = audioRef.current;
      
      const handleTimeUpdate = () => {
        const time = audio.currentTime;
        setCurrentTime(time);

        // Stop playback if we reach the trim end
        if (clip && clip.trimEnd !== undefined && time >= clip.trimEnd) {
          audio.pause();
          audio.currentTime = clip.trimStart || 0;
        }
      };

      const handleDurationChange = () => {
        const dur = audio.duration;
        setDuration(dur);
        
        // Initialize trim range if not set
        if (clip && trimRange[0] === 0 && trimRange[1] === 0) {
          const start = clip.trimStart || 0;
          const end = clip.trimEnd || dur;
          setTrimRange([start, end]);
        }
      };

      const handlePlay = () => setIsPlaying(true);
      const handlePause = () => setIsPlaying(false);
      const handleEnded = () => {
        setIsPlaying(false);
        // Reset to trim start if set
        if (clip && clip.trimStart !== undefined) {
          audio.currentTime = clip.trimStart;
        }
      };

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
  }, [audioUrl, clip, trimRange]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      // Start from trim start if we're before it
      if (clip && clip.trimStart !== undefined && audioRef.current.currentTime < clip.trimStart) {
        audioRef.current.currentTime = clip.trimStart;
      }
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
      setTrimRange([newValue[0], newValue[1]]);
    }
  };

  const handleSetTrimStart = () => {
    setTrimRange([currentTime, trimRange[1]]);
  };

  const handleSetTrimEnd = () => {
    setTrimRange([trimRange[0], currentTime]);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSave = async () => {
    if (!clip) return;

    setSaving(true);
    setError('');
    
    try {
      await updateDoc(doc(db, 'audioClips', clip.id), {
        title: clipTitle.trim() || clip.title,
        trimStart: trimRange[0],
        trimEnd: trimRange[1],
        updatedAt: new Date(),
      });

      navigate('/');
    } catch (error: any) {
      setError(error.message || 'Failed to save clip');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!clip || !window.confirm('Are you sure you want to delete this clip?')) return;

    try {
      await deleteDoc(doc(db, 'audioClips', clip.id));
      navigate('/');
    } catch (error) {
      console.error('Failed to delete clip:', error);
      setError('Failed to delete clip');
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

  if (!clip) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <Typography variant="h6" color="error">
          Clip not found
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Edit Clip
        </Typography>
        <Button variant="outlined" onClick={handleBack}>
          Back to Soundboard
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            label="Clip Name"
            value={clipTitle}
            onChange={(e) => setClipTitle(e.target.value)}
            sx={{ mb: 3 }}
          />
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Audio Player
          </Typography>
          
          {audioUrl && (
            <>
              <audio ref={audioRef} src={audioUrl} preload="metadata" />
              
              <Box display="flex" alignItems="center" gap={2} mb={3}>
                <IconButton onClick={togglePlayPause} size="large" color="primary">
                  {isPlaying ? <Pause sx={{ fontSize: 40 }} /> : <PlayArrow sx={{ fontSize: 40 }} />}
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
                
                <Typography variant="body2" minWidth={100}>
                  {formatTime(currentTime)} / {formatTime(duration)}
                </Typography>
              </Box>

              <Box sx={{ 
                backgroundColor: 'grey.100', 
                p: 2, 
                borderRadius: 1,
                mb: 2 
              }}>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  Trim Range
                </Typography>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Use the slider below to select the portion of audio to keep
                </Typography>
                
                <Box sx={{ px: 2, py: 3 }}>
                  <Slider
                    value={trimRange}
                    onChange={handleTrimChange}
                    min={0}
                    max={duration || 0}
                    disabled={!duration}
                    valueLabelDisplay="auto"
                    valueLabelFormat={formatTime}
                    sx={{ 
                      '& .MuiSlider-thumb': {
                        width: 16,
                        height: 16,
                      },
                      '& .MuiSlider-track': {
                        height: 8,
                      },
                      '& .MuiSlider-rail': {
                        height: 8,
                        opacity: 0.3,
                      }
                    }}
                  />
                </Box>

                <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Start: {formatTime(trimRange[0])}
                    </Typography>
                    <Button size="small" onClick={handleSetTrimStart} variant="outlined">
                      Set to Current Time
                    </Button>
                  </Box>
                  
                  <Typography variant="body1" fontWeight="bold">
                    Duration: {formatTime(trimRange[1] - trimRange[0])}
                  </Typography>
                  
                  <Box>
                    <Typography variant="body2" color="text.secondary" textAlign="right">
                      End: {formatTime(trimRange[1])}
                    </Typography>
                    <Button size="small" onClick={handleSetTrimEnd} variant="outlined">
                      Set to Current Time
                    </Button>
                  </Box>
                </Box>
              </Box>

              <Alert severity="info">
                The trimmed portion will be the only part that plays when you press the button on your soundboard.
              </Alert>
            </>
          )}
        </CardContent>
      </Card>

      <Box display="flex" gap={2} justifyContent="space-between">
        <Button
          variant="contained"
          color="error"
          startIcon={<Delete />}
          onClick={handleDelete}
          size="large"
        >
          Delete Clip
        </Button>

        <Button
          variant="contained"
          startIcon={<Save />}
          onClick={handleSave}
          disabled={saving}
          size="large"
          sx={{ minWidth: 150 }}
        >
          {saving ? <CircularProgress size={24} color="inherit" /> : 'Save Clip'}
        </Button>
      </Box>
    </Box>
  );
}
