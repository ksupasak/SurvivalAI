import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useLocale, t } from '@/services/i18n';
import { useTheme } from '@/contexts/ThemeContext';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconsName;
  color: string;
  size: number;
}

function TabIcon({ name, color, size }: TabIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const locale = useLocale();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.amber,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 28,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tab_home'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tab_chat'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="chatbubbles" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calculator"
        options={{
          title: t('tab_calculator'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calculator" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="morse"
        options={{
          title: t('tab_morse'),
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="flashlight" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="room"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="notes"
        options={{
          title: t('tab_notes') || 'Notes',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="seeking"
        options={{ href: null }}
      />
    </Tabs>
  );
}
