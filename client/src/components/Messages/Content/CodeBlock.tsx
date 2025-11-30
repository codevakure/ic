import React, { useRef, useState, useMemo, useEffect } from 'react';
import copy from 'copy-to-clipboard';
import { InfoIcon } from 'lucide-react';
import { Tools } from 'librechat-data-provider';
import { Clipboard, CheckMark } from '@librechat/client';
import { useAtomValue } from 'jotai';
import type { CodeBarProps } from '~/common';
import ResultSwitcher from '~/components/Messages/Content/ResultSwitcher';
import { useToolCallsMapContext, useMessageContext } from '~/Providers';
import { LogContent } from '~/components/Chat/Messages/Content/Parts';
import RunCode from '~/components/Messages/Content/RunCode';
import { useLocalize } from '~/hooks';
import { getLanguageDisplay } from '~/utils/titleCase';
import { showCodeOutputAtom } from '~/store/showCodeOutput';
import cn from '~/utils/cn';

type CodeBlockProps = Pick<
  CodeBarProps,
  'lang' | 'plugin' | 'error' | 'allowExecution' | 'blockIndex'
> & {
  codeChildren: React.ReactNode;
  classProp?: string;
};

const CodeBar: React.FC<CodeBarProps> = React.memo(
  ({ lang, error, codeRef, blockIndex, plugin = null, allowExecution = true }) => {
    const localize = useLocalize();
    const [isCopied, setIsCopied] = useState(false);
    
    return (
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 text-xs font-medium',
        'bg-gray-100 text-gray-600 dark:bg-black dark:text-gray-400'
      )}>
        <span className={cn(
          'font-medium',
          'text-gray-800 dark:text-gray-200'
        )}>
          {getLanguageDisplay(lang)}
        </span>
        {plugin === true ? (
          <InfoIcon className={cn(
            'h-4 w-4',
            'text-gray-500 dark:text-gray-400'
          )} />
        ) : (
          <div className="flex items-center gap-3">
            {allowExecution === true && (
              <RunCode lang={lang} codeRef={codeRef} blockIndex={blockIndex} />
            )}
            
            {/* Copy button - icon only */}
            <button
              type="button"
              className={cn(
                'flex items-center justify-center w-8 h-6 rounded transition-colors',
                'text-gray-600 hover:text-gray-800 hover:bg-gray-200',
                'dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
                error === true ? 'h-4 w-4' : '',
              )}
              onClick={async () => {
                const codeString = codeRef.current?.textContent;
                if (codeString != null) {
                  setIsCopied(true);
                  copy(codeString.trim(), { format: 'text/plain' });

                  setTimeout(() => {
                    setIsCopied(false);
                  }, 3000);
                }
              }}
              title={isCopied ? 'Copied!' : 'Copy code'}
            >
              {isCopied ? (
                <CheckMark className="h-4 w-4" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  },
);

const CodeBlock: React.FC<CodeBlockProps> = ({
  lang,
  blockIndex,
  codeChildren,
  classProp = '',
  allowExecution = true,
  plugin = null,
  error,
}) => {
  const codeRef = useRef<HTMLElement>(null);
  const toolCallsMap = useToolCallsMapContext();
  const { messageId, partIndex } = useMessageContext();
  const showCodeOutput = useAtomValue(showCodeOutputAtom);
  const key = allowExecution
    ? `${messageId}_${partIndex ?? 0}_${blockIndex ?? 0}_${Tools.execute_code}`
    : '';
  const [currentIndex, setCurrentIndex] = useState(0);

  const fetchedToolCalls = toolCallsMap?.[key];
  const [toolCalls, setToolCalls] = useState(toolCallsMap?.[key] ?? null);

  useEffect(() => {
    if (fetchedToolCalls) {
      setToolCalls(fetchedToolCalls);
      setCurrentIndex(fetchedToolCalls.length - 1);
    }
  }, [fetchedToolCalls]);

  const currentToolCall = useMemo(() => toolCalls?.[currentIndex], [toolCalls, currentIndex]);

  const next = () => {
    if (!toolCalls) {
      return;
    }
    if (currentIndex < toolCalls.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const previous = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const isNonCode = !!(plugin === true || error === true);
  const language = isNonCode ? 'json' : lang;
  const hasOutput = allowExecution === true && toolCalls && toolCalls.length > 0;
  const showOutput = hasOutput && showCodeOutput;

  return (
    <div className="w-full rounded-md bg-gray-900 text-xs text-white/80 mt-3">
      <CodeBar
        lang={lang}
        error={error}
        codeRef={codeRef}
        blockIndex={blockIndex}
        plugin={plugin === true}
        allowExecution={allowExecution}
      />
      <div className={cn(
        classProp, 
        'overflow-y-auto pl-4 pr-4 pt-1 pb-4 relative',
        // Add bottom border radius when no output is shown
        !showOutput && 'rounded-b-md'
      )}>
        <code
          ref={codeRef}
          className={cn(
            isNonCode ? '!whitespace-pre-wrap' : `hljs language-${language} !whitespace-pre`,
          )}
        >
          {codeChildren}
        </code>
      </div>
      {showOutput && (
        <>
          <div className="bg-gray-700 p-4 text-xs">
            <div
              className="prose flex flex-col-reverse text-white"
              style={{
                color: 'white',
              }}
            >
              <pre className="shrink-0">
                <LogContent
                  output={(currentToolCall?.result as string | undefined) ?? ''}
                  attachments={currentToolCall?.attachments ?? []}
                  renderImages={true}
                />
              </pre>
            </div>
          </div>
          {toolCalls.length > 1 && (
            <ResultSwitcher
              currentIndex={currentIndex}
              totalCount={toolCalls.length}
              onPrevious={previous}
              onNext={next}
            />
          )}
        </>
      )}
    </div>
  );
};

export default CodeBlock;
