import { Alert, Button, Card, Section } from '@/components/ui';

/**
 * Shared CMS renderer for the marketing pages (guide / join / shop / maintenance).
 * Server component: receives a ContentPage document (or null when the API is
 * unreachable) and renders its sections as cards and its links as a grid.
 * linksVariant 'store' upgrades the link cards to prominent shop cards with a
 * "לחנות" button (used by the shop page).
 */
export default function ContentSections({
  page,
  linksVariant = 'default',
  linksTitle = 'קישורים שימושיים',
}) {
  if (!page) {
    return (
      <Section>
        <Alert tone="warning">התוכן אינו זמין כרגע — ודאו ששרת ה-API פועל.</Alert>
      </Section>
    );
  }

  const sections = page.sections || [];
  const links = page.links || [];
  if (sections.length === 0 && links.length === 0) return null;

  return (
    <Section>
      {sections.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section, i) => (
            <Card key={`${section.heading}-${i}`}>
              <h3 className="text-lg font-bold text-slate-900">{section.heading}</h3>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-600">
                {section.body}
              </p>
            </Card>
          ))}
        </div>
      )}

      {links.length > 0 && (
        <div className={sections.length > 0 ? 'mt-10' : ''}>
          <h3 className="text-xl font-bold text-slate-900">{linksTitle}</h3>

          {linksVariant === 'store' ? (
            <div className="mt-4 grid gap-5 md:grid-cols-2">
              {links.map((link) => (
                <Card key={link.url} className="flex flex-col">
                  <h4 className="text-lg font-bold text-slate-900">{link.label}</h4>
                  {link.description && (
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">
                      {link.description}
                    </p>
                  )}
                  <div className="mt-4">
                    <Button as="a" href={link.url} target="_blank" rel="noopener noreferrer">
                      לחנות <span aria-hidden="true">↗</span>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <p className="font-bold text-slate-900 group-hover:text-emerald-700">
                    {link.label}
                    <span aria-hidden="true" className="ms-1.5 text-emerald-600">
                      ↗
                    </span>
                  </p>
                  {link.description && (
                    <p className="mt-1 text-sm text-slate-500">{link.description}</p>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </Section>
  );
}
