const fs = require('fs');

const googleServicesJson = './google-services.json';
const googleServiceInfoPlist = './GoogleService-Info.plist';
const iosUrlScheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;

const googlePlugin =
  iosUrlScheme && !fs.existsSync(googleServiceInfoPlist)
    ? ['@react-native-google-signin/google-signin', { iosUrlScheme }]
    : '@react-native-google-signin/google-signin';

const ios = {
  supportsTablet: true,
};

if (fs.existsSync(googleServiceInfoPlist)) {
  ios.googleServicesFile = googleServiceInfoPlist;
}

const android = {
  package: 'com.rootforge.mobile',
  adaptiveIcon: {
    backgroundColor: '#E6F4FE',
    foregroundImage: './assets/android-icon-foreground.png',
    backgroundImage: './assets/android-icon-background.png',
    monochromeImage: './assets/android-icon-monochrome.png',
  },
  predictiveBackGestureEnabled: false,
};

if (fs.existsSync(googleServicesJson)) {
  android.googleServicesFile = googleServicesJson;
}

module.exports = {
  expo: {
    name: 'RootForge',
    slug: 'rootforge',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    splash: {
      image: './assets/splash-dark.png',
      resizeMode: 'contain',
      backgroundColor: '#0B1016',
    },
    userInterfaceStyle: 'light',
    ios,
    android,
    web: {
      favicon: './assets/favicon.png',
    },
    plugins: ['expo-dev-client', 'expo-secure-store', 'expo-sharing', 'expo-notifications', googlePlugin],
  },
};
