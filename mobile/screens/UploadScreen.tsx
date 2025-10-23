import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { auth, storage, firestore, functions } from '../utils/firebase';
import { generateUniqueFilename, validateAudioFile } from '../utils/helpers';

interface UploadScreenProps {
  navigation: any;
}

export default function UploadScreen({ navigation }: UploadScreenProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFilePicker = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets[0]) {
        const file = result.assets[0];
        await handleFileUpload(file);
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to pick file');
    }
  };

  const handleFileUpload = async (file: any) => {
    const user = auth().currentUser;
    if (!user) {
      Alert.alert('Error', 'Please sign in first');
      return;
    }

    // Validate file
    const fileValidation = validateAudioFile(file);
    if (!fileValidation.isValid) {
      Alert.alert('Error', fileValidation.error);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      // Generate unique filename
      const fileName = generateUniqueFilename(file.name);
      const storagePath = `users/${user.uid}/original/${fileName}`;

      // Upload to Firebase Storage
      const reference = storage().ref(storagePath);
      const uploadTask = reference.putFile(file.uri);

      // Track upload progress
      uploadTask.on('state_changed', (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setUploadProgress(progress);
      });

      // Wait for upload to complete
      await uploadTask;

      // Create project document in Firestore
      const projectRef = firestore().collection('audioProjects').doc();
      const projectData = {
        id: projectRef.id,
        userId: user.uid,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        originalAudioUrl: storagePath,
        status: 'uploading',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      await projectRef.set(projectData);

      // Trigger transcription
      const transcribeFunction = functions().httpsCallable('transcribeAudioFunction');
      await transcribeFunction({
        audioStoragePath: storagePath,
        projectId: projectRef.id,
      });

      Alert.alert(
        'Success',
        'Audio uploaded successfully! Transcription is in progress.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Home'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Upload Audio</Text>
        <Text style={styles.subtitle}>
          Select an audio file to start editing
        </Text>

        <View style={styles.uploadArea}>
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={handleFilePicker}
            disabled={uploading}
          >
            {uploading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.uploadingText}>
                  Uploading... {Math.round(uploadProgress)}%
                </Text>
              </View>
            ) : (
              <View style={styles.uploadContent}>
                <Text style={styles.uploadIcon}>📁</Text>
                <Text style={styles.uploadText}>Choose Audio File</Text>
                <Text style={styles.uploadSubtext}>
                  MP3, WAV, M4A, AAC (max 50MB)
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.infoContainer}>
          <Text style={styles.infoTitle}>Supported formats:</Text>
          <Text style={styles.infoText}>• MP3 files</Text>
          <Text style={styles.infoText}>• WAV files</Text>
          <Text style={styles.infoText}>• M4A files</Text>
          <Text style={styles.infoText}>• AAC files</Text>
          <Text style={styles.infoText}>• Maximum file size: 50MB</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  uploadArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButton: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 40,
    width: '100%',
    maxWidth: 300,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadContent: {
    alignItems: 'center',
  },
  uploadIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  uploadText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 8,
  },
  uploadSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  uploadingContainer: {
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  infoContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
});
