/**
 * [F1] Distress-flow diagram (requirement 4) — pure declarative SVG, server component.
 * Reads right-to-left: cardiac event (right) → two parallel channels
 * (LoRa/Meshtastic mesh on top, cellular SMS on bottom) → DefiNet server (left)
 * → outgoing push alert + LoRa downlink. Animation is SMIL only (no JS) and is
 * hidden under prefers-reduced-motion via the embedded style block.
 */

const C = {
  red: '#dc2626', // red-600 — the emergency event
  emerald: '#059669', // emerald-600 — path A (LoRa / Meshtastic)
  emeraldDark: '#065f46', // emerald-800
  emeraldSoft: '#ecfdf5', // emerald-50
  emeraldChip: '#d1fae5', // emerald-100
  sky: '#0284c7', // sky-600 — path B (cellular / SMS)
  skyDark: '#075985', // sky-800
  skySoft: '#e0f2fe', // sky-100
  slate: '#64748b', // slate-500 — secondary text
  slateBody: '#475569', // slate-600 — the person figure
  slateDark: '#1e293b', // slate-800 — the server
  slateLine: '#cbd5e1', // slate-300 — small device details
  window: '#e2e8f0', // slate-200
};

export default function DistressFlowDiagram() {
  return (
    <figure className="m-0">
      <div className="overflow-x-auto">
        <svg
          viewBox="0 0 960 520"
          className="h-auto w-full min-w-[720px]"
          role="img"
          aria-label="תרשים זרימה: קריאת מצוקה מאירוע דום לב עוברת בשני ערוצים במקביל — משדר LoRa בתדר 433MHz דרך ממסרי Meshtastic אל אמבולנס המשמש שער גישה, ובמקביל SMS עם שם, טלפון ומיקום דרך הרשת הסלולרית — שניהם אל שרת דפי-נט, שמזניק מתנדב קרוב בהתראת Push ובפקודת Downlink שמצפצפת ומהבהבת במכשיר ה-LoRa"
        >
          <style>{`@media (prefers-reduced-motion: reduce) { .dfd-anim { display: none; } }`}</style>

          <defs>
            <marker id="dfd-ah-emerald" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill={C.emerald} />
            </marker>
            <marker id="dfd-ah-sky" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill={C.sky} />
            </marker>
          </defs>

          {/* ── channel band labels ── */}
          <rect x="340" y="26" width="360" height="30" rx="15" fill={C.emeraldChip} />
          <text x="520" y="46" textAnchor="middle" fontSize="13.5" fontWeight="700" fill={C.emeraldDark}>
            נתיב 1 · LoRa + Meshtastic — עובד גם בלי קליטה סלולרית
          </text>
          <rect x="360" y="478" width="320" height="30" rx="15" fill={C.skySoft} />
          <text x="520" y="498" textAnchor="middle" fontSize="13.5" fontWeight="700" fill={C.skyDark}>
            נתיב 2 · SMS סלולרי — עם שם, טלפון ומיקום
          </text>

          {/* ── path A: LoRa beacon → mesh relays → ambulance gateway ── */}
          <g>
            {/* LoRa transmitter box */}
            <rect x="650" y="108" width="120" height="64" rx="12" fill={C.emeraldSoft} stroke={C.emerald} strokeWidth="2.5" />
            <line x1="748" y1="108" x2="748" y2="92" stroke={C.emerald} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="748" cy="89" r="3" fill={C.emerald} />
            <path d="M739 82 a10 10 0 0 0 0 14" fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <path d="M731 77 a15 15 0 0 0 0 24" fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" opacity="0.6" />
            <text x="710" y="140" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.emeraldDark}>משדר LoRa</text>
            <text x="710" y="159" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.emerald}>433MHz</text>

            {/* two Meshtastic relay nodes with radio-wave arcs */}
            {[585, 510].map((cx) => (
              <g key={cx}>
                <circle cx={cx} cy="140" r="15" fill="#ffffff" stroke={C.emerald} strokeWidth="2.5" />
                <circle cx={cx} cy="140" r="4.5" fill={C.emerald} />
                <line x1={cx} y1="125" x2={cx} y2="116" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" />
                <circle cx={cx} cy="113" r="2.5" fill={C.emerald} />
                <path d={`M${cx - 8} 106 a10 10 0 0 0 0 14`} fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
                <path d={`M${cx - 16} 101 a15 15 0 0 0 0 24`} fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" opacity="0.6" />
              </g>
            ))}
            <text x="548" y="92" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.emerald}>
              ממסרי Meshtastic — כל מכשיר מעביר הלאה
            </text>

            {/* ambulance = LoRa→Internet gateway */}
            <rect x="340" y="118" width="88" height="34" rx="6" fill="#ffffff" stroke={C.emerald} strokeWidth="2.5" />
            <rect x="316" y="128" width="26" height="24" rx="4" fill="#ffffff" stroke={C.emerald} strokeWidth="2.5" />
            <rect x="320" y="132" width="10" height="9" rx="2" fill={C.window} />
            <rect x="352" y="110" width="12" height="8" rx="2" fill={C.red} />
            <rect x="380.5" y="123" width="7" height="20" fill={C.red} />
            <rect x="374" y="129.5" width="20" height="7" fill={C.red} />
            <circle cx="356" cy="155" r="7" fill={C.slateDark} />
            <circle cx="356" cy="155" r="2.5" fill="#ffffff" />
            <circle cx="412" cy="155" r="7" fill={C.slateDark} />
            <circle cx="412" cy="155" r="2.5" fill="#ffffff" />
            <text x="372" y="192" textAnchor="middle" fontSize="13.5" fontWeight="700" fill={C.emerald}>
              אמבולנס = שער גישה Gateway
            </text>
          </g>

          {/* ── path B: witness phone → SMS → cell tower ── */}
          <g>
            {/* witness smartphone with emergency button on screen */}
            <rect x="690" y="362" width="44" height="80" rx="10" fill="#ffffff" stroke={C.sky} strokeWidth="2.5" />
            <rect x="696" y="370" width="32" height="56" rx="4" fill={C.skySoft} />
            <circle cx="712" cy="390" r="9" fill={C.red} />
            <rect x="710.5" y="384.5" width="3" height="11" fill="#ffffff" />
            <rect x="706.5" y="388.5" width="11" height="3" fill="#ffffff" />
            <circle cx="712" cy="434" r="2.5" fill={C.slateLine} />
            <text x="712" y="468" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.sky}>הטלפון של העד</text>

            {/* SMS bubble: name · phone · GPS point */}
            <rect x="495" y="372" width="160" height="58" rx="14" fill={C.skySoft} stroke={C.sky} strokeWidth="2" />
            <path d="M655 392 L674 401 L655 410" fill={C.skySoft} stroke={C.sky} strokeWidth="2" strokeLinejoin="round" />
            <text x="575" y="396" textAnchor="middle" fontSize="12" fontWeight="600" fill={C.skyDark} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              יוסי כהן · 052-1234567
            </text>
            <text x="575" y="416" textAnchor="middle" fontSize="12" fontWeight="600" fill={C.skyDark} fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
              {/* leading LRM forces the coordinate pair to render left-to-right inside the RTL page */}
              {'‎32.0809, 34.7806'}
            </text>
            <text x="575" y="468" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.sky}>
              SMS עם שם, טלפון ומיקום
            </text>

            {/* cell tower */}
            <polygon points="420,360 400,445 440,445" fill="none" stroke={C.sky} strokeWidth="2.5" strokeLinejoin="round" />
            <line x1="410" y1="402" x2="430" y2="402" stroke={C.sky} strokeWidth="2" />
            <line x1="405" y1="424" x2="435" y2="424" stroke={C.sky} strokeWidth="2" />
            <line x1="410" y1="402" x2="435" y2="424" stroke={C.sky} strokeWidth="1.5" />
            <line x1="430" y1="402" x2="405" y2="424" stroke={C.sky} strokeWidth="1.5" />
            <line x1="420" y1="360" x2="420" y2="346" stroke={C.sky} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="420" cy="343" r="3.5" fill={C.sky} />
            <path d="M408 334 a12 12 0 0 0 0 18" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <path d="M432 334 a12 12 0 0 1 0 18" fill="none" stroke={C.sky} strokeWidth="2" strokeLinecap="round" strokeDasharray="3 3" />
            <text x="420" y="468" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.sky}>רשת סלולרית</text>
          </g>

          {/* ── the cardiac event (right side) ── */}
          <g>
            <circle cx="868" cy="225" r="13" fill={C.slateBody} />
            <rect x="849" y="241" width="38" height="44" rx="15" fill={C.slateBody} />
            <circle cx="868" cy="258" r="5.5" fill={C.red} />
            <circle cx="868" cy="258" r="6" fill="none" stroke={C.red} strokeWidth="2" className="dfd-anim">
              <animate attributeName="r" values="6;20" dur="1.6s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="1.6s" repeatCount="indefinite" />
            </circle>
            <path
              d="M910 196 c-10.5 0 -17 7.6 -17 15.4 c0 10.9 17 30.6 17 30.6 c0 0 17 -19.7 17 -30.6 c0 -7.8 -6.5 -15.4 -17 -15.4 z"
              fill={C.red}
            />
            <circle cx="910" cy="211" r="5.5" fill="#ffffff" />
            <text x="868" y="308" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.red}>אירוע דום לב</text>
            <text x="868" y="326" textAnchor="middle" fontSize="14" fontWeight="700" fill={C.red}>+ נקודת GPS</text>
          </g>

          {/* ── outgoing side (far left): volunteer phone + beeping LoRa device ── */}
          <g>
            <rect x="76" y="128" width="42" height="76" rx="10" fill="#ffffff" stroke={C.sky} strokeWidth="2.5" />
            <rect x="82" y="136" width="30" height="54" rx="4" fill={C.skySoft} />
            <rect x="85" y="142" width="24" height="13" rx="3" fill={C.sky} />
            <rect x="88" y="147" width="13" height="2.5" rx="1" fill="#ffffff" opacity="0.9" />
            <circle cx="97" cy="197" r="2.5" fill={C.slateLine} />
            <text x="97" y="226" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.sky}>התראת Push</text>
            <text x="97" y="244" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.sky}>למתנדב הקרוב</text>

            <rect x="78" y="348" width="52" height="64" rx="10" fill={C.emeraldSoft} stroke={C.emerald} strokeWidth="2.5" />
            <line x1="104" y1="348" x2="104" y2="332" stroke={C.emerald} strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="104" cy="329" r="3" fill={C.emerald} />
            <circle cx="118" cy="362" r="4" fill={C.red} />
            <circle cx="118" cy="362" r="4" fill="none" stroke={C.red} strokeWidth="2" className="dfd-anim">
              <animate attributeName="r" values="4;12" dur="1.1s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.8;0" dur="1.1s" repeatCount="indefinite" />
            </circle>
            <rect x="87" y="372" width="34" height="22" rx="4" fill="#ffffff" stroke={C.slateLine} strokeWidth="1.5" />
            <circle cx="96" cy="402" r="1.8" fill={C.slate} />
            <circle cx="104" cy="402" r="1.8" fill={C.slate} />
            <circle cx="112" cy="402" r="1.8" fill={C.slate} />
            <path d="M68 364 a13 13 0 0 0 0 24" fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" />
            <path d="M56 356 a20 20 0 0 0 0 40" fill="none" stroke={C.emerald} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
            <text x="104" y="434" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.emerald}>פקודת Downlink</text>
            <text x="104" y="452" textAnchor="middle" fontSize="13" fontWeight="600" fill={C.emerald}>צפצוף + הבהוב</text>
          </g>

          {/* ── DefiNet server cloud (center-left) ── */}
          <path
            d="M167 300 a26 26 0 0 1 4 -51 a34 34 0 0 1 64 -16 a30 30 0 0 1 46 14 a24 24 0 0 1 2 53 z"
            fill={C.slateDark}
          />
          <text x="225" y="278" textAnchor="middle" fontSize="17" fontWeight="700" fill="#ffffff">שרת דפי-נט</text>
          <text x="225" y="322" textAnchor="middle" fontSize="12.5" fill={C.slate}>מדרג מועמדים ושולח התראות</text>

          {/* ── arrows: dashed = radio hop, solid = internet/cellular core ── */}
          <g fill="none" strokeWidth="2.5" strokeLinecap="round">
            {/* path A */}
            <path d="M844 230 C812 188 798 160 778 148" stroke={C.emerald} strokeDasharray="6 6" markerEnd="url(#dfd-ah-emerald)" />
            <path d="M645 140 L604 140" stroke={C.emerald} strokeDasharray="6 6" markerEnd="url(#dfd-ah-emerald)" />
            <path d="M567 140 L529 140" stroke={C.emerald} strokeDasharray="6 6" markerEnd="url(#dfd-ah-emerald)" />
            <path d="M492 140 L434 140" stroke={C.emerald} strokeDasharray="6 6" markerEnd="url(#dfd-ah-emerald)" />
            <path d="M310 152 C284 180 268 200 252 226" stroke={C.emerald} markerEnd="url(#dfd-ah-emerald)" />
            {/* path B */}
            <path d="M841 282 C800 332 772 356 742 380" stroke={C.sky} markerEnd="url(#dfd-ah-sky)" />
            <path d="M490 401 L446 401" stroke={C.sky} strokeDasharray="6 6" markerEnd="url(#dfd-ah-sky)" />
            <path d="M398 408 C352 398 314 358 280 306" stroke={C.sky} markerEnd="url(#dfd-ah-sky)" />
            {/* server → volunteer alerts */}
            <path d="M168 252 C150 226 140 208 124 186" stroke={C.sky} markerEnd="url(#dfd-ah-sky)" />
            <path d="M172 294 C158 316 146 330 132 346" stroke={C.emerald} strokeDasharray="6 6" markerEnd="url(#dfd-ah-emerald)" />
          </g>

          {/* ── animated message packets (SMIL, hidden under reduced-motion) ── */}
          <g className="dfd-anim">
            <circle r="5" fill={C.emerald} opacity="0.9">
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M848 238 C808 190 795 158 772 146 L648 140 L432 140 L312 146 C283 175 267 200 251 230"
              />
            </circle>
            <circle r="5" fill={C.sky} opacity="0.9">
              <animateMotion
                dur="5s"
                repeatCount="indefinite"
                path="M841 282 C795 335 770 360 740 382 L672 400 L493 400 C400 400 340 380 284 312"
              />
            </circle>
            <circle r="4" fill={C.sky} opacity="0.9">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M172 255 C155 228 142 208 124 184" />
            </circle>
            <circle r="4" fill={C.emerald} opacity="0.9">
              <animateMotion dur="2.5s" repeatCount="indefinite" path="M174 292 C158 316 144 330 128 346" />
            </circle>
          </g>
        </svg>
      </div>

      <figcaption className="mt-4 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-slate-600">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-600" aria-hidden="true" />
          אירוע דום לב
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-dashed border-emerald-600" aria-hidden="true" />
          נתיב LoRa / Meshtastic
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block w-6 border-t-2 border-sky-600" aria-hidden="true" />
          נתיב סלולרי (SMS + Push)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-800" aria-hidden="true" />
          שרת דפי-נט
        </span>
        <span>קו מקווקו = קפיצת רדיו · קו רציף = אינטרנט</span>
      </figcaption>
    </figure>
  );
}
