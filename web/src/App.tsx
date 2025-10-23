import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, CircularProgress, Box, Typography } from '@mui/material';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './utils/firebase';

// Import screens
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import EditorScreen from './screens/EditorScreen';
import PlaybackScreen from './screens/PlaybackScreen';

const theme = createTheme({
  palette: {
    primary: {
      main: '#007AFF',
    },
    secondary: {
      main: '#34C759',
    },
  },
});

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          flexDirection="column"
        >
          <CircularProgress size={60} />
          <Typography variant="h6" sx={{ mt: 2 }}>
            Loading...
          </Typography>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          {user ? (
            // User is signed in
            <>
              <Route path="/" element={<HomeScreen />} />
              <Route path="/upload" element={<UploadScreen />} />
              <Route path="/editor/:projectId" element={<EditorScreen />} />
              <Route path="/playback/:projectId" element={<PlaybackScreen />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            // User is not signed in
            <>
              <Route path="/auth" element={<AuthScreen />} />
              <Route path="*" element={<Navigate to="/auth" replace />} />
            </>
          )}
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
