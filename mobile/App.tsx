import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { auth } from './utils/firebase';

// Import screens
import AuthScreen from './screens/AuthScreen';
import HomeScreen from './screens/HomeScreen';
import UploadScreen from './screens/UploadScreen';
import EditorScreen from './screens/EditorScreen';
import PlaybackScreen from './screens/PlaybackScreen';
import SoundboardScreen from './screens/SoundboardScreen';

const Stack = createStackNavigator();

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), (user) => {
      setUser(user);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading...</Text>
        <StatusBar style="auto" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          screenOptions={{
            headerStyle: {
              backgroundColor: '#007AFF',
            },
            headerTintColor: '#fff',
            headerTitleStyle: {
              fontWeight: 'bold',
            },
          }}
        >
          {user ? (
            // User is signed in
            <>
              <Stack.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ title: 'Audio Editor' }}
              />
              <Stack.Screen 
                name="Soundboard" 
                component={SoundboardScreen} 
                options={{ title: 'Soundboard' }}
              />
              <Stack.Screen 
                name="Upload" 
                component={UploadScreen} 
                options={{ title: 'Upload Audio' }}
              />
              <Stack.Screen 
                name="Editor" 
                component={EditorScreen} 
                options={{ title: 'Edit Audio' }}
              />
              <Stack.Screen 
                name="Playback" 
                component={PlaybackScreen} 
                options={{ title: 'Playback' }}
              />
            </>
          ) : (
            // User is not signed in
            <Stack.Screen 
              name="Auth" 
              component={AuthScreen} 
              options={{ headerShown: false }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <StatusBar style="auto" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
});
