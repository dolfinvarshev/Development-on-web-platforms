'use client';

import { useCallback, useEffect, useState } from 'react';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import { categoryLabel, relativeTimeHe } from '@/lib/format';
import { useAdminApi } from './useAdminApi';
import Loading from './Loading';

const CATEGORY_OPTIONS = ['defib_lora', 'defib_only', 'lora_only'];

const CATEGORY_BADGE = {
  defib_lora: 'emerald',
  defib_only: 'sky',
  lora_only: 'violet',
};

function BatteryCell({ battery }) {
  if (battery === null || battery === undefined) {
    return <span className="text-slate-400">—</span>;
  }
  const tone =
    battery < 20 ? 'text-red-600 font-bold' : battery < 50 ? 'text-amber-600' : 'text-slate-700';
  return <span className={tone}>{battery}%</span>;
}

/** Inline editor row — same validation surface as the public registration form. */
function EditRow({ volunteer, onSaved, onCancel }) {
  const api = useAdminApi();
  const [draft, setDraft] = useState({
    firstName: volunteer.firstName ?? '',
    lastName: volunteer.lastName ?? '',
    phone: volunteer.phone ?? '',
    category: volunteer.category,
    loraId: volunteer.loraId ?? '',
    medicalTraining: volunteer.medicalTraining ?? '',
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (name) => (e) => setDraft((d) => ({ ...d, [name]: e.target.value }));

  async function save() {
    setSaving(true);
    setError(null);
    setFieldErrors({});
    try {
      const body = {
        firstName: draft.firstName,
        lastName: draft.lastName,
        phone: draft.phone,
        category: draft.category,
        loraId: draft.loraId.trim() || null,
        medicalTraining: draft.medicalTraining,
      };
      const data = await api(`/api/volunteers/${volunteer.id}`, { method: 'PUT', body });
      onSaved(data.volunteer);
    } catch (err) {
      if (err.status !== 401) {
        if (err.data?.fields) setFieldErrors(err.data.fields);
        else setError('השמירה נכשלה — נסו שוב');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="bg-emerald-50/40">
      <td colSpan={8} className="p-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="שם פרטי" required error={fieldErrors.firstName}>
            <Input value={draft.firstName} onChange={set('firstName')} />
          </Field>
          <Field label="שם משפחה" error={fieldErrors.lastName}>
            <Input value={draft.lastName} onChange={set('lastName')} />
          </Field>
          <Field label="מספר נייד" required error={fieldErrors.phone}>
            <Input dir="ltr" value={draft.phone} onChange={set('phone')} />
          </Field>
          <Field label="מסלול" required error={fieldErrors.category}>
            <Select value={draft.category} onChange={set('category')}>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="מזהה LoRa (DevEUI)"
            error={fieldErrors.loraId}
            hint={draft.category === 'defib_only' ? 'רשות במסלול טלפון בלבד' : 'חובה במסלול זה'}
          >
            <Input dir="ltr" className="font-mono" value={draft.loraId} onChange={set('loraId')} />
          </Field>
          <Field label="הכשרה רפואית" error={fieldErrors.medicalTraining}>
            <Input value={draft.medicalTraining} onChange={set('medicalTraining')} />
          </Field>
        </div>
        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}
        <div className="mt-4 flex gap-2">
          <Button onClick={save} disabled={saving}>
            {saving ? 'שומרים…' : 'שמירת שינויים'}
          </Button>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            ביטול
          </Button>
        </div>
      </td>
    </tr>
  );
}

/** Requirement 12: management of the registration database — search, edit, delete. */
export default function VolunteersTab() {
  const api = useAdminApi();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [volunteers, setVolunteers] = useState(null);
  const [error, setError] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(
    async (q, c) => {
      setError(null);
      try {
        const params = new URLSearchParams();
        if (q) params.set('query', q);
        if (c) params.set('category', c);
        const qs = params.toString();
        const data = await api(`/api/volunteers${qs ? `?${qs}` : ''}`);
        setVolunteers(data.volunteers);
      } catch (err) {
        if (err.status !== 401) setError('טעינת המתנדבים נכשלה — נסו לרענן');
      }
    },
    [api]
  );

  useEffect(() => {
    load('', '');
  }, [load]);

  function handleSearch(e) {
    e.preventDefault();
    setEditingId(null);
    setConfirmDeleteId(null);
    load(query.trim(), category);
  }

  function handleSaved(updated) {
    setVolunteers((list) => list.map((v) => (v.id === updated.id ? updated : v)));
    setEditingId(null);
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      await api(`/api/volunteers/${id}`, { method: 'DELETE' });
      setVolunteers((list) => list.filter((v) => v.id !== id));
    } catch (err) {
      if (err.status !== 401) setError('המחיקה נכשלה — נסו שוב');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-3">
          <div className="min-w-52 flex-1">
            <Field label="חיפוש" hint="שם, טלפון או מזהה LoRa">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="לדוגמה: דנה, 052…, A1B2…"
              />
            </Field>
          </div>
          <div className="w-full sm:w-64">
            <Field label="מסלול">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">כל המסלולים</option>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c} value={c}>
                    {categoryLabel(c)}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Button type="submit">חיפוש</Button>
        </form>
      </Card>

      {error && <Alert tone="danger">{error}</Alert>}

      {volunteers === null ? (
        <Loading text="טוענים את מרשם המתנדבים…" />
      ) : (
        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <h3 className="font-bold text-slate-900">מרשם המתנדבים והמכשירים</h3>
            <span className="text-sm text-slate-500">{volunteers.length} רשומות</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-start text-xs text-slate-500">
                  <th className="px-4 py-3 text-start font-semibold">שם מלא</th>
                  <th className="px-4 py-3 text-start font-semibold">טלפון</th>
                  <th className="px-4 py-3 text-start font-semibold">מסלול</th>
                  <th className="px-4 py-3 text-start font-semibold">LoRa ID</th>
                  <th className="px-4 py-3 text-start font-semibold">סוללה</th>
                  <th className="px-4 py-3 text-start font-semibold">שידור אחרון</th>
                  <th className="px-4 py-3 text-start font-semibold"></th>
                  <th className="px-4 py-3 text-start font-semibold">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {volunteers.map((v) => (
                  <VolunteerRows
                    key={v.id}
                    volunteer={v}
                    editing={editingId === v.id}
                    confirming={confirmDeleteId === v.id}
                    deleting={deletingId === v.id}
                    onEdit={() => {
                      setEditingId(editingId === v.id ? null : v.id);
                      setConfirmDeleteId(null);
                    }}
                    onCancelEdit={() => setEditingId(null)}
                    onSaved={handleSaved}
                    onAskDelete={() => {
                      setConfirmDeleteId(v.id);
                      setEditingId(null);
                    }}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                    onConfirmDelete={() => handleDelete(v.id)}
                  />
                ))}
                {volunteers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                      לא נמצאו רשומות מתאימות
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function VolunteerRows({
  volunteer: v,
  editing,
  confirming,
  deleting,
  onEdit,
  onCancelEdit,
  onSaved,
  onAskDelete,
  onCancelDelete,
  onConfirmDelete,
}) {
  return (
    <>
      <tr className="hover:bg-slate-50/60">
        <td className="px-4 py-3 font-semibold text-slate-800">
          {[v.firstName, v.lastName].filter(Boolean).join(' ')}
        </td>
        <td className="px-4 py-3" dir="ltr">
          {v.phone}
        </td>
        <td className="px-4 py-3">
          <Badge color={CATEGORY_BADGE[v.category] ?? 'slate'}>{categoryLabel(v.category)}</Badge>
        </td>
        <td className="px-4 py-3 font-mono text-xs" dir="ltr">
          {v.loraId ?? '—'}
        </td>
        <td className="px-4 py-3">
          <BatteryCell battery={v.device?.battery} />
        </td>
        <td className="px-4 py-3 text-slate-500" suppressHydrationWarning>
          {relativeTimeHe(v.device?.lastSeen)}
        </td>
        <td className="px-4 py-3">{v.isSeed && <Badge color="slate">דמו</Badge>}</td>
        <td className="px-4 py-3">
          {confirming ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold text-red-600">בטוחים?</span>
              <Button variant="emergency" className="px-2 py-1 text-xs" onClick={onConfirmDelete} disabled={deleting}>
                {deleting ? 'מוחקים…' : 'מחיקה'}
              </Button>
              <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onCancelDelete} disabled={deleting}>
                ביטול
              </Button>
            </span>
          ) : (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Button variant="outline" className="px-2.5 py-1 text-xs" onClick={onEdit}>
                {editing ? 'סגירה' : 'עריכה'}
              </Button>
              <Button variant="ghost" className="px-2.5 py-1 text-xs text-red-600" onClick={onAskDelete}>
                מחיקה
              </Button>
            </span>
          )}
        </td>
      </tr>
      {editing && <EditRow volunteer={v} onSaved={onSaved} onCancel={onCancelEdit} />}
    </>
  );
}
