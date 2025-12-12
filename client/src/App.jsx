import { useEffect } from 'react';
import { RecoilRoot } from 'recoil';
import { DndProvider } from 'react-dnd';
import { RouterProvider } from 'react-router-dom';
import * as RadixToast from '@radix-ui/react-toast';
import { HTML5Backend } from 'react-dnd-html5-backend';
// import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toast, ThemeProvider, ToastProvider } from '@ranger/client';
import { QueryClient, QueryClientProvider, QueryCache } from '@tanstack/react-query';
import { ScreenshotProvider, useApiErrorBoundary, useThemeColors } from './hooks';
import { HolidayOverlay } from './components/HolidayEffects';
import WakeLockManager from '~/components/System/WakeLockManager';
import { getThemeFromEnv } from './utils/getThemeFromEnv';
import { initializeFontSize } from '~/store/fontSize';
import { LiveAnnouncer } from '~/a11y';
import { router } from './routes';

// Component to apply theme colors from config
const ThemeColorsProvider = ({ children }) => {
  useThemeColors();
  return children;
};

const App = () => {
  const { setError } = useApiErrorBoundary();

  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => {
        if (error?.response?.status === 401) {
          setError(error);
        }
      },
    }),
  });

  useEffect(() => {
    initializeFontSize();
  }, []);

  // Load theme from environment variables if available
  const envTheme = getThemeFromEnv();

  return (
    <QueryClientProvider client={queryClient}>
      <RecoilRoot>
        <LiveAnnouncer>
          <ThemeProvider
            // Only pass initialTheme and themeRGB if environment theme exists
            // This allows localStorage values to persist when no env theme is set
            {...(envTheme && { initialTheme: 'system', themeRGB: envTheme })}
          >
            <ThemeColorsProvider>
              {/* The ThemeProvider will automatically:
                  1. Apply dark/light mode classes
                  2. Apply custom theme colors if envTheme is provided
                  3. Otherwise use stored theme preferences from localStorage
                  4. Fall back to default theme colors if nothing is stored
                  ThemeColorsProvider applies primary color from ranger.yaml config */}
              <RadixToast.Provider>
                <ToastProvider>
                  <DndProvider backend={HTML5Backend}>
                    <RouterProvider router={router} />
                    <WakeLockManager />
                    {/* <ReactQueryDevtools initialIsOpen={false} position="top-right" /> */}
                    <Toast />
                    <RadixToast.Viewport className="pointer-events-none fixed right-0 top-0 z-[1000] m-6 flex w-auto flex-col items-end gap-3 outline-none [&>*]:animate-in [&>*]:slide-in-from-right-full [&>*]:duration-300 [&>*]:ease-out" />
                  </DndProvider>
                </ToastProvider>
              </RadixToast.Provider>
            </ThemeColorsProvider>
          </ThemeProvider>
        </LiveAnnouncer>
      </RecoilRoot>
    </QueryClientProvider>
  );
};

export default () => (
  <ScreenshotProvider>
    {/* Holiday animation - shows immediately, checks config internally */}
    <HolidayOverlay duration={8000} particleCount={15} />
    <App />
    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
    <audio
      src="assets/silence.mp3"
      autoPlay
      muted
      playsInline
      id="audio"
      style={{
        display: 'none',
        width: 0,
        height: 0,
      }}
    />
  </ScreenshotProvider>
);
