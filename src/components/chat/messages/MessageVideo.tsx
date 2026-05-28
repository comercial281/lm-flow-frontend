import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Attachment } from '@/types/chat/api';

interface VideoItemProps {
  attachment: Attachment;
}

const VideoItem: React.FC<VideoItemProps> = ({ attachment }) => {
  const [hasError, setHasError] = useState(false);

  const url = attachment.data_url || '';
  const fileName = attachment.fallback_title || 'video';

  if (hasError) {
    return (
      <a
        href={url}
        download={fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-3 rounded-lg bg-muted hover:bg-muted/80 transition-colors"
      >
        <Download className="h-4 w-4 flex-shrink-0" />
        <span className="text-sm truncate">{fileName}</span>
      </a>
    );
  }

  return (
    <div
      className="relative rounded-lg overflow-hidden"
      style={{
        minWidth: '200px',
        maxWidth: 'min(280px, calc(100vw - 120px))',
      }}
    >
      <video
        controls
        preload="metadata"
        playsInline
        className="w-full max-h-64 object-contain bg-black rounded-lg"
        onError={() => setHasError(true)}
      >
        <source src={url} />
        Seu navegador não suporta vídeo.
      </video>
      {attachment.fallback_title && (
        <div className="text-xs text-muted-foreground truncate mt-1">
          {attachment.fallback_title}
        </div>
      )}
    </div>
  );
};

interface MessageVideoProps {
  attachments: Attachment[];
}

const MessageVideo: React.FC<MessageVideoProps> = ({ attachments }) => {
  return (
    <div className="space-y-2">
      {attachments
        .filter(a => a && a.data_url && a.data_url.trim() !== '')
        .map((attachment, index) => (
          <VideoItem key={attachment.id || index} attachment={attachment} />
        ))}
    </div>
  );
};

export default MessageVideo;
