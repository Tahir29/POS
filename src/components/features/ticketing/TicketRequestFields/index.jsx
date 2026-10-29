'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImagePlus, Plus, X } from 'lucide-react';

import TicketFileThumb from '@/components/features/ticketing/TicketFileThumb';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories, useItemGroups } from '@/hooks/catalog/useCategoryFilters';
import { useAttributeOptions, useKaratOptions } from '@/hooks/catalog/useCatalogFilterOptions';
import { useStoneTypeDetails } from '@/hooks/estimation/useCustomEstimate';
import { uploadTicketFile } from '@/services/ticketingService';
import { prepareTicketFile } from '@/lib/ticketing/prepareTicketFile';
import { TICKET_FILE_TYPES, TICKET_MAX_FILES } from '@/lib/ticketing/constants';
import APP_CONFIG from '@/constants/appConfig';

export const EMPTY_SPECS = {
  category: '', metal: '', karat: '', size: '', budget: '', gold_weight: '', stones: [], requirement_notes: '',
};

export function specsFromTicket(specs = {}) {
  return Object.fromEntries(Object.keys(EMPTY_SPECS).map((key) => [key, specs[key] ?? EMPTY_SPECS[key]]));
}

export const formatStone = (s) =>
  [s.item_group, s.shape, s.color, s.quality, s.type].filter(Boolean).join(' · ')
  + ` · ${s.pieces} pc${s.weight != null && s.weight !== '' ? ` / ${s.weight} ct` : ''}`;

const EMPTY_STONE = { itemGroupId: '', item_group: '', shape: '', color: '', quality: '', type: '', pieces: '1', weight: '' };

