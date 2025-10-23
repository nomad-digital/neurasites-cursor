import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { firestore, storage } from '../utils/firebase';
import { doc, onSnapshot, deleteDoc } from '@react-native-firebase/firestore';
import { getDownloadURL } from '@react-native-firebase/storage';
import { AudioProject } from '../types';

interface PlaybackScreenProps {
  navigation: any;
  route: any;
}

export default function PlaybackScreen({ navigation, route }: PlaybackScreenProps) {
  const { projectId } = route.params;
  const [project, setProject] = useState<AudioProject | null>(null);
  const [originalAudioUrl, setOriginalAudioUrl] = useState<string | null>(null);
  const [modifiedAudioUrl, setModifiedAudioUrl] = useState<string | null>(null);
  const [originalSound, setOriginalSound] = useState<Audio.Sound | null>(null);
  const [modifiedSound, setModifiedSound] = useState<Audio.Sound | null>(null);
  const [isPlayingOriginal, setIsPlayingOriginal] = useState(false);
  const [isPlayingModified, setIsPlayingModified] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    // Listen to project changes
    const unsubscribe = onSnapshot(
      doc(firestore(), 'audioProjects', projectId),
      async (docSnapshot) => {
        if (docSnapshot.exists()) {
          const projectData = { id: docSnapshot.id, ...docSnapshot.data() } as AudioProject;
          setProject(projectData);

          // Load audio files
          if (projectData.originalAudioUrl) {
            try {
              const url = await getDownloadURL(storage().ref(projectData.originalAudioUrl));
              setOriginalAudioUrl(url);
            } catch (error) {
              console.error('Error loading original audio:', error);
            }
          }

          if (projectData.modifiedAudioUrl) {
            try {
              const url = await getDownloadURL(storage().ref(projectData.modifiedAudioUrl));
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
    return () => {
      // Clean up audio when component unmounts
      if (originalSound) {
        originalSound.unloadAsync();
      }
      if (modifiedSound) {
        modifiedSound.unloadAsync();
      }
    };
  }, [originalSound, modifiedSound]);

  const loadOriginalAudio = async () => {
    if (!originalAudioUrl) return;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: originalAudioUrl },
        { shouldPlay: false }
      );
      
      setOriginalSound(sound);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlayingOriginal(status.isPlaying || false);
        }
      });
    } catch (error) {
      console.error('Error loading original audio:', error);
    }
  };

  const loadModifiedAudio = async () => {
    if (!modifiedAudioUrl) return;

    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: modifiedAudioUrl },
        { shouldPlay: false }
      );
      
      setModifiedSound(sound);
      
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setIsPlayingModified(status.isPlaying || false);
        }
      });
    } catch (error) {
      console.error('Error loading modified audio:', error);
    }
  };

  const toggleOriginalPlayback = async () => {
    if (!originalSound) {
      await loadOriginalAudio();
      return;
    }

    try {
      if (isPlayingOriginal) {
        await originalSound.pauseAsync();
      } else {
        // Stop modified audio if playing
        if (modifiedSound && isPlayingModified) {
          await modifiedSound.pauseAsync();
        }
        await originalSound.playAsync();
      }
    } catch (error) {
      console.error('Error controlling original audio:', error);
    }
  };

  const toggleModifiedPlayback = async () => {
    if (!modifiedSound) {
      await loadModifiedAudio();
      return;
    }

    try {
      if (isPlayingModified) {
        await modifiedSound.pauseAsync();
      } else {
        // Stop original audio if playing
        if (originalSound && isPlayingOriginal) {
          await originalSound.pauseAsync();
        }
        await modifiedSound.playAsync();
      }
    } catch (error) {
      console.error('Error controlling modified audio:', error);
    }
  };

  const handleDeleteProject = () => {
    Alert.alert(
      'Delete Project',
      'Are you sure you want to delete this project? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(firestore(), 'audioProjects', projectId));
              navigation.goBack();
            } catch (error) {
              Alert.alert('Error', 'Failed to delete project');
            }
          }
        }
      ]
    );
  };

  const handleShare = async () => {
    // For now, just show an alert - sharing implementation would require additional setup
    Alert.alert('Share', 'Sharing functionality will be implemented in a future update');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading project...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!project) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Project not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.header}>
          <Text style={styles.title}>{project.title}</Text>
          <Text style={styles.statusText}>Status: {project.status}</Text>
        </View>

        <View style={styles.audioSection}>
          <Text style={styles.sectionTitle}>Original Audio</Text>
          <View style={styles.audioPlayer}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={toggleOriginalPlayback}
            >
              <Text style={styles.playButtonText}>
                {isPlayingOriginal ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>
            <View style={styles.audioInfo}>
              <Text style={styles.audioLabel}>Original Recording</Text>
              <Text style={styles.audioStatus}>
                {isPlayingOriginal ? 'Playing...' : 'Ready to play'}
              </Text>
            </View>
          </View>
        </View>

        {project.modifiedAudioUrl && (
          <View style={styles.audioSection}>
            <Text style={styles.sectionTitle}>Modified Audio</Text>
            <View style={styles.audioPlayer}>
              <TouchableOpacity
                style={[styles.playButton, styles.modifiedPlayButton]}
                onPress={toggleModifiedPlayback}
              >
                <Text style={styles.playButtonText}>
                  {isPlayingModified ? '⏸️' : '▶️'}
                </Text>
              </TouchableOpacity>
              <View style={styles.audioInfo}>
                <Text style={styles.audioLabel}>AI Generated</Text>
                <Text style={styles.audioStatus}>
                  {isPlayingModified ? 'Playing...' : 'Ready to play'}
                </Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.transcriptionSection}>
          <Text style={styles.sectionTitle}>Final Transcription</Text>
          <View style={styles.transcriptionBox}>
            <Text style={styles.transcriptionText}>
              {project.editedTranscription || 'No transcription available'}
            </Text>
          </View>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleShare}
          >
            <Text style={styles.actionButtonText}>Share Project</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={handleDeleteProject}
          >
            <Text style={[styles.actionButtonText, styles.deleteButtonText]}>
              Delete Project
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: '#ff4444',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 16,
    color: '#666',
  },
  audioSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  playButton: {
    backgroundColor: '#007AFF',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  modifiedPlayButton: {
    backgroundColor: '#34C759',
  },
  playButtonText: {
    fontSize: 20,
  },
  audioInfo: {
    flex: 1,
  },
  audioLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  audioStatus: {
    fontSize: 14,
    color: '#666',
  },
  transcriptionSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  transcriptionBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  transcriptionText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  actionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flex: 0.48,
    alignItems: 'center',
  },
  deleteButton: {
    backgroundColor: '#ff4444',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButtonText: {
    color: 'white',
  },
});
