import { memo } from 'react';
import StreamingLoader from '~/components/Chat/Messages/ui/StreamingLoader';

const EmptyTextPart = memo(() => {
  return (
    <div className="text-message mb-[0.625rem] flex min-h-[20px] flex-col items-start gap-3 overflow-visible">
      <div className="markdown prose dark:prose-invert light w-full break-words dark:text-gray-100">
        <StreamingLoader />
      </div>
    </div>
  );
});

export default EmptyTextPart;
