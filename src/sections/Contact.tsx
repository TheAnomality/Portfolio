import { useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { site } from '../content/site';
import { useSceneSection } from '../lib/hooks';
import { scrollToTarget } from '../lib/smooth-scroll';
import { ArrowUpRight, EASE, Magnetic, Reveal, RollText, SplitReveal } from '../components/ui';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'dev';

function ContactForm() {
  const [status, setStatus] = useState<Status>('idle');
  const github = site.socials.find((s) => s.label === 'GitHub')?.href;

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    setStatus('sending');
    try {
      const res = await fetch(site.contactEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      // `npm run dev` has no /api functions; they run on Vercel (or `vercel dev`).
      if (import.meta.env.DEV && res.status === 404) {
        setStatus('dev');
        return;
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean } | null;
      if (!res.ok || !json?.ok) throw new Error(`Contact form failed (${res.status})`);
      setStatus('sent');
      form.reset();
    } catch {
      setStatus('error');
    }
  };

  return (
    <form onSubmit={onSubmit} className="relative lg:col-span-3">
      <div className="grid gap-x-8 sm:grid-cols-2">
        <label className="block">
          <span className="label">Your name</span>
          <input name="name" required maxLength={100} autoComplete="name" className="form-field" placeholder="Ada Lovelace" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className="form-field" placeholder="ada@example.com" />
        </label>
      </div>
      <label className="mt-8 block">
        <span className="label">Message</span>
        <textarea
          name="message"
          required
          minLength={10}
          maxLength={5000}
          rows={5}
          className="form-field resize-none"
          placeholder="Tell me about your idea, project or role…"
        />
      </label>
      {/* Honeypot: people never see this field, bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[10000px] top-0 h-px w-px overflow-hidden">
        <label>
          Company
          <input name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <div className="mt-10 flex flex-wrap items-center gap-6">
        <Magnetic>
          <button type="submit" disabled={status === 'sending'} className="btn btn-accent disabled:opacity-60" data-cursor="Send">
            <RollText>{status === 'sending' ? 'Sending…' : 'Send message'}</RollText>
            <ArrowUpRight />
          </button>
        </Magnetic>
        <div role="status" aria-live="polite" className="min-h-6 text-sm">
          <AnimatePresence mode="wait">
            {status === 'sent' && (
              <motion.p key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[#4ade80]">
                Message received. Talk soon!
              </motion.p>
            )}
            {status === 'dev' && (
              <motion.p key="dev" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-muted">
                The form sends for real once deployed on Vercel (or run <code className="font-mono">vercel dev</code>).
              </motion.p>
            )}
            {status === 'error' && (
              <motion.p key="error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-muted">
                Couldn’t send that right now.{' '}
                {site.email ? (
                  <a className="text-fg underline underline-offset-4" href={`mailto:${site.email}`}>
                    Email me instead
                  </a>
                ) : github ? (
                  <a className="text-fg underline underline-offset-4" href={github} target="_blank" rel="noopener noreferrer">
                    Find me on GitHub
                  </a>
                ) : null}
                .
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </form>
  );
}

function CopyEmail({ email }: { email: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Magnetic>
      <button
        type="button"
        className="btn btn-ghost"
        data-cursor="Copy"
        onClick={() => {
          navigator.clipboard?.writeText(email).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          });
        }}
      >
        {copied ? 'Copied!' : email}
      </button>
    </Magnetic>
  );
}

export default function Contact() {
  const ref = useRef<HTMLElement>(null);
  useSceneSection(ref, { shape: 'portal', x: 0, y: 0.25, scale: 1.05, dim: 0.95, accent: '#ff6584', accent2: '#9d7bff' });

  return (
    <section id="contact" ref={ref} aria-labelledby="contact-title" className="relative py-32 md:py-40">
      <div className="shell">
        <div className="flex min-h-[80vh] flex-col items-center justify-center text-center">
          <Reveal>
            <p className="label">(05) Contact</p>
          </Reveal>
          <h2 id="contact-title" className="mt-8 font-display text-[clamp(2.8rem,9.5vw,10rem)] font-medium leading-[0.88] tracking-[-0.05em]">
            <SplitReveal text="Let’s build" />
            <br />
            <SplitReveal text="something" delay={0.2} />
            <br />
            <motion.span
              className="serif-accent accent-text inline-block font-normal tracking-normal"
              initial={{ opacity: 0, scale: 0.8, filter: 'blur(12px)' }}
              whileInView={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, delay: 0.5, ease: EASE }}
            >
              anomalous.
            </motion.span>
          </h2>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-10 max-w-md text-lg text-muted">Got an idea, a role or a wild experiment? Step through the portal.</p>
          </Reveal>
          <Reveal delay={0.3}>
            <div className="mt-10 flex flex-wrap justify-center gap-3">
              <Magnetic>
                <a
                  href="#contact-form"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToTarget('#contact-form', -120);
                  }}
                >
                  <RollText>Write me a message</RollText>
                </a>
              </Magnetic>
              {site.email && <CopyEmail email={site.email} />}
              {site.socials.map((s) => (
                <Magnetic key={s.href}>
                  <a href={s.href} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">
                    <RollText>{s.label}</RollText>
                    <ArrowUpRight />
                  </a>
                </Magnetic>
              ))}
            </div>
          </Reveal>
        </div>

        <div id="contact-form" className="mx-auto mt-16 grid max-w-6xl gap-14 rounded-[2rem] border border-line bg-void/60 p-7 backdrop-blur-xl md:p-12 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h3 className="font-display text-2xl font-medium tracking-tight md:text-3xl">Send a message</h3>
            <p className="mt-4 leading-relaxed text-muted">It goes straight to my inbox. Tell me what you’re dreaming up, and I’ll get back to you.</p>
            <p className="mt-8 flex items-center gap-2.5 text-sm text-fg/85">
              <span className="status-dot" aria-hidden="true" />
              {site.availability}
            </p>
          </div>
          <ContactForm />
        </div>
      </div>
    </section>
  );
}
