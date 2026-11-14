import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from './types';

// Shown for /app/... pages while signed out: sends the user to /signin.
export function RedirectToSignIn() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  useEffect(() => {
    navigation.replace('SignIn');
  }, [navigation]);
  return null;
}
