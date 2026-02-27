import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.equilibrium.app',
  appName: 'Equilibrium',
  server: {
    url: 'https://equilibrium-five.vercel.app',
    cleartext: false,
    allowNavigation: [
      'equilibrium-five.vercel.app',
      '*.supabase.co',
    ],
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    allowMixedContent: false,
  },
}

export default config