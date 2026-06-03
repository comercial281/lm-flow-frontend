// Player embed YouTube/Vimeo a partir de provider + video_id.

interface Props {
  provider: 'youtube' | 'vimeo';
  videoId: string;
  className?: string;
}

export default function VideoEmbed({ provider, videoId, className }: Props) {
  const src =
    provider === 'youtube'
      ? `https://www.youtube.com/embed/${videoId}?rel=0`
      : `https://player.vimeo.com/video/${videoId}?byline=0&portrait=0`;

  return (
    <div className={`relative w-full aspect-video bg-black rounded-xl overflow-hidden ${className ?? ''}`}>
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
