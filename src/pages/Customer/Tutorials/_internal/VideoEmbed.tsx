// Player de vídeo: embed YouTube/Vimeo (iframe) ou vídeo nativo (upload).

interface Props {
  provider: 'youtube' | 'vimeo' | 'upload';
  videoId: string;
  // URL direta — usada quando provider === 'upload' (vídeo no storage).
  videoUrl?: string;
  className?: string;
}

export default function VideoEmbed({ provider, videoId, videoUrl, className }: Props) {
  if (provider === 'upload') {
    return (
      <div
        className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden ${className ?? ''}`}
      >
        <video
          src={videoUrl}
          controls
          controlsList="nodownload"
          className="absolute inset-0 w-full h-full"
        >
          Seu navegador não suporta vídeo.
        </video>
      </div>
    );
  }

  const src =
    provider === 'youtube'
      ? `https://www.youtube.com/embed/${videoId}?rel=0`
      : `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0`;

  return (
    <div
      className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden ${className ?? ''}`}
    >
      <iframe
        src={src}
        className="absolute inset-0 w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        title="Player de video"
        loading="lazy"
      />
    </div>
  );
}
