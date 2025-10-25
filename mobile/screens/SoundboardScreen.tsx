import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import { firestore, storage, auth } from '../utils/firebase';
import { collection, onSnapshot, orderBy, query, where } from '@react-native-firebase/firestore';
import { getDownloadURL } from '@react-native-firebase/storage';
import { SoundClip } from '../types';

export default function SoundboardScreen() {
  const [clips, setClips] = useState<SoundClip[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [sounds, setSounds] = useState<Record<string, Audio.Sound | null>>({});

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) return;

    const q = query(
      collection(firestore(), 'soundClips'),
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
    return () => {
      Object.values(sounds).forEach((s) => s?.unloadAsync());
    };
  }, [sounds]);

  const playClip = async (clip: SoundClip) => {
    try {
      if (playingId && sounds[playingId]) {
        await sounds[playingId]!.stopAsync();
      }

      let sound = sounds[clip.id];
      if (!sound) {
        const url = await getDownloadURL(storage().ref(clip.audioStoragePath));
        const created = await Audio.Sound.createAsync({ uri: url }, { shouldPlay: true });
        sound = created.sound;
        setSounds((prev) => ({ ...prev, [clip.id]: sound! }));
      } else {
        await sound.setPositionAsync(0);
        await sound.playAsync();
      }
      setPlayingId(clip.id);
    } catch (e) {
      Alert.alert('Playback error', 'Failed to play clip');
    }
  };

  const stopAll = async () => {
    await Promise.all(Object.values(sounds).map(async (s) => s?.stopAsync()));
    setPlayingId(null);
  };

  const renderItem = ({ item }: { item: SoundClip }) => (
    <TouchableOpacity
      style={[styles.clipButton, playingId === item.id && styles.clipButtonActive, { backgroundColor: item.color || '#007AFF' }]}
      onPress={() => playClip(item)}
    >
      <Text style={styles.clipTitle} numberOfLines={2}>{item.title}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading clips...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Soundboard</Text>
        <TouchableOpacity style={styles.stopAllButton} onPress={stopAll}>
          <Text style={styles.stopAllText}>Stop All</Text>
        </TouchableOpacity>
      </View>
      {clips.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No clips yet</Text>
          <Text style={styles.emptyText}>Create a clip from the editor screen.</Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.grid}
          data={clips}
          numColumns={2}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  stopAllButton: { backgroundColor: '#ff3b30', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 },
  stopAllText: { color: 'white', fontWeight: '600' },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 8, color: '#666' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 6 },
  emptyText: { color: '#666' },
  grid: { padding: 12, gap: 12 },
  clipButton: {
    flex: 1,
    minHeight: 120,
    margin: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  clipButtonActive: { opacity: 0.9 },
  clipTitle: { color: 'white', fontSize: 16, fontWeight: '700', textAlign: 'center' },
});
