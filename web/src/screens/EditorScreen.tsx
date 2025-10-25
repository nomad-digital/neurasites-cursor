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
  Stack,
  TextField,
} from '@mui/material';
import { PlayArrow, Pause } from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, doc, onSnapshot, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { getDownloadURL, uploadBytesResumable } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, getStorageRef, functions } from '../utils/firebase';
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
  const [trimRange, setTrimRange] = useState<[number, number]>([0, 0]);
  const [savingClip, setSavingClip] = useState(false);
  const [clipTitle, setClipTitle] = useState('');

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
      const handleDurationChange = () => setDuration(audio.duration);
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

  useEffect(() => {
    if (duration > 0) {
      setTrimRange([0, duration]);
    }
  }, [duration]);

  useEffect(() => {
    if (project?.title) {
      setClipTitle(`${project.title}`);
    }
  }, [project?.title]);

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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTrimChange = (_event: Event, newValue: number | number[]) => {
    if (!Array.isArray(newValue)) return;
    const [start, end] = newValue as [number, number];
    if (start >= 0 && end <= (duration || 0) && start < end) {
      setTrimRange([start, end]);
    }
  };

  const audioBufferToWav = (buffer: AudioBuffer): ArrayBuffer => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const numFrames = buffer.length;
    const bytesPerSample = 2; // 16-bit PCM
    const blockAlign = numChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = numFrames * blockAlign;
    const bufferSize = 44 + dataSize;

    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    // RIFF header
    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, 'WAVE');

    // fmt chunk
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM chunk size
    view.setUint16(20, 1, true); // Audio format 1 = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, 16, true);

    // data chunk
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Interleave and convert to 16-bit
    let offset = 44;
    const interleaved = new Float32Array(numFrames * numChannels);
    for (let channel = 0; channel < numChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < numFrames; i++) {
        interleaved[i * numChannels + channel] = channelData[i];
      }
    }

    for (let i = 0; i < interleaved.length; i++) {
      let sample = Math.max(-1, Math.min(1, interleaved[i]));
      sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, sample as number, true);
      offset += 2;
    }

    return arrayBuffer;
  };

  const saveAsSoundClip = async () => {
    if (!audioUrl || !project) return;
    const user = auth.currentUser;
    if (!user) {
      setError('Please sign in first');
      return;
    }

    const [startSec, endSec] = trimRange;
    if (!(endSec > startSec)) return;

    setSavingClip(true);
    setError('');

    try {
      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const decoded = await audioContext.decodeAudioData(arrayBuffer.slice(0));

      const sampleRate = decoded.sampleRate;
      const startSample = Math.floor(startSec * sampleRate);
      const endSample = Math.min(Math.floor(endSec * sampleRate), decoded.length);
      const frameCount = Math.max(0, endSample - startSample);
      if (frameCount <= 0) throw new Error('Invalid trim range');

      const numChannels = decoded.numberOfChannels;
      const clipped = audioContext.createBuffer(numChannels, frameCount, sampleRate);
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = decoded.getChannelData(ch).subarray(startSample, endSample);
        clipped.copyToChannel(channelData, ch, 0);
      }

      const wavBuffer = audioBufferToWav(clipped);
      const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

      const clipsCol = collection(db, 'soundClips');
      const clipRef = doc(clipsCol);
      const clipId = clipRef.id;
      const storagePath = `users/${user.uid}/clips/${clipId}.wav`;

      // Upload WAV to storage
      const uploadTask = uploadBytesResumable(getStorageRef(storagePath), wavBlob, { contentType: 'audio/wav' });
      await new Promise<void>((resolve, reject) => {
        uploadTask.on('state_changed', undefined, (err) => reject(err), () => resolve());
      });

      // Create Firestore doc
      await setDoc(clipRef, {
        id: clipId,
        userId: user.uid,
        title: clipTitle?.trim() || project.title || 'Clip',
        storagePath,
        duration: endSec - startSec,
        sourceProjectId: project.id,
        sourceStartSec: startSec,
        sourceEndSec: endSec,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      navigate('/');
    } catch (e: any) {
      console.error(e);
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

            <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2 }}>
              <Typography variant="body2" minWidth={56}>{formatTime(trimRange[0] || 0)}</Typography>
              <Box flex={1}>
                <Slider
                  value={trimRange}
                  onChange={handleTrimChange}
                  valueLabelDisplay="auto"
                  min={0}
                  max={duration || 0}
                  step={0.01}
                  disabled={!duration}
                />
              </Box>
              <Typography variant="body2" minWidth={56}>{formatTime(trimRange[1] || 0)}</Typography>
            </Stack>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Clip Title"
                value={clipTitle}
                onChange={(e) => setClipTitle(e.target.value)}
                fullWidth
              />
              <Button
                variant="contained"
                size="large"
                onClick={saveAsSoundClip}
                disabled={savingClip || !duration || trimRange[1] - trimRange[0] <= 0.1}
              >
                {savingClip ? <CircularProgress size={24} color="inherit" /> : 'Save as Sound Clip'}
              </Button>
            </Stack>
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
