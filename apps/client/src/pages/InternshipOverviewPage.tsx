// Public, dedicated Internship Overview page. Reproduces the full content of the program
// page at samagama.in/internship — same structure, hierarchy, and copy — so visitors can
// read the complete internship information inside the portal without leaving for the
// external site. Open to anonymous visitors (rendered standalone, no AppShell/auth).
//
// The source is a static, server-rendered, cross-origin page, so it can't be fetched and
// parsed at runtime (CORS). The content below mirrors it verbatim; links that pointed at
// the samagama.in site resolve to their absolute URLs.
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { GlobalTooltip } from '../components/ui/GlobalTooltip';

const SAMAGAMA_URL = 'https://samagama.in/';
const FAQ_URL = 'https://samagama.in/internship/faq';

// External link to the samagama.in site, styled like the source's inline anchors.
function Ext({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--color-primary)', fontWeight: 600, textDecoration: 'none' }}
    >
      {children}
    </a>
  );
}

// A top-level section: a <h2> heading followed by its content, matching the source page.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 36 }}>
      <h2
        style={{
          fontSize: 21,
          fontWeight: 800,
          color: 'var(--color-text)',
          letterSpacing: '-0.02em',
          margin: '0 0 14px',
        }}
      >
        {title}
      </h2>
      {children}
    </section>
  );
}

const paraStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.7,
  color: 'var(--color-text-muted)',
  margin: '0 0 14px',
};

