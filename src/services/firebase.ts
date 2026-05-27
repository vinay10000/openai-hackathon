import { Platform } from 'react-native';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import {
  Auth,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  User,
} from 'firebase/auth';
import { Firestore, getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp | null {
  if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
    return null;
  }

  return getApps()[0] ?? initializeApp(firebaseConfig);
}

let authInstance: Auth | null = null;

function getFirebaseAuth(app: FirebaseApp): Auth {
  if (authInstance) {
    return authInstance;
  }

  authInstance = getAuth(app);

  if (Platform.OS === 'web') {
    void authInstance.setPersistence(browserLocalPersistence);
  }

  return authInstance;
}

export function getFirebaseServices(): { auth: Auth; db: Firestore } | null {
  const app = getFirebaseApp();

  if (!app) {
    return null;
  }

  return {
    auth: getFirebaseAuth(app),
    db: getFirestore(app),
  };
}

function requireServices() {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* environment variables first.');
  }

  return services;
}

export function observeAuthState(listener: (user: User | null) => void) {
  return onAuthStateChanged(requireServices().auth, listener);
}

export async function signUpWithEmail(email: string, password: string, displayName: string) {
  const { auth } = requireServices();
  const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (displayName.trim()) {
    await updateProfile(credential.user, {
      displayName: displayName.trim(),
    });
  }

  return credential.user;
}

export async function signInWithEmail(email: string, password: string) {
  const { auth } = requireServices();
  const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
  return credential.user;
}

export async function signInWithGoogleNative() {
  if (Platform.OS === 'web') {
    throw new Error('Native Google sign-in requires Android or iOS. Use a development build, not Expo Go.');
  }

  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error('Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to your Google OAuth web client ID.');
  }

  const googleSignIn = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
  const { GoogleSignin, isSuccessResponse } = googleSignIn;

  GoogleSignin.configure({
    webClientId,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    profileImageSize: 160,
  });

  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }

  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    throw new Error('Google sign-in was cancelled.');
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error('Google sign-in did not return an ID token. Verify the web client ID and Firebase Google provider setup.');
  }

  const { auth } = requireServices();
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);

  if (response.data.user.name && !userCredential.user.displayName) {
    await updateProfile(userCredential.user, {
      displayName: response.data.user.name,
    });
  }

  return userCredential.user;
}

export async function resetPassword(email: string) {
  const { auth } = requireServices();
  await sendPasswordResetEmail(auth, email.trim());
}

export async function updateUserProfile(displayName: string) {
  const { auth } = requireServices();
  if (!auth.currentUser) {
    throw new Error('Sign in first.');
  }

  await updateProfile(auth.currentUser, {
    displayName: displayName.trim(),
  });
}

export async function signOutCurrentUser() {
  const { auth } = requireServices();
  await signOut(auth);
}

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId);
}

export function getFirebaseProjectLabel() {
  return firebaseConfig.projectId ?? '';
}

export function getExistingFirebaseApp() {
  return getApps().length ? getApp() : null;
}
