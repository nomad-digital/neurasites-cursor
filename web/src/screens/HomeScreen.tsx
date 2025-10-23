import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { Delete, PlayArrow, Edit } from '@mui/icons-material';
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
import { auth, db } from '../utils/firebase';
import { AudioProject } from '../types';

export default function HomeScreen() {
  const [projects, setProjects] = useState<AudioProject[]>([]);
  const [loading, setLoading] = useState(true);
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
          Audio Editor
        </Typography>
        <Button
          variant="contained"
          onClick={() => navigate('/upload')}
          size="large"
        >
          New Project
        </Button>
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
                    size="small"
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
