import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { firestore, storage, functions } from '../utils/firebase';
import { doc, onSnapshot, updateDoc } from '@react-native-firebase/firestore';
import { getDownloadURL } from '@react-native-firebase/storage';
import { AudioProject, TranscriptionWord } from '../types';

interface EditorScreenProps {
  navigation: any;
  route: any;
}

export default function EditorScreen({ navigation, route }: EditorScreenProps) {
  const { projectId } = route.params;
  const [project, setProject] = useState<AudioProject | null>(null);
  const [editedTranscription, setEditedTranscription] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPosition, setCurrentPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [generating, setGenerating] = useState(false);
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
          setEditedTranscription(projectData.editedTranscription || '');

          // Load audio file
          if (projectData.originalAudioUrl) {
            try {
              const url = await getDownloadURL(storage().ref(projectData.originalAudioUrl));
              setAudioUrl(url);
            } catch (error) {
              console.error('Error loading audio:', error);
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
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const loadAudio = async () => {
    if (!audioUrl) return;

    try {
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: false }
      );
      
      setSound(newSound);
      
      // Set up playback status updates
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          setCurrentPosition(status.positionMillis || 0);
          setDuration(status.durationMillis || 0);
          setIsPlaying(status.isPlaying || false);
        }
      });
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Failed to load audio file');
    }
  };

  const togglePlayPause = async () => {
    if (!sound) {
      await loadAudio();
      return;
    }

    try {
      if (isPlaying) {
      await sound.pauseAsync();
      } else {
      await sound.playAsync();
      }
    } catch (error) {
      console.error('Error controlling playback:', error);
    }
  };

  const seekToPosition = async (position: number) => {
    if (!sound) return;

    try {
      await sound.setPositionAsync(position);
    } catch (error) {
      console.error('Error seeking audio:', error);
    }
  };

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGenerateAudio = async () => {
    if (!project || !editedTranscription.trim()) {
      Alert.alert('Error', 'Please edit the transcription first');
      return;
    }

    setGenerating(true);
    try {
      const generateFunction = functions().httpsCallable('generateModifiedAudioFunction');
      await generateFunction({
        projectId: project.id,
        editedTranscription: editedTranscription.trim(),
      });

      Alert.alert('Success', 'Audio generation started! Check back in a few minutes.');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to generate audio');
    } finally {
      setGenerating(false);
    }
  };

  const saveTranscription = async () => {
    if (!project) return;

    try {
      await updateDoc(doc(firestore(), 'audioProjects', project.id), {
        editedTranscription,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('Error saving transcription:', error);
    }
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

        {audioUrl && (
          <View style={styles.audioControls}>
            <TouchableOpacity
              style={styles.playButton}
              onPress={togglePlayPause}
              disabled={project.status !== 'ready' && project.status !== 'completed'}
            >
              <Text style={styles.playButtonText}>
                {isPlaying ? '⏸️' : '▶️'}
              </Text>
            </TouchableOpacity>

            <View style={styles.progressContainer}>
              <Text style={styles.timeText}>
                {formatTime(currentPosition)}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill,
                    { width: `${duration > 0 ? (currentPosition / duration) * 100 : 0}%` }
                  ]} 
                />
              </View>
              <Text style={styles.timeText}>
                {formatTime(duration)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.transcriptionContainer}>
          <Text style={styles.sectionTitle}>Transcription</Text>
          <TextInput
            style={styles.transcriptionInput}
            value={editedTranscription}
            onChangeText={setEditedTranscription}
            onBlur={saveTranscription}
            placeholder="Edit the transcription here..."
            multiline
            textAlignVertical="top"
            editable={project.status === 'ready' || project.status === 'completed'}
          />
        </View>

        {project.status === 'ready' && (
          <TouchableOpacity
            style={[styles.generateButton, generating && styles.generateButtonDisabled]}
            onPress={handleGenerateAudio}
            disabled={generating}
          >
            {generating ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.generateButtonText}>
                Generate Modified Audio
              </Text>
            )}
          </TouchableOpacity>
        )}

        {project.status === 'completed' && project.modifiedAudioUrl && (
          <TouchableOpacity
            style={styles.playModifiedButton}
            onPress={() => navigation.navigate('Playback', { projectId: project.id })}
          >
            <Text style={styles.playModifiedButtonText}>
              Play Modified Audio
            </Text>
          </TouchableOpacity>
        )}
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
  audioControls: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
  playButtonText: {
    fontSize: 20,
  },
  progressContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#666',
    minWidth: 40,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#eee',
    borderRadius: 2,
    marginHorizontal: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  transcriptionContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  transcriptionInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 200,
    textAlignVertical: 'top',
  },
  generateButton: {
    backgroundColor: '#34C759',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  generateButtonDisabled: {
    backgroundColor: '#ccc',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  playModifiedButton: {
    backgroundColor: '#FF9500',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  playModifiedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
