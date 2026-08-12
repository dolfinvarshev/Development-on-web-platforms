'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Alert, Badge, Button, Card, Field, Input, Select } from '@/components/ui';
import { apiFetch } from '@/lib/api';
import { categoryLabel } from '@/lib/format';

const CATEGORIES = [
  {
    value: 'defib_lora',
    emoji: '📡',
    title: 'דפיברילטור + LoRa',
    description: 'יחידת LoRa מוצמדת לדפיברילטור ומשדרת מיקום גם ללא קליטה סלולרית',
  },
  {
    value: 'defib_only',
    emoji: '📱',
    title: 'דפיברילטור — טלפון בלבד',
    description: 'הדפיברילטור מדווח מיקום דרך הטלפון — מתאים היכן שיש קליטה סלולרית',
  },
  {
    value: 'lora_only',
    emoji: '📶',
    title: 'נושא/ת LoRa — מגבר רשת (מענק 50$)',
    description: 'ללא דפיברילטור — נשיאת יחידת LoRa מרחיבה את כיסוי הרשת ומזכה במענק',
  },
];

const CATEGORY_VALUES = new Set(CATEGORIES.map((c) => c.value));

// Mirrors the server-side validation in server/src/routes/registry.js exactly.
const PHONE_RE = /^05\d{8}$/;
const LORA_ID_RE = /^[0-9A-Fa-f]{4,23}$/;

const TRAINING_OPTIONS = ['אין', 'עזרה ראשונה', 'חובש/ת', 'פרמדיק/ית', 'אח/ות', 'רופא/ה'];

const EMPTY_FORM = {
  firstName: '',
  lastName: '',
  phone: '',
  loraId: '',
  medicalTraining: 'אין',
};

function formatPhone(digits) {
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function SummaryRow({ label, ltr = false, children }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 font-semibold text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900" dir={ltr ? 'ltr' : undefined}>
        {children}
      </dd>
    </div>
  );
}