export function InternshipOverviewPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <GlobalTooltip />

      {/* ── Sticky header (mirrors the public Browse-FAQs page) ──────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'var(--color-card)',
          borderBottom: '1px solid var(--color-border)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div
          style={{
            maxWidth: 920,
            margin: '0 auto',
            padding: '12px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <Link to="/login" style={{ display: 'flex', alignItems: 'center', gap: 11, textDecoration: 'none' }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 11,
                background: 'var(--color-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 17,
                fontWeight: 900,
                color: 'white',
                letterSpacing: '-0.5px',
                boxShadow: '0 4px 14px rgba(124,58,237,0.32)',
              }}
            >
              S
            </div>
            <div>
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  color: 'var(--color-text)',
                  letterSpacing: '-0.4px',
                  lineHeight: 1.1,
                }}
              >
                Samagama
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--color-text-muted)', marginTop: 1 }}>
                Internship Portal
              </div>
            </div>
          </Link>

          <Link
            to="/login"
            className="btn btn-primary btn-sm"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            Sign in <ArrowRight size={15} />
          </Link>
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px 72px' }}>
        {/* Page hero — site title + tagline from the source header */}
        <div style={{ marginBottom: 8 }}>
          <h1
            style={{
              fontSize: 32,
              fontWeight: 900,
              color: 'var(--color-text)',
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Vicharanashala Internship
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)', fontWeight: 600, marginTop: 8 }}>
            Applied AI · Open-source software engineering · IIT Ropar
          </p>
        </div>

        {/* Lead */}
        <p style={{ ...paraStyle, fontSize: 16.5, color: 'var(--color-text)', marginTop: 24 }}>
          The Vicharanashala internship is a two-month, full-attention engagement at the lab of{' '}
          <strong>Prof. Sudarshan Iyengar</strong> at IIT Ropar. We work on real, open-source
          software for India-centric problems — agriculture (<em>Annam.AI</em>), education (
          <em>ViBe</em>), and a steady stream of other research-driven projects. This page describes
          the programme; the <Ext href={FAQ_URL}>FAQ</Ext> answers the operational questions.
        </p>

        <Section title="The programme">
          <p style={paraStyle}>
            Every selected candidate sees a yellow VINS result panel when they log in to{' '}
            <Ext href={SAMAGAMA_URL}>samagama.in</Ext>. That panel contains the next steps.
          </p>

          {/* VINS — Online track card */}
          <div className="mod-card mod-card-purple" style={{ padding: '20px 22px', marginTop: 4 }}>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 800,
                color: 'var(--color-text)',
                letterSpacing: '-0.01em',
                margin: '0 0 10px',
              }}
            >
              VINS — Online
            </h3>
            <p style={{ ...paraStyle, fontSize: 14.5 }}>
              <strong>Vicharanashala Internship.</strong> Open to every candidate who performed well
              in the AI interview. Conducted entirely online; you work from your own location.
            </p>
            <p style={{ ...paraStyle, fontSize: 14.5 }}>
              Start anytime in 2026. Two-month duration with a one-month grace period. Everything
              must finish by 31 December 2026.
            </p>
            <p style={{ ...paraStyle, fontSize: 14.5, marginBottom: 0 }}>
              <em>No stipend.</em> The programme itself is free for you — we charge nothing.
            </p>
          </div>
        </Section>

        <Section title="The four-badge journey">
          <p style={paraStyle}>
            This is the progression every intern follows. The first two badges are the internship
            proper; the last two are upside.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 14,
                color: 'var(--color-text)',
              }}
            >
              <thead>
                <tr>
                  {['Badge', 'Phase', 'What it is', 'Required to complete?'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderBottom: '2px solid var(--color-border)',
                        fontWeight: 700,
                        fontSize: 13,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    badge: '🥉 Bronze',
                    phase: '1',
                    what: 'Training — a course or a direct assignment, decided per candidate by the mentor based on what you already know',
                    required: 'Usually — entry',
                  },
                  {
                    badge: '🥈 Silver',
                    phase: '2',
                    what: 'An open-source project with a Vicharanashala mentor',
                    required: 'Yes — the actual work',
                  },
                  {
                    badge: '🥇 Gold',
                    phase: '3',
                    what: 'A genuinely significant Silver contribution — a feature in itself',
                    required: 'No — a quality mark on Silver',
                  },
                  {
                    badge: '🏆 Platinum',
                    phase: '4',
                    what: 'Open invitation to return to the lab in the next twelve months; nominal stipend on visit; the fourth star is earned during that visit',
                    required: 'No — post-internship pathway',
                  },
                ].map((row) => (
                  <tr key={row.badge}>
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--color-border)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {row.badge}
                    </td>
                    <td style={{ padding: '12px', borderBottom: '1px solid var(--color-border)' }}>
                      {row.phase}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)',
                        lineHeight: 1.5,
                      }}
                    >
                      {row.what}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        borderBottom: '1px solid var(--color-border)',
                        color: 'var(--color-text-muted)',
                      }}
                    >
                      {row.required}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section title="What we expect">
          <p style={paraStyle}>
            This is a serious internship, not a summer job. Plan for{' '}
            <strong>6 to 10 hours of focused work a day</strong>, sometimes more, for the full
            window. The most common reason interns drop out mid-way is competing commitments —
            exams, other internships, job hunts, travel. If your time is fragmented, please don't
            take this up. Wait for a window where you can give it full attention.
          </p>
          <p style={paraStyle}>
            <strong>Attendance and participation are tracked strictly.</strong> Over a rolling
            window of the last five working days, we expect you to attend at least <strong>85%</strong>{' '}
            of the live Zoom session time, respond to at least <strong>85%</strong> of the in-session
            polls and quizzes, and attempt every quiz with a pass mark of at least <strong>50%</strong>.
            If any one of these falls below the bar, you are excused from the current batch and moved
            to the next one — so you can rejoin when you are able to give it your full attention.
          </p>
          <p style={paraStyle}>
            If you complete both Bronze and Silver, you earn a certificate from Vicharanashala at IIT
            Ropar. If you drop out, you don't. The bar is high deliberately — the certificate means
            something because it's earned, not distributed.
          </p>
        </Section>

        <Section title="Project, technology, domain">
          <p style={paraStyle}>
            We do not pre-declare the problem you'll work on. The approach is{' '}
            <strong>problem-centred</strong>: based on your inclination and background, your mentor
            assigns a real lab problem, and you work backwards — learn the technology you need, then
            solve the problem.
          </p>
          <p style={paraStyle}>
            You may end up working on AI/ML, NLP, LLMs, web development, systems, agriculture-tech
            (Annam.AI), educational tech (ViBe), open-source infrastructure, or any other area
            depending on what fits. Insisting on a specific stack or domain after joining is not
            viewed favourably — students are expected to do the research required to work at a
            particular lab before applying.
          </p>
        </Section>

        <Section title="Why the interview is on samagama.in">
          <p style={paraStyle}>
            Every candidate goes through a structured AI-led interview at{' '}
            <Ext href={SAMAGAMA_URL}>samagama.in</Ext> with our interviewer agent, <em>Yaksha</em>.
            This is not a gimmick. The interview gives every applicant — irrespective of college
            brand, network, or geography — the same calibrated conversation about their work. Prof.
            Iyengar reads every transcript personally and forms his own view.
          </p>
          <p style={paraStyle}>
            If you have not yet completed the interview, please go to{' '}
            <Ext href={SAMAGAMA_URL}>samagama.in</Ext>, sign up, and engage in the chat seriously.
            The interview is the only formal assessment in this cycle. We do not use a separate test,
            coding round, or shortlist call.
          </p>

          {/* Note callout */}
          <div
            className="mod-card mod-card-blue"
            style={{ padding: '16px 18px', marginTop: 4, fontSize: 14, lineHeight: 1.65, color: 'var(--color-text-muted)' }}
          >
            The result panel on <Ext href={SAMAGAMA_URL}>samagama.in</Ext> (yellow VINS) confirms
            your selection and contains the canonical procedure for what to do next. Please read it
            carefully — most operational questions are answered there.
          </div>
        </Section>

        <Section title="Logistics in brief">
          <ul style={{ ...paraStyle, paddingLeft: 20, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>
              <strong>Result panel.</strong> Visible on samagama.in for one week after the result is
              declared. View it; opt in to VINS; complete the NOC step within this window.
            </li>
            <li>
              <strong>NOC.</strong> A No-Objection Certificate from your institution, signed and
              stamped by an authorised signatory (HOD, Acting HOD, Principal, Dean, or equivalent).
              We provide a printable NOC format — download it from the dashboard. Digital signatures
              are not accepted; we need a scanned copy of an original physical signature on the
              format we provide, with the institutional rubber stamp / seal applied in the
              designated area and the signatory's email filled in the designated field so we can
              cross-check.
            </li>
            <li>
              <strong>Offer letter.</strong> Issued automatically — immediately as a provisional
              offer if you submit a self-declaration, or on validation if you upload your NOC first.
              You may formally begin the internship only after your official NOC is uploaded and
              validated by us.
            </li>
            <li>
              <strong>During the internship.</strong> Discord for community, Zoom for meetings,
              GitHub for code, Yaksha chat for one-on-one queries.
            </li>
          </ul>
        </Section>

        <Section title="Cost">
          <p style={paraStyle}>
            The internship is <strong>free</strong>. We charge nothing — for the course, for
            mentorship, for any part of the programme. Vicharanashala is funded by initiatives,
            schemes, and funding agencies that cover the cost involved. Because someone else is
            paying for your participation, we keep the rigour high.
          </p>
          <p style={paraStyle}>
            It is the duty of the lab to upskill and give every student in the country an opportunity
            that the student deserves. Stellar performers may receive a selected stipend; we hope you
            reach that stage.
          </p>
        </Section>

        <Section title="What to do next">
          <ol style={{ ...paraStyle, paddingLeft: 22, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <li>
              Go to <Ext href={SAMAGAMA_URL}>samagama.in</Ext> and sign in.
            </li>
            <li>Read your result panel carefully. It tells you the track and the next step.</li>
            <li>
              Tell Yaksha you want to opt in to VINS, in the exact phrase shown on the panel.
            </li>
            <li>
              Download the NOC, get it signed and stamped, and upload it back via the{' '}
              <strong>Upload NOC</strong> button on the panel.
            </li>
            <li>
              Wait for your offer letter; show up on your start date with your full attention.
            </li>
          </ol>
        </Section>

        <p style={{ ...paraStyle, marginTop: 28 }}>
          If you have a question this page doesn't answer, the <Ext href={FAQ_URL}>FAQ</Ext> covers
          most of it. If neither covers your case, log in at{' '}
          <Ext href={SAMAGAMA_URL}>samagama.in</Ext> and ask Yaksha — that is the only support
          channel we operate.
        </p>

        {/* Footer (mirrors the source page footer) */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: '1px solid var(--color-border)',
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--color-text-muted)',
            lineHeight: 1.7,
          }}
        >
          <div>Vicharanashala Lab · Indian Institute of Technology Ropar · 2026 cycle</div>
          <div>
            Questions: log in at <Ext href={SAMAGAMA_URL}>samagama.in</Ext> and ask Yaksha.
          </div>
        </div>
      </main>
    </div>
  );
}
