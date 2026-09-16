import { Loader2, X } from 'lucide-react';

// A single click-anywhere-on-the-box upload control, replacing the old
// "preview box + separate Upload/Replace button" pattern used at every
// image upload spot in the app. The whole box is a <label> wrapping a
// hidden file input, so there's nothing to click but the box itself.
export default function ImageDropzone({
  imagePath,
  getUrl,
  onUpload,
  uploading = false,
  onRemove,
  className = 'h-32 w-32',
  emptyIcon: EmptyIcon,
  emptyLabel = 'Upload photo',
}) {
  const url = imagePath ? getUrl(imagePath) : null;

  return (
    <label
      className={`group relative flex shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border transition ${
        url ? 'border-ink-200' : 'border-dashed border-ink-300 hover:border-brand-300 hover:bg-brand-50/30'
      } ${uploading ? 'pointer-events-none' : ''} ${className}`}
    >
      {url ? (
        <>
          <img src={url} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/0 text-transparent transition group-hover:bg-black/40 group-hover:text-white">
            <span className="text-xs font-bold">Replace</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-1.5 px-2 text-center text-ink-300 group-hover:text-brand-400">
          {EmptyIcon && <EmptyIcon size={22} />}
          <span className="text-[11px] font-semibold">{emptyLabel}</span>
        </div>
      )}

      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70">
          <Loader2 size={18} className="animate-spin text-brand-600" />
        </div>
      )}

      {onRemove && url && !uploading && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onRemove();
          }}
          className="absolute top-1.5 right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition group-hover:opacity-100 hover:bg-black/80"
        >
          <X size={11} />
        </button>
      )}

      <input type="file" accept="image/*" disabled={uploading} onChange={(e) => onUpload(e.target.files?.[0])} className="hidden" />
    </label>
  );
}