export default function RegisterForm({ initialCategory }) {
  const [category, setCategory] = useState(
    CATEGORY_VALUES.has(initialCategory) ? initialCategory : 'defib_lora'
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState(false);
  const [success, setSuccess] = useState(null);

  const firstNameRef = useRef(null);
  const phoneRef = useRef(null);
  const loraIdRef = useRef(null);
  const fieldRefs = { firstName: firstNameRef, phone: phoneRef, loraId: loraIdRef };

  const needsLoraId = category !== 'defib_only';

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
    // A field being edited clears its own error immediately — friendlier than
    // leaving a stale message next to text that may already be valid.
    setErrors((prev) => {
      if (!prev[name]) return prev;
      const { [name]: _removed, ...rest } = prev;
      return rest;
    });
  }

  function selectCategory(value) {
    setCategory(value);
    if (value === 'defib_only') {
      setErrors((prev) => {
        const { loraId: _removed, ...rest } = prev;
        return rest;
      });
    }
  }

  function validate() {
    const next = {};
    if (!form.firstName.trim()) {
      next.firstName = 'נא להזין שם פרטי';
    }
    const phoneDigits = form.phone.replace(/[-\s]/g, '');
    if (!phoneDigits) {
      next.phone = 'נא להזין מספר נייד';
    } else if (!PHONE_RE.test(phoneDigits)) {
      next.phone = 'מספר נייד לא תקין — נדרש מספר ישראלי בן 10 ספרות, למשל 052-1234567';
    }
    if (needsLoraId) {
      const loraId = form.loraId.trim();
      if (!loraId) {
        next.loraId = 'נא להזין מזהה LoRa (DevEUI) — הוא מודפס על היחידה';
      } else if (!LORA_ID_RE.test(loraId)) {
        next.loraId = 'מזהה LoRa לא תקין — נדרשים 4 עד 23 תווים הקסדצימליים (0-9, A-F)';
      }
    }
    return next;
  }

  function focusFirstInvalid(errs) {
    for (const name of ['firstName', 'phone', 'loraId']) {
      if (errs[name] && fieldRefs[name].current) {
        fieldRefs[name].current.focus();
        return;
      }
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setServerError(false);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(nextErrors);
      return;
    }

    const body = {
      firstName: form.firstName.trim(),
      phone: form.phone.replace(/[-\s]/g, ''),
      category,
    };
    const lastName = form.lastName.trim();
    if (lastName) body.lastName = lastName;
    if (needsLoraId) body.loraId = form.loraId.trim();
    if (form.medicalTraining !== 'אין') body.medicalTraining = form.medicalTraining;

    setPending(true);
    try {
      await apiFetch('/api/register', { method: 'POST', body });
      setSuccess({
        firstName: body.firstName,
        lastName,
        phone: body.phone,
        category,
        loraId: body.loraId || null,
      });
    } catch (err) {
      if (err.status === 400 && err.data?.fields) {
        setErrors((prev) => ({ ...prev, ...err.data.fields }));
        focusFirstInvalid(err.data.fields);
      } else if (err.status === 409) {
        setErrors((prev) => ({
          ...prev,
          loraId: 'מזהה LoRa זה כבר רשום במערכת — כל יחידה נרשמת פעם אחת בלבד',
        }));
        loraIdRef.current?.focus();
      } else {
        setServerError(true);
      }
    } finally {
      setPending(false);
    }
  }

  function resetForm() {
    setSuccess(null);
    setForm(EMPTY_FORM);
    setErrors({});
    setServerError(false);
  }

  if (success) {
    return (
      <Card className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className="h-8 w-8 text-emerald-600"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="mt-4 text-2xl font-extrabold text-slate-900">
          ברוכים הבאים לרשת המצילה חיים!
        </h2>
        <p className="mt-2 text-slate-600">
          ההרשמה הושלמה — מעכשיו אתם חלק ממערך ההזנקה של דפי-נט.
        </p>

        <dl className="mt-6 divide-y divide-slate-100 rounded-xl border border-slate-200 text-start text-sm">
          <SummaryRow label="שם">
            {success.firstName}
            {success.lastName ? ` ${success.lastName}` : ''}
          </SummaryRow>
          <SummaryRow label="נייד" ltr>
            {formatPhone(success.phone)}
          </SummaryRow>
          <SummaryRow label="מסלול">{categoryLabel(success.category)}</SummaryRow>
          {success.loraId && (
            <SummaryRow label="מזהה LoRa" ltr>
              {success.loraId}
            </SummaryRow>
          )}
        </dl>

        {success.category === 'lora_only' && (
          <Badge color="amber" className="mt-4">
            מענק ה-50$ יטופל לאחר אימות המכשיר
          </Badge>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button as={Link} href="/">
            לעמוד הבית
          </Button>
          <Button as={Link} href="/simulator" variant="outline">
            צפו בסימולטור
          </Button>
          <Button variant="ghost" onClick={resetForm}>
            רישום נוסף
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <form onSubmit={handleSubmit} noValidate>
          <fieldset>
            <legend className="mb-3 block text-sm font-semibold text-slate-700">
              באיזה מסלול מצטרפים?
            </legend>
            <div role="radiogroup" aria-label="מסלול הצטרפות" className="grid gap-3 sm:grid-cols-3">
              {CATEGORIES.map((c) => (
                <label
                  key={c.value}
                  className={`cursor-pointer rounded-2xl border p-4 transition ${
                    category === c.value
                      ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-emerald-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="category"
                    value={c.value}
                    checked={category === c.value}
                    onChange={() => selectCategory(c.value)}
                    className="sr-only"
                  />
                  <span className="text-2xl" aria-hidden="true">
                    {c.emoji}
                  </span>
                  <span className="mt-2 block text-sm font-bold text-slate-900">{c.title}</span>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-500">
                    {c.description}
                  </span>
                </label>
              ))}
            </div>
            {errors.category && (
              <p className="mt-2 text-xs font-medium text-red-600">{errors.category}</p>
            )}
          </fieldset>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="שם פרטי" required error={errors.firstName}>
              <Input
                ref={firstNameRef}
                value={form.firstName}
                onChange={(e) => setField('firstName', e.target.value)}
                autoComplete="given-name"
                aria-invalid={Boolean(errors.firstName)}
              />
            </Field>
            <Field label="שם משפחה" error={errors.lastName}>
              <Input
                value={form.lastName}
                onChange={(e) => setField('lastName', e.target.value)}
                autoComplete="family-name"
                aria-invalid={Boolean(errors.lastName)}
              />
            </Field>
          </div>

          <div className="mt-4">
            <Field label="מספר נייד" required error={errors.phone}>
              <Input
                ref={phoneRef}
                type="tel"
                dir="ltr"
                placeholder="052-1234567"
                value={form.phone}
                onChange={(e) => setField('phone', e.target.value)}
                autoComplete="tel"
                aria-invalid={Boolean(errors.phone)}
              />
            </Field>
          </div>

          <div className="mt-4">
            {needsLoraId ? (
              <Field
                label="מזהה LoRa (DevEUI)"
                required
                error={errors.loraId}
                hint="המזהה הייחודי המודפס על יחידת ה-LoRa — 4 עד 23 תווים הקסדצימליים"
              >
                <Input
                  ref={loraIdRef}
                  dir="ltr"
                  placeholder="A1B2C3D4E5F6"
                  value={form.loraId}
                  onChange={(e) => setField('loraId', e.target.value)}
                  autoComplete="off"
                  aria-invalid={Boolean(errors.loraId)}
                />
              </Field>
            ) : (
              <Alert tone="info">
                במסלול זה המיקום מדווח מהטלפון — אין צורך במזהה LoRa
              </Alert>
            )}
          </div>

          <div className="mt-4">
            <Field label="הכשרה רפואית" hint="לא חובה — עוזר לנו לתעדף הזנקות">
              <Select
                value={form.medicalTraining}
                onChange={(e) => setField('medicalTraining', e.target.value)}
              >
                {TRAINING_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {serverError && (
            <Alert tone="danger" className="mt-4">
              שגיאה בהרשמה — נסו שוב
            </Alert>
          )}

          <Button type="submit" disabled={pending} className="mt-6 w-full">
            {pending ? 'נרשמים…' : 'הצטרפות לרשת'}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-xs text-slate-400">
        הפרטים משמשים להזנקה בלבד · אין דיוור שיווקי · ניתן להסרה בכל עת
      </p>
    </div>
  );
}