function Field({ label, required, htmlFor, children, className = '' }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <Label htmlFor={htmlFor}>{label} {required && <span className="text-destructive">*</span>}</Label>
      {children}
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

function NameSelect({ id, value, onChange, options, placeholder, disabled }) {
  return (
    <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger id={id} className="h-11 w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-64 overflow-y-auto">
        {[...new Set(options)].map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

const uniqueNames = (items, key) => [...new Set(items.map((i) => i[key]).filter(Boolean))];

function StonesEditor({ stones, onChange }) {
  const [draft, setDraft] = useState(EMPTY_STONE);
  const { data: itemGroups = [] } = useItemGroups();
  const stoneGroups = itemGroups.filter((g) => g.base_item_id === APP_CONFIG.CUSTOM_ESTIMATE_STONE_BASE_ITEM_ID);
  const { options: shapeOptions }   = useAttributeOptions(APP_CONFIG.ATTRIBUTE_TYPES.DIAMOND_SHAPE);
  const { options: colorOptions }   = useAttributeOptions(APP_CONFIG.ATTRIBUTE_TYPES.STONE_COLOR);
  const { options: qualityOptions } = useAttributeOptions(APP_CONFIG.ATTRIBUTE_TYPES.STONE_QUALITY);
  const { types } = useStoneTypeDetails(draft.itemGroupId ? Number(draft.itemGroupId) : null);

  const update = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const handleAdd = () => {
    if (!draft.item_group) return toast.error('Select the stone item group.');
    if (!(Number(draft.pieces) > 0)) return toast.error('Enter the number of pieces.');
    const { itemGroupId, ...stone } = draft;
    onChange([...stones, stone]);
    setDraft(EMPTY_STONE);
  };

  return (
    <>
      {stones.length > 0 && (
        <div className="flex flex-col gap-2">
          {stones.map((s, i) => (
            <div key={i} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted px-3 py-2 text-sm">
              <span className="min-w-0 wrap-break-word">{formatStone(s)}</span>
              <button
                type="button"
                onClick={() => onChange(stones.filter((_, j) => j !== i))}
                aria-label="Remove stone"
                className="shrink-0 text-muted-foreground hover:text-destructive"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-dashed border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Item group" htmlFor="stone-group">
          <Select
            value={draft.itemGroupId}
            onValueChange={(v) => update({
              itemGroupId: v,
              item_group: stoneGroups.find((g) => String(g.item_group_id) === v)?.item_group_name ?? '',
              type: '',
            })}
          >
            <SelectTrigger id="stone-group" className="h-11 w-full"><SelectValue placeholder="Item group" /></SelectTrigger>
            <SelectContent className="max-h-64 overflow-y-auto">
              {stoneGroups.map((g) => (
                <SelectItem key={g.item_group_id} value={String(g.item_group_id)}>{g.item_group_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Shape" htmlFor="stone-shape">
          <NameSelect id="stone-shape" value={draft.shape} onChange={(v) => update({ shape: v })} options={shapeOptions.map((o) => o.label)} placeholder="Shape" />
        </Field>
        <Field label="Color" htmlFor="stone-color">
          <NameSelect id="stone-color" value={draft.color} onChange={(v) => update({ color: v })} options={colorOptions.map((o) => o.label)} placeholder="Color" />
        </Field>
        <Field label="Quality" htmlFor="stone-quality">
          <NameSelect id="stone-quality" value={draft.quality} onChange={(v) => update({ quality: v })} options={qualityOptions.map((o) => o.label)} placeholder="Quality" />
        </Field>
        <Field label="Type" htmlFor="stone-type">
          <NameSelect
            id="stone-type"
            value={draft.type}
            onChange={(v) => update({ type: v })}
            options={uniqueNames(types, 'type_name')}
            placeholder="Type"
            disabled={!draft.itemGroupId}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Pcs" htmlFor="stone-pcs">
            <Input id="stone-pcs" className="h-11" type="number" min="1" inputMode="numeric" value={draft.pieces} onChange={(e) => update({ pieces: e.target.value })} />
          </Field>
          <Field label="Weight (ct)" htmlFor="stone-weight">
            <Input id="stone-weight" className="h-11" type="number" min="0" step="0.001" inputMode="decimal" value={draft.weight} onChange={(e) => update({ weight: e.target.value })} />
          </Field>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5 sm:col-span-2 lg:col-span-3" onClick={handleAdd}>
          <Plus size={14} aria-hidden="true" /> Add stone
        </Button>
      </div>
    </>
  );
}

/**
 * Customer requirement + reference files, shared by the new-ticket form and the
 * "update request" dialog. `files` holds newly uploaded files ({ id, url, file_name, type }).
 */
export default function TicketRequestFields({ specs, onSpecsChange, files, onFilesChange, existingFileCount = 0, requireFiles }) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  const { data: categories = [] } = useCategories();
  const { options: metalOptions } = useAttributeOptions(APP_CONFIG.ATTRIBUTE_TYPES.METAL_COLOR);
  const { options: karatOptions } = useKaratOptions();

  const set = (key) => (value) => onSpecsChange({ ...specs, [key]: value });
  const setFromInput = (key) => (e) => set(key)(e.target.value);

  const handleFilesSelected = async (event) => {
    const selected = [...event.target.files];
    event.target.value = '';
    const room = TICKET_MAX_FILES - files.length - existingFileCount;
    if (selected.length > room) toast.error(`You can add ${Math.max(room, 0)} more file(s).`);

    const uploaded = [];
    setIsUploading(true);
    for (const file of selected.slice(0, Math.max(room, 0))) {
      if (!TICKET_FILE_TYPES.includes(file.type)) {
        toast.error(`${file.name}: only JPG, PNG or PDF files are allowed.`);
        continue;
      }
      try {
        uploaded.push(await uploadTicketFile(await prepareTicketFile(file)));
      } catch (err) {
        toast.error(`${file.name}: ${err.message}`);
      }
    }
    setIsUploading(false);
    if (uploaded.length) onFilesChange([...files, ...uploaded]);
  };

  return (
    <div className="flex flex-col gap-5">
      <Group title="Design">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Category" required htmlFor="ticket-category">
            <NameSelect
              id="ticket-category"
              value={specs.category}
              onChange={set('category')}
              options={uniqueNames(categories, 'type_name')}
              placeholder="Select category"
            />
          </Field>
          <Field label="Size" htmlFor="ticket-size">
            <Input id="ticket-size" className="h-11" value={specs.size} onChange={setFromInput('size')} placeholder="e.g. 12" maxLength={100} />
          </Field>
          <Field label="Budget (₹)" htmlFor="ticket-budget">
            <Input id="ticket-budget" className="h-11" type="number" min="0" inputMode="decimal" value={specs.budget} onChange={setFromInput('budget')} />
          </Field>
        </div>
      </Group>

      <Group title="Metal">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Karat" htmlFor="ticket-karat">
            <NameSelect id="ticket-karat" value={specs.karat} onChange={set('karat')} options={karatOptions.map((o) => o.label)} placeholder="Select karat" />
          </Field>
          <Field label="Color" htmlFor="ticket-metal">
            <NameSelect id="ticket-metal" value={specs.metal} onChange={set('metal')} options={metalOptions.map((o) => o.label)} placeholder="Select color" />
          </Field>
          <Field label="Weight (g)" htmlFor="ticket-gold">
            <Input id="ticket-gold" className="h-11" type="number" min="0" step="0.001" inputMode="decimal" value={specs.gold_weight} onChange={setFromInput('gold_weight')} />
          </Field>
        </div>
      </Group>

      <Group title="Diamonds / stones">
        <StonesEditor stones={specs.stones} onChange={set('stones')} />
      </Group>

      <Field label="Customer requirement" required htmlFor="ticket-notes">
        <Textarea
          id="ticket-notes"
          rows={4}
          maxLength={2000}
          value={specs.requirement_notes}
          onChange={setFromInput('requirement_notes')}
          placeholder="Design, finish, engraving, occasion, deadline…"
        />
      </Field>

      <Field label="Reference images" required={requireFiles}>
        <div className="flex flex-wrap gap-2">
          {files.map((file) => (
            <TicketFileThumb key={file.id} file={file} onRemove={() => onFilesChange(files.filter((f) => f.id !== file.id))} />
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading || files.length + existingFileCount >= TICKET_MAX_FILES}
            className="size-24 flex-col gap-1 text-xs"
          >
            <ImagePlus size={20} aria-hidden="true" />
            {isUploading ? 'Uploading…' : 'Add files'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">JPG, PNG or PDF · up to {TICKET_MAX_FILES} files</p>
        <input
          ref={fileInputRef}
          type="file"
          accept={TICKET_FILE_TYPES.join(',')}
          multiple
          className="hidden"
          onChange={handleFilesSelected}
        />
      </Field>
    </div>
  );
}
