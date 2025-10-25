import { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Button,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
} from '@mui/material';
import { Delete, PlayArrow, Edit, Add } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  deleteDoc,
  getDocs,
  limit,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from '../utils/firebase';
import type { AudioProject, SoundClip } from '../types';
import { getDownloadURL } from 'firebase/storage';
import { getStorageRef } from '../utils/firebase';

export default function HomeScreen() {
  const [projects, setProjects] = useState<AudioProject[]>([]);
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [clipsLoading, setClipsLoading] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; projectId: string | null }>({
    open: false,
    projectId: null,
  });
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const projectsQuery = query(
      collection(db, 'audioProjects'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(projectsQuery, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AudioProject[];
      
      setProjects(projectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const clipsQuery = query(
      collection(db, 'soundClips'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(clipsQuery, (snapshot) => {
      const clipsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as SoundClip[];

      setClips(clipsData);
      setClipsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleDeleteProject = async () => {
    if (!deleteDialog.projectId) return;

    try {
      await deleteDoc(doc(db, 'audioProjects', deleteDialog.projectId));
      setDeleteDialog({ open: false, projectId: null });
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'failed': return 'error';
      case 'transcribing':
      case 'generating': return 'warning';
      default: return 'info';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading': return 'Uploading...';
      case 'transcribing': return 'Transcribing...';
      case 'ready': return 'Ready to edit';
      case 'generating': return 'Generating audio...';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      default: return status;
    }
  };

  // Inline sound clip button component
  function SoundClipButton({ clip }: { clip: SoundClip }) {
    const [url, setUrl] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
      let mounted = true;
      (async () => {
        try {
          const u = await getDownloadURL(getStorageRef(clip.storagePath));
          if (mounted) setUrl(u);
        } catch (e) {
          // noop
        }
      })();
      return () => { mounted = false; };
    }, [clip.storagePath]);

    useEffect(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const onEnded = () => setIsPlaying(false);
      audio.addEventListener('ended', onEnded);
      return () => audio.removeEventListener('ended', onEnded);
    }, [url]);

    const toggle = () => {
      if (!audioRef.current) return;
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        // stop any other playing audio tags on page
        document.querySelectorAll('audio').forEach(a => {
          if (a !== audioRef.current) a.pause();
        });
        audioRef.current.currentTime = 0;
        audioRef.current.play();
        setIsPlaying(true);
      }
    };

    return (
      <Card sx={{ p: 1, textAlign: 'center', bgcolor: 'grey.50' }}>
        <CardContent>
          {url && <audio ref={audioRef} src={url} preload="metadata" />}
          <Tooltip title={`${clip.title} (${Math.round(clip.duration)}s)`}>
            <Button variant="contained" fullWidth onClick={toggle} sx={{ py: 2 }}>
              {clip.title}
            </Button>
          </Tooltip>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Soundboard
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/upload')}
          size="large"
          startIcon={<Add />}
        >
          New Clip
        </Button>
      </Box>

      {/* Clips grid */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Your Clips
        </Typography>
        {clipsLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={120}>
            <CircularProgress />
          </Box>
        ) : clips.length === 0 ? (
          <Card sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body1">No clips yet. Create one from an uploaded audio.</Typography>
          </Card>
        ) : (
          <Grid container spacing={2}>
            {clips.map((clip) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={clip.id}>
                <SoundClipButton clip={clip} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Projects list under the soundboard for editing source audio */}
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">Projects</Typography>
          <Button variant="outlined" onClick={() => navigate('/upload')}>New Project</Button>
        </Box>

        {projects.length === 0 ? (
          <Card sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>
              No Projects Yet
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Create your first audio project by uploading an audio file
            </Typography>
            <Button
              variant="contained"
              size="large"
              onClick={() => navigate('/upload')}
            >
              Create New Project
            </Button>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {projects.map((project) => (
              <Grid item xs={12} sm={6} md={4} key={project.id}>
                <Card>
                  <CardContent>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h2" noWrap sx={{ flexGrow: 1, mr: 1 }}>
                        {project.title}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => setDeleteDialog({ open: true, projectId: project.id })}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </Box>

                    <Alert 
                      severity={getStatusColor(project.status)} 
                      sx={{ mb: 2 }}
                    >
                      {getStatusText(project.status)}
                    </Alert>

                    <Typography variant="body2" color="text.secondary">
                      Created: {project.createdAt?.toDate?.()?.toLocaleDateString() || 'Unknown date'}
                    </Typography>
                  </CardContent>

                  <CardActions>
                    <Button
                      size="small"
                      startIcon={<Edit />}
                      onClick={() => navigate(`/editor/${project.id}`)}
                      disabled={project.status !== 'ready' && project.status !== 'completed'}
                    >
                      Edit
                    </Button>
                    
                    {project.status === 'completed' && project.modifiedAudioUrl && (
                      <Button
                        size="small"
                        startIcon={<PlayArrow />}
                        onClick={() => navigate(`/playback/${project.id}`)}
                      >
                        Play
                      </Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      <Dialog
        open={deleteDialog.open}
        onClose={() => setDeleteDialog({ open: false, projectId: null })}
      >
        <DialogTitle>Delete Project</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete this project? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, projectId: null })}>
            Cancel
          </Button>
          <Button onClick={handleDeleteProject} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
