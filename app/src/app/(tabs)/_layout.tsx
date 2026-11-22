import { Tabs } from 'expo-router';
import { t } from '@/i18n';
import { BottomInset, FloatingTabBar, TAB_BAR_INSET } from '@/ui/FloatingTabBar';

/** UX-1: two tabs, never hidden or disabled. Each tab has its own stack with the headers. The bar floats (UX-12). */
export default function TabsLayout() {
  return (
    <BottomInset.Provider value={TAB_BAR_INSET}>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (
          <FloatingTabBar
            state={props.state as never}
            descriptors={props.descriptors as never}
            emitter={props.emitter as never}
            navigateToTab={props.navigateToTab}
          />
        )}
      >
        <Tabs.Screen name="today" options={{ title: t('tabs.today') }} />
        <Tabs.Screen name="review" options={{ title: t('tabs.review') }} />
      </Tabs>
    </BottomInset.Provider>
  );
}
