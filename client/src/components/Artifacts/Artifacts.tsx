import { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import * as Tabs from '@radix-ui/react-tabs';
import { ArrowLeft, ChevronLeft, ChevronRight, Code, Eye, Maximize, RefreshCw, X } from 'lucide-react';
import { useSetRecoilState, useResetRecoilState } from 'recoil';
import { Spinner, useMediaQuery } from '@librechat/client';
import type { SandpackPreviewRef, CodeEditorRef } from '@codesandbox/sandpack-react';
import { useShareContext, useMutationState } from '~/Providers';
import useArtifacts from '~/hooks/Artifacts/useArtifacts';
import DownloadArtifact from './DownloadArtifact';
import ArtifactVersion from './ArtifactVersion';
import ArtifactTabs from './ArtifactTabs';
import { CopyCodeButton } from './Code';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
import store from '~/store';

const MAX_BLUR_AMOUNT = 32;
const MAX_BACKDROP_OPACITY = 0.3;

export default function Artifacts() {
  const localize = useLocalize();
  const { isMutating } = useMutationState();
  const { isSharedConvo } = useShareContext();
  const isMobile = useMediaQuery('(max-width: 868px)');
  const editorRef = useRef<CodeEditorRef>();
  const previewRef = useRef<SandpackPreviewRef>();
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [height, setHeight] = useState(90);
  const [isDragging, setIsDragging] = useState(false);
  const [blurAmount, setBlurAmount] = useState(0);
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(90);
  const setArtifactsVisible = useSetRecoilState(store.artifactsVisibility);
  const resetCurrentArtifactId = useResetRecoilState(store.currentArtifactId);

  useEffect(() => {
    setIsMounted(true);
    const delay = isMobile ? 50 : 30;
    const timer = setTimeout(() => setIsVisible(true), delay);
    return () => {
      clearTimeout(timer);
      setIsMounted(false);
    };
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile) {
      setBlurAmount(0);
      return;
    }

    const minHeightForBlur = 50;
    const maxHeightForBlur = 100;

    if (height <= minHeightForBlur) {
      setBlurAmount(0);
    } else if (height >= maxHeightForBlur) {
      setBlurAmount(MAX_BLUR_AMOUNT);
    } else {
      const progress = (height - minHeightForBlur) / (maxHeightForBlur - minHeightForBlur);
      setBlurAmount(Math.round(progress * MAX_BLUR_AMOUNT));
    }
  }, [height, isMobile]);

  const {
    activeTab,
    setActiveTab,
    currentIndex,
    currentArtifact,
    orderedArtifactIds,
    setCurrentArtifactId,
  } = useArtifacts();

  const handleDragStart = (e: React.PointerEvent) => {
    setIsDragging(true);
    dragStartY.current = e.clientY;
    dragStartHeight.current = height;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handleDragMove = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }

    const deltaY = dragStartY.current - e.clientY;
    const viewportHeight = window.innerHeight;
    const deltaPercentage = (deltaY / viewportHeight) * 100;
    const newHeight = Math.max(10, Math.min(100, dragStartHeight.current + deltaPercentage));

    setHeight(newHeight);
  };

  const handleDragEnd = (e: React.PointerEvent) => {
    if (!isDragging) {
      return;
    }

    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    // Snap to positions based on final height
    if (height < 30) {
      closeArtifacts();
    } else if (height > 95) {
      setHeight(100);
    } else if (height < 60) {
      setHeight(50);
    } else {
      setHeight(90);
    }
  };

  if (!currentArtifact || !isMounted) {
    return null;
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    const client = previewRef.current?.getClient();
    if (client) {
      client.dispatch({ type: 'refresh' });
    }
    setTimeout(() => setIsRefreshing(false), 750);
  };

  const closeArtifacts = () => {
    if (isMobile) {
      setIsClosing(true);
      setIsVisible(false);
      setTimeout(() => {
        setArtifactsVisible(false);
        setIsClosing(false);
        setHeight(90);
      }, 250);
    } else {
      resetCurrentArtifactId();
      setArtifactsVisible(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const cycleArtifact = (direction: 'prev' | 'next') => {
    if (orderedArtifactIds.length <= 1) return;
    const newIndex = direction === 'prev'
      ? (currentIndex - 1 + orderedArtifactIds.length) % orderedArtifactIds.length
      : (currentIndex + 1) % orderedArtifactIds.length;
    const target = orderedArtifactIds[newIndex];
    if (target) {
      setCurrentArtifactId(target);
    }
  };

  const backdropOpacity =
    blurAmount > 0
      ? (Math.min(blurAmount, MAX_BLUR_AMOUNT) / MAX_BLUR_AMOUNT) * MAX_BACKDROP_OPACITY
      : 0;

  // Fullscreen overlay buttons - rendered via portal when fullscreen
  const fullscreenOverlay = isFullscreen ? createPortal(
    <>
      {/* Overlay Close button - top right */}
      <button
        className="fixed right-4 top-4 z-[10000] rounded-full bg-surface-tertiary/80 p-2.5 text-text-secondary backdrop-blur-sm transition-colors hover:bg-surface-tertiary hover:text-text-primary"
        onClick={toggleFullscreen}
        aria-label="Exit fullscreen"
      >
        <X size={20} />
      </button>

      {/* Overlay Download button - bottom right */}
      <div className="fixed bottom-4 right-4 z-[10000]">
        <DownloadArtifact artifact={currentArtifact} />
      </div>

      {/* Loading overlay in fullscreen */}
      <div
        className={cn(
          'fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
          isRefreshing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
        )}
        aria-hidden={!isRefreshing}
        role="status"
      >
        <div
          className={cn(
            'transition-transform duration-300 ease-in-out',
            isRefreshing ? 'scale-100' : 'scale-95',
          )}
        >
          <Spinner className="h-8 w-8" />
        </div>
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} asChild>
        {/* Main Parent - becomes fullscreen when isFullscreen is true */}
        <div 
          className={cn(
            'flex items-center justify-center',
            isFullscreen 
              ? 'fixed inset-0 z-[9999] h-screen w-screen'
              : 'h-full w-full',
          )}
        >
          {/* Mobile backdrop with dynamic blur - hidden in fullscreen */}
          {isMobile && !isFullscreen && (
            <div
              className={cn(
                'fixed inset-0 z-[99] bg-black will-change-[opacity,backdrop-filter]',
                isVisible && !isClosing
                  ? 'transition-all duration-300'
                  : 'pointer-events-none opacity-0 backdrop-blur-none transition-opacity duration-150',
                blurAmount < 8 && isVisible && !isClosing ? 'pointer-events-none' : '',
              )}
              style={{
                opacity: isVisible && !isClosing ? backdropOpacity : 0,
                backdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
                WebkitBackdropFilter: isVisible && !isClosing ? `blur(${blurAmount}px)` : 'none',
              }}
              onClick={blurAmount >= 8 ? closeArtifacts : undefined}
              aria-hidden="true"
            />
          )}
          
          {/* Main Container */}
          <div
            className={cn(
              'flex flex-col overflow-hidden bg-surface-primary-alt text-xl text-text-primary transition-all duration-300 ease-in-out',
              isFullscreen
                ? 'h-full w-full' // Full viewport in fullscreen
                : cn(
                    'h-full w-full shadow-[8px_0_24px_-12px_rgba(0,0,0,0.25)]',
                    isMobile
                      ? cn(
                          'fixed inset-x-0 bottom-0 z-[100] rounded-t-[20px] shadow-[0_-10px_60px_rgba(0,0,0,0.35)]',
                          isVisible && !isClosing
                            ? 'translate-y-0 opacity-100'
                            : 'duration-250 translate-y-full opacity-0 transition-all',
                          isDragging ? '' : 'transition-all duration-300',
                        )
                      : cn(
                          isVisible ? 'scale-100 opacity-100 blur-0' : 'scale-105 opacity-0 blur-sm',
                        ),
                  ),
            )}
            style={!isFullscreen && isMobile ? { height: `${height}vh` } : undefined}
          >
            {/* Mobile drag handle - hidden in fullscreen */}
            {isMobile && !isFullscreen && (
              <div
                className="flex flex-shrink-0 cursor-grab items-center justify-center bg-surface-primary-alt pb-1.5 pt-2.5 active:cursor-grabbing"
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
              >
                <div className="h-1 w-12 rounded-full bg-border-xheavy opacity-40 transition-all duration-200 active:opacity-60" />
              </div>
            )}

            {/* Header - hidden in fullscreen */}
            {!isFullscreen && (
              <div className="flex items-center justify-between bg-surface-primary-alt p-2">
                <div className="flex items-center">
                  <button className="mr-2 text-text-secondary hover:text-text-primary" onClick={closeArtifacts}>
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <h3 className="truncate text-sm text-text-primary">{currentArtifact.title}</h3>
                </div>
                <div className="flex items-center">
                  {/* Refresh button */}
                  {activeTab === 'preview' && (
                    <button
                      className={cn(
                        'mr-2 text-text-secondary hover:text-text-primary transition-transform duration-500 ease-in-out',
                        isRefreshing ? 'rotate-180' : '',
                      )}
                      onClick={handleRefresh}
                      disabled={isRefreshing}
                      aria-label="Refresh"
                    >
                      <RefreshCw
                        className={cn('h-4 w-4 transform', isRefreshing ? 'animate-spin' : '')}
                      />
                    </button>
                  )}
                  {/* Fullscreen button */}
                  {activeTab === 'preview' && (
                    <button
                      className="mr-2 text-text-secondary hover:text-text-primary transition-colors"
                      onClick={toggleFullscreen}
                      aria-label="Enter fullscreen"
                    >
                      <Maximize className="h-4 w-4" />
                    </button>
                  )}
                  {activeTab !== 'preview' && isMutating && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin text-text-secondary" />
                  )}
                  {/* Tabs */}
                  <Tabs.List className="mx-1 inline-flex h-7 rounded-full border border-border-medium bg-surface-secondary">
                    <Tabs.Trigger
                      value="preview"
                      disabled={isMutating}
                      className="border-0.5 flex items-center gap-1 rounded-full border-transparent py-1 pl-2.5 pr-2.5 text-xs font-medium text-text-secondary data-[state=active]:border-border-light data-[state=active]:bg-surface-tertiary-alt data-[state=active]:text-text-primary"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Tabs.Trigger>
                    <Tabs.Trigger
                      value="code"
                      className="border-0.5 flex items-center gap-1 rounded-full border-transparent py-1 pl-2.5 pr-2.5 text-xs font-medium text-text-secondary data-[state=active]:border-border-light data-[state=active]:bg-surface-tertiary-alt data-[state=active]:text-text-primary"
                    >
                      <Code className="h-3.5 w-3.5" />
                    </Tabs.Trigger>
                  </Tabs.List>
                  <button className="ml-2 text-text-secondary hover:text-text-primary" onClick={closeArtifacts}>
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Content with loading overlay */}
            <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
              <ArtifactTabs
                artifact={currentArtifact}
                editorRef={editorRef as React.MutableRefObject<CodeEditorRef>}
                previewRef={previewRef as React.MutableRefObject<SandpackPreviewRef>}
                isSharedConvo={isSharedConvo}
              />
              {/* Loading overlay - only show in non-fullscreen mode */}
              {!isFullscreen && (
                <div
                  className={cn(
                    'absolute inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ease-in-out',
                    isRefreshing ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0',
                  )}
                  aria-hidden={!isRefreshing}
                  role="status"
                >
                  <div
                    className={cn(
                      'transition-transform duration-300 ease-in-out',
                      isRefreshing ? 'scale-100' : 'scale-95',
                    )}
                  >
                    <Spinner className="h-6 w-6" />
                  </div>
                </div>
              )}
            </div>

            {/* Footer - hidden in fullscreen */}
            {!isFullscreen && (
              <div className="flex items-center justify-between bg-surface-primary-alt p-2 text-sm text-text-secondary">
                <div className="flex items-center">
                  <button 
                    onClick={() => cycleArtifact('prev')} 
                    className="mr-2 text-text-secondary hover:text-text-primary disabled:opacity-50"
                    disabled={orderedArtifactIds.length <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-xs">{`${currentIndex + 1} / ${orderedArtifactIds.length}`}</span>
                  <button 
                    onClick={() => cycleArtifact('next')} 
                    className="ml-2 text-text-secondary hover:text-text-primary disabled:opacity-50"
                    disabled={orderedArtifactIds.length <= 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {/* Version dropdown */}
                  {orderedArtifactIds.length > 1 && (
                    <ArtifactVersion
                      currentIndex={currentIndex}
                      totalVersions={orderedArtifactIds.length}
                      onVersionChange={(index) => {
                        const target = orderedArtifactIds[index];
                        if (target) {
                          setCurrentArtifactId(target);
                        }
                      }}
                    />
                  )}
                  <CopyCodeButton content={currentArtifact.content ?? ''} />
                  <DownloadArtifact artifact={currentArtifact} />
                </div>
              </div>
            )}
          </div>
        </div>
      </Tabs.Root>

      {/* Fullscreen overlay buttons */}
      {fullscreenOverlay}
    </>
  );
}
