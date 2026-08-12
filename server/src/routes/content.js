// [B4] CMS content — marketing pages live in MongoDB and are edited from the admin panel.
// Contract: docs/ARCHITECTURE.md §6 (CMS content).
import { Router } from 'express';
import { ContentPage } from '../db/mongo.js';
import { requireAdmin } from '../middleware/requireAdmin.js';

const router = Router();

// Express 4 does not forward rejected promises from async handlers to the error middleware.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Only http(s) URLs may be stored for a link. The admin login is public by spec
// (micha/1234 is printed on the login screen), so an unsanitized `javascript:`
// or `data:` URL saved here would become clickable stored-XSS on the public
// marketing pages, which render it as <a href> / <Button as="a" href>.
function safeHttpUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const { protocol } = new URL(raw);
    return protocol === 'http:' || protocol === 'https:' ? raw : '';
  } catch {
    return '';
  }
}

function serializePage(doc) {
  return {
    id: String(doc._id),
    key: doc.key,
    title: doc.title,
    intro: doc.intro,
    sections: (doc.sections ?? []).map((s) => ({ heading: s.heading, body: s.body })),
    links: (doc.links ?? []).map((l) => ({
      label: l.label,
      url: l.url,
      description: l.description,
    })),
    updatedAt: doc.updatedAt,
    updatedBy: doc.updatedBy,
  };
}

// GET /api/content — page index for the admin content editor.
router.get(
  '/',
  wrap(async (req, res) => {
    const docs = await ContentPage.find({}, 'key title updatedAt').sort({ key: 1 });
    res.json({
      pages: docs.map((d) => ({ key: d.key, title: d.title, updatedAt: d.updatedAt })),
    });
  })
);

// GET /api/content/:key — one page (public: marketing pages render from this).
router.get(
  '/:key',
  wrap(async (req, res) => {
    const doc = await ContentPage.findOne({ key: req.params.key });
    if (!doc) return res.status(404).json({ error: 'not_found' });
    res.json({ page: serializePage(doc) });
  })
);

// PUT /api/content/:key — admin upsert. The body is coerced field-by-field so a broken
// client can never persist non-string junk or extra keys into a page document.
router.put(
  '/:key',
  requireAdmin,
  wrap(async (req, res) => {
    const body = req.body ?? {};
    const clean = {
      title: String(body.title ?? ''),
      intro: String(body.intro ?? ''),
      sections: (Array.isArray(body.sections) ? body.sections : []).map((s) => ({
        heading: String(s?.heading ?? ''),
        body: String(s?.body ?? ''),
      })),
      links: (Array.isArray(body.links) ? body.links : []).map((l) => ({
        label: String(l?.label ?? ''),
        url: safeHttpUrl(l?.url),
        description: String(l?.description ?? ''),
      })),
    };
    const doc = await ContentPage.findOneAndUpdate(
      { key: req.params.key },
      { ...clean, updatedBy: req.admin.username },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ page: serializePage(doc) });
  })
);

export default router;
