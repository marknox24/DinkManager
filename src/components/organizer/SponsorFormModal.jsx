import { useState } from 'react';
import { Award, ImagePlus, Loader2 } from 'lucide-react';
import Modal from '../ui/Modal';
import FormField, { inputClass } from '../ui/FormField';
import Select from '../ui/Select';
import { SPONSOR_TIERS } from '../../data/constants';
import { getEventMediaUrl, uploadEventMedia } from '../../data/eventsApi';
import { useToast } from '../../context/ToastContext';

export default function SponsorFormModal({ eventId, sponsor, onSave, onClose }) {
  const { pushToast } = useToast();
  const [name, setName] = useState(sponsor?.name || '');
  const [tier, setTier] = useState(sponsor?.tier || 'gold');
  const [amount, setAmount] = useState(sponsor?.amount ?? '');
  const [logoPath, setLogoPath] = useState(sponsor?.logo_path || null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim() && Number(amount) >= 0;

  const handleLogoUpload = async (file) => {
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { path } = await uploadEventMedia(eventId, file);
      setLogoPath(path);
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        tier,
        amount: parseFloat(amount) || 0,
        logo_path: logoPath,
      });
      onClose();
    } catch (e) {
      pushToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open onClose={onClose} title={sponsor ? 'Edit sponsor' : 'Add sponsor'} icon={Award} maxWidth="max-w-md">
      <div className="flex flex-col gap-4">
        <FormField label="Sponsor name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Pickleball Club"
            className={inputClass}
            autoFocus
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Tier">
            <Select value={tier} onChange={(e) => setTier(e.target.value)} className={inputClass}>
              {Object.entries(SPONSOR_TIERS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Amount">
            <input type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputClass} />
          </FormField>
        </div>

        <FormField label="Logo" hint="Optional — shown on the Preview Screen sponsor strip">
          {logoPath ? (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50/60 px-3.5 py-2.5">
              <img src={getEventMediaUrl(logoPath)} alt="" className="h-9 w-9 rounded-lg border border-ink-200 bg-white object-contain p-1" />
              <span className="text-xs font-semibold text-ink-600">Logo attached</span>
              <label className="ml-auto cursor-pointer text-xs font-semibold text-brand-600 hover:text-brand-700">
                Replace
                <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e.target.files?.[0])} className="hidden" />
              </label>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 px-3.5 py-3 text-xs font-bold text-ink-500 transition hover:bg-ink-50">
              {uploadingLogo ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {uploadingLogo ? 'Uploading…' : 'Upload logo'}
              <input type="file" accept="image/*" onChange={(e) => handleLogoUpload(e.target.files?.[0])} className="hidden" />
            </label>
          )}
        </FormField>

        <div className="mt-1 flex justify-end gap-2.5">
          <button onClick={onClose} className="rounded-full px-4 py-2 text-sm font-semibold text-ink-600 transition hover:bg-ink-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : sponsor ? 'Save changes' : 'Add sponsor'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
