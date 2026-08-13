'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, Field, Input, TextArea } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { formatDateTimeHe } from '@/lib/format';
import { useAdminApi } from './useAdminApi';
import Loading from './Loading';

// CMS keys → live routes, so an editor can jump straight to the page just changed.
const PAGE_ROUTES = {
  home: '/',
  guide: '/guide',
  join: '/join',
  shop: '/shop',
  maintenance: '/maintenance',
  register: '/register',
};

export default function ContentEditorTab() {
  const api = useAdminApi();
  const [pages, setPages] = useState(null);
  const [listError, setListError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [form, setForm] = useState(null);
  const [meta, setMeta] = useState(null);
  const [pageLoading, setPageLoading] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Repeater rows get a stable client-side id, so removing a middle row never
  // makes React re-associate input state with the wrong section/link.
  const rowIdRef = useRef(0);
  const nextRowId = useCallback(() => {
    rowIdRef.current += 1;
    return rowIdRef.current;
  }, []);

  const selectPage = useCallback(
    async (key) => {
      setSelectedKey(key);
      setForm(null);
      setMeta(null);
      setSaved(false);
      setSaveError(null);
      setPageError(null);
      setPageLoading(true);
      try {
        const data = await apiFetch(`/api/content/${key}`);
        const page = data.page;
        setForm({
          title: page.title ?? '',
          intro: page.intro ?? '',
          sections: (page.sections ?? []).map((s) => ({
            _id: nextRowId(),
            heading: s.heading ?? '',
            body: s.body ?? '',
          })),
          links: (page.links ?? []).map((l) => ({
            _id: nextRowId(),
            label: l.label ?? '',
            url: l.url ?? '',
            description: l.description ?? '',
          })),
        });
        setMeta({ updatedAt: page.updatedAt, updatedBy: page.updatedBy });
      } catch {
        setPageError('טעינת העמוד נכשלה — נסו לבחור אותו שוב');
      } finally {
        setPageLoading(false);
      }
    },
    [nextRowId]
  );

  const loadList = useCallback(async () => {
    setListError(null);
    setPages(null);
    try {
      const data = await apiFetch('/api/content');
      setPages(data.pages);
      if (data.pages.length > 0) selectPage(data.pages[0].key);
    } catch {
      setListError('טעינת רשימת העמודים נכשלה — ודאו שהשרת פועל');
    }
  }, [selectPage]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    setSaved(false);
  }

  function setRowField(listName, id, name, value) {
    setForm((prev) => ({
      ...prev,
      [listName]: prev[listName].map((row) => (row._id === id ? { ...row, [name]: value } : row)),
    }));
    setSaved(false);
  }

  function addRow(listName, emptyRow) {
    setForm((prev) => ({ ...prev, [listName]: [...prev[listName], { _id: nextRowId(), ...emptyRow }] }));
    setSaved(false);
  }

  function removeRow(listName, id) {
    setForm((prev) => ({ ...prev, [listName]: prev[listName].filter((row) => row._id !== id) }));
    setSaved(false);
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const data = await api(`/api/content/${selectedKey}`, {
        method: 'PUT',
        body: {
          title: form.title,
          intro: form.intro,
          sections: form.sections.map(({ heading, body }) => ({ heading, body })),
          links: form.links.map(({ label, url, description }) => ({ label, url, description })),
        },
      });
      setPages((prev) =>
        prev.map((p) =>
          p.key === selectedKey ? { ...p, title: data.page.title, updatedAt: data.page.updatedAt } : p
        )
      );
      setMeta({ updatedAt: data.page.updatedAt, updatedBy: data.page.updatedBy });
      setSaved(true);
    } catch (err) {
      if (err.status !== 401) setSaveError('השמירה נכשלה — נסו שוב');
    } finally {
      setSaving(false);
    }
  }

  if (listError) {
    return (
      <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
        <span>{listError}</span>
        <Button variant="outline" onClick={loadList}>
          נסו שוב
        </Button>
      </Alert>
    );
  }

  if (!pages) return <Loading text="טוענים את עמודי התוכן…" />;

  const liveRoute = selectedKey ? PAGE_ROUTES[selectedKey] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[16rem,1fr]">
      <nav
        className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        aria-label="עמודי האתר"
      >
        <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-400">
          עמודי האתר
        </p>
        <ul className="space-y-1">
          {pages.map((p) => (
            <li key={p.key}>
              <button
                type="button"
                onClick={() => selectPage(p.key)}
                disabled={saving}
                aria-current={selectedKey === p.key ? 'page' : undefined}
                className={`w-full rounded-xl px-3 py-2 text-start text-sm transition ${
                  selectedKey === p.key
                    ? 'bg-emerald-600 font-semibold text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="block">{p.title}</span>
                <span
                  dir="ltr"
                  className={`block text-start font-mono text-[11px] ${
                    selectedKey === p.key ? 'text-emerald-100' : 'text-slate-400'
                  }`}
                >
                  {PAGE_ROUTES[p.key] ?? `/${p.key}`}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div>
        {pageLoading && <Loading text="טוענים את העמוד…" />}

        {pageError && (
          <Alert tone="danger" className="flex flex-wrap items-center justify-between gap-3">
            <span>{pageError}</span>
            <Button variant="outline" onClick={() => selectPage(selectedKey)}>
              נסו שוב
            </Button>
          </Alert>
        )}

        {form && (
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">עריכת עמוד</h2>
                {meta?.updatedAt && (
                  <p className="mt-0.5 text-xs text-slate-400">
                    עודכן לאחרונה: {formatDateTimeHe(meta.updatedAt)}
                    {meta.updatedBy ? ` · על ידי ${meta.updatedBy}` : ''}
                  </p>
                )}
              </div>
              {liveRoute && (
                <Link
                  href={liveRoute}
                  target="_blank"
                  className="text-sm font-semibold text-emerald-700 hover:underline"
                >
                  צפייה בעמוד באתר ↗
                </Link>
              )}
            </div>

            <form onSubmit={handleSave} className="mt-5 space-y-5">
              <Field label="כותרת העמוד" required>
                <Input value={form.title} onChange={(e) => setField('title', e.target.value)} />
              </Field>

              <Field label="פסקת פתיחה" hint="הטקסט שמופיע מתחת לכותרת הראשית">
                <TextArea value={form.intro} onChange={(e) => setField('intro', e.target.value)} />
              </Field>

              <fieldset>
                <legend className="mb-2 text-sm font-bold text-slate-700">סקשנים בעמוד</legend>
                <div className="space-y-3">
                  {form.sections.map((section, idx) => (
                    <div key={section._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-400">סקשן {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => removeRow('sections', section._id)}
                        >
                          מחיקה
                        </Button>
                      </div>
                      <div className="mt-2 space-y-3">
                        <Field label="כותרת">
                          <Input
                            value={section.heading}
                            onChange={(e) => setRowField('sections', section._id, 'heading', e.target.value)}
                          />
                        </Field>
                        <Field label="תוכן">
                          <TextArea
                            value={section.body}
                            onChange={(e) => setRowField('sections', section._id, 'body', e.target.value)}
                          />
                        </Field>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => addRow('sections', { heading: '', body: '' })}
                >
                  + הוספת סקשן
                </Button>
              </fieldset>

              <fieldset>
                <legend className="mb-2 text-sm font-bold text-slate-700">קישורים חיצוניים</legend>
                {/* Requirement 14 needs at least three shops on /shop; warn before an
                    edit drops below that (the page itself falls back to its built-in list). */}
                {selectedKey === 'shop' && form.links.filter((l) => !l.url.includes('meshtastic.org/docs')).length < 3 && (
                  <Alert tone="warning" className="mb-3">
                    בעמוד החנויות נדרשים לפחות שלושה יעדי רכישה. כרגע מוגדרים פחות — האתר יציג את
                    רשימת ברירת המחדל המובנית עד שיתווספו קישורים.
                  </Alert>
                )}
                <div className="space-y-3">
                  {form.links.map((link, idx) => (
                    <div key={link._id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold text-slate-400">קישור {idx + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          className="px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          onClick={() => removeRow('links', link._id)}
                        >
                          מחיקה
                        </Button>
                      </div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
                        <Field label="טקסט הקישור">
                          <Input
                            value={link.label}
                            onChange={(e) => setRowField('links', link._id, 'label', e.target.value)}
                          />
                        </Field>
                        <Field label="כתובת (URL)">
                          <Input
                            dir="ltr"
                            placeholder="https://…"
                            value={link.url}
                            onChange={(e) => setRowField('links', link._id, 'url', e.target.value)}
                          />
                        </Field>
                        <div className="sm:col-span-2">
                          <Field label="תיאור קצר">
                            <Input
                              value={link.description}
                              onChange={(e) => setRowField('links', link._id, 'description', e.target.value)}
                            />
                          </Field>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-3"
                  onClick={() => addRow('links', { label: '', url: '', description: '' })}
                >
                  + הוספת קישור
                </Button>
              </fieldset>

              {saved && <Alert tone="success">נשמר! השינוי חי באתר מיידית.</Alert>}
              {saveError && <Alert tone="danger">{saveError}</Alert>}

              <Button type="submit" disabled={saving}>
                {saving ? 'שומרים…' : 'שמירה'}
              </Button>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
