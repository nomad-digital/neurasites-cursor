import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Card,
  CardContent,
  CircularProgress,
} from '@mui/material';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { getDownloadURL } from 'firebase/storage';
import { auth, db, getStorageRef } from '../utils/firebase';
import type { SoundClip } from '../types';

export default function SoundboardScreen() {
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [clipUrls, setClipUrls] = useState<Record<string, string>>({});
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const q = query(
      collection(db, 'soundClips'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as SoundClip[];
      setClips(list);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    let canceled = false;
    async function loadUrls() {
      const missing = clips.filter((c) => !clipUrls[c.id]);
      if (missing.length === 0) return;
      const entries = await Promise.all(
        missing.map(async (clip) => {
          try {
            const url = await getDownloadURL(getStorageRef(clip.audioStoragePath));
            return [clip.id, url] as const;
          } catch {
            return [clip.id, ''] as const;
          }
        })
      );
      if (!canceled) {
        setClipUrls((prev) => {
          const next = { ...prev };
          entries.forEach(([id, url]) => {
            if (url) next[id] = url;
          });
          return next;
        });
      }
    }
    loadUrls();
    return () => {
      canceled = true;
    };
  }, [clips]);

  const playClip = (clipId: string) => {
    const url = clipUrls[clipId];
    if (!url) return;

    const existing = audioRefs.current[clipId];
    if (existing) {
      existing.pause();
      existing.currentTime = 0;
    }

    const audio = new Audio(url);
    audioRefs.current[clipId] = audio;
    void audio.play();
  };

  const stopAll = () => {
    Object.values(audioRefs.current).forEach((a) => {
      try {
        a.pause();
        a.currentTime = 0;
      } catch {
        // ignore
      }
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">Soundboard</Typography>
        <Button variant="outlined" onClick={stopAll}>Stop All</Button>
      </Box>

      {clips.length === 0 ? (
        <Card>
          <CardContent>
            <Typography>No clips yet. Create one from the editor.</Typography>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {clips.map((clip) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={clip.id}>
              <Button
                variant="contained"
                fullWidth
                onClick={() => playClip(clip.id)}
                sx={{
                  height: 100,
                  fontSize: 16,
                  fontWeight: 600,
                  bgcolor: clip.color || 'primary.main',
                }}
                disabled={!clipUrls[clip.id]}
              >
                {clip.title}
              </Button>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
