'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import styles from './page.module.css'
import Navbar from './components/Navbar'

export default function Home() {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const [activeTab, setActiveTab] = useState<'python' | 'javascript'>('python')

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    const elements = document.querySelectorAll('.animate-on-scroll')
    elements.forEach((el) => observerRef.current?.observe(el))

    return () => observerRef.current?.disconnect()
  }, [])

  return (
    <>
      <Navbar />

      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroBackground}>
          <div className={styles.gradientOrb1} />
          <div className={styles.gradientOrb2} />
          <div className={styles.gradientOrb3} />
          <Image
            src="/Subconscious_Logo_Graphic.png"
            alt=""
            width={600}
            height={600}
            className={styles.floatingLogo}
            priority
          />
        </div>

        <div className={styles.heroContent}>
          <div className={`${styles.heroBadge} fade-in-up`}>
            <Image
              src="/Subconscious_Logo_Graphic.png"
              alt=""
              width={20}
              height={20}
            />
            <span>Built with Subconscious Agent SDK</span>
          </div>
          <h1 className={`${styles.heroTitle} fade-in-up delay-100`}>
            Degree Planner
            <br />
            <span className={styles.heroTitleAccent}>Demo</span>
          </h1>
          <p className={`${styles.heroSubtitle} fade-in-up delay-200`}>
            A showcase of the <strong>Subconscious Agent SDK</strong> building 4-year
            degree plans from live university catalogs. No scraped data—the agent searches,
            extracts, and reasons about requirements in real-time.
          </p>
          <div className={`${styles.heroCta} fade-in-up delay-300`}>
            <Link href="/demo" className={styles.ctaPrimary}>
              Try the Demo
              <span className={styles.ctaArrow}>→</span>
            </Link>
            <a href="https://github.com/subconscious-ai/school-scheduler" target="_blank" rel="noopener noreferrer" className={styles.ctaSecondary}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View Source
            </a>
          </div>
        </div>
      </section>

      {/* What is Subconscious Section */}
      <section id="sdk" className={styles.sdkSection}>
        <div className={styles.sdkContent}>
          <div className={`${styles.sdkText} animate-on-scroll slide-in-left`}>
            <p className={styles.sectionTagline}>
              <span className={styles.mono}>{'{'}</span> The Platform <span className={styles.mono}>{'}'}</span>
            </p>
            <h2 className={styles.sectionTitle}>
              What is
              <br />
              <span className={styles.sectionTitleAccent}>Subconscious?</span>
            </h2>
            <p className={styles.sdkDesc}>
              Subconscious is a cutting-edge platform for building <strong>autonomous AI agents</strong>.
              Unlike traditional automation, Subconscious agents understand context, reason about
              constraints, and make intelligent decisions—just like a human would, but at machine speed.
            </p>
            <p className={styles.sdkDesc}>
              This demo showcases the agent-first approach: instead of maintaining brittle scrapers
              and stale databases, we let the agent search official university catalogs in real-time,
              extract degree requirements, and build personalized 4-year plans.
            </p>
            <div className={styles.sdkHighlights}>
              <div className={styles.sdkHighlight}>
                <span className={styles.highlightIcon}>🔍</span>
                <div>
                  <strong>Live Search + Grounding</strong>
                  <p>Agent searches official catalogs—no stale data or broken scrapers</p>
                </div>
              </div>
              <div className={styles.sdkHighlight}>
                <span className={styles.highlightIcon}>🧠</span>
                <div>
                  <strong>Structured Extraction</strong>
                  <p>Converts unstructured catalog pages into validated requirement graphs</p>
                </div>
              </div>
              <div className={styles.sdkHighlight}>
                <span className={styles.highlightIcon}>💬</span>
                <div>
                  <strong>Explanation-First UX</strong>
                  <p>Every decision comes with sources, reasoning, and confidence levels</p>
                </div>
              </div>
            </div>
          </div>
          <div className={`${styles.sdkVisual} animate-on-scroll slide-in-right`}>
            <div className={styles.codeBlock}>
              <div className={styles.codeHeader}>
                <span className={styles.codeDot} />
                <span className={styles.codeDot} />
                <span className={styles.codeDot} />
                <div className={styles.codeTabs}>
                  <button
                    className={`${styles.codeTab} ${activeTab === 'python' ? styles.codeTabActive : ''}`}
                    onClick={() => setActiveTab('python')}
                  >
                    Python
                  </button>
                  <button
                    className={`${styles.codeTab} ${activeTab === 'javascript' ? styles.codeTabActive : ''}`}
                    onClick={() => setActiveTab('javascript')}
                  >
                    JavaScript
                  </button>
                </div>
              </div>
              {activeTab === 'python' ? (
                <pre className={styles.codeContent}>
                  {`from subconscious import Subconscious

client = Subconscious(api_key="sk-sub-...")

run = client.run(
    engine="tim-large",
    input={
        "instructions": "Search for the latest AI news",
        "tools": [{"type": "platform", "id": "parallel_search"}],
    },
    options={"await_completion": True},
)

print(run.result.answer)`}
                </pre>
              ) : (
                <pre className={styles.codeContent}>
                  {`import { Subconscious } from 'subconscious';

const client = new Subconscious({
  apiKey: process.env.SUBCONSCIOUS_API_KEY,
});

const run = await client.run({
  engine: 'tim-large',
  input: {
    instructions: 'Search for the latest AI news',
    tools: [{ type: 'platform', id: 'parallel_search' }],
  },
  options: { awaitCompletion: true },
});

console.log(run.result?.answer);`}
                </pre>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Capabilities Section */}
      <section id="capabilities" className={styles.features}>
        <div className={styles.featuresContent}>
          <div className={`${styles.sectionHeader} animate-on-scroll fade-in-up`}>
            <p className={styles.sectionTagline}>
              <span className={styles.mono}>{'<'}</span> Capabilities <span className={styles.mono}>{'/>'}</span>
            </p>
            <h2 className={styles.sectionTitle}>
              What the SDK enables
              <br />
              <span className={styles.sectionTitleAccent}>in this demo</span>
            </h2>
            <p className={styles.sectionSubtitle}>
              Each feature below is powered by Subconscious agents working together autonomously.
            </p>
          </div>

          <div className={styles.featureGrid}>
            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-100`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Live Catalog Search</h3>
              <p className={styles.featureDesc}>
                The agent searches official university catalogs in real-time
                to find accurate, up-to-date degree requirements—no pre-scraping needed.
              </p>
              <code className={styles.featureCode}>client.run(engine=&quot;tim-large&quot;)</code>
            </div>

            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-200`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 6v6l4 2" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Requirement Extraction</h3>
              <p className={styles.featureDesc}>
                Converts complex catalog prose into structured requirement groups:
                AND, OR, and CHOOSE-N with prerequisite chains.
              </p>
              <code className={styles.featureCode}>input={`{`}&quot;instructions&quot;: ...{`}`}</code>
            </div>

            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-300`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Streaming Responses</h3>
              <p className={styles.featureDesc}>
                Watch the agent think in real-time. See its reasoning, decisions, and
                optimizations as they happen—not just the final result.
              </p>
              <code className={styles.featureCode}>client.stream(engine, input)</code>
            </div>

            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-400`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Source Citation</h3>
              <p className={styles.featureDesc}>
                Every requirement includes source URLs and explanations. Ambiguous
                requirements are flagged with advisor verification notes.
              </p>
              <code className={styles.featureCode}>client.wait(run_id, options)</code>
            </div>

            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-500`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Smart Schedule Planning</h3>
              <p className={styles.featureDesc}>
                Understands co-op programs, internships, and generates multi-year
                plans with proper course sequencing and prerequisites.
              </p>
              <code className={styles.featureCode}>tools=[{`{`}&quot;type&quot;: &quot;platform&quot;{`}`}]</code>
            </div>

            <div className={`${styles.featureCard} animate-on-scroll fade-in-up delay-600`}>
              <div className={styles.featureIcon}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h3 className={styles.featureTitle}>Structured Output</h3>
              <p className={styles.featureDesc}>
                Get type-safe responses using Pydantic models. Define your schema once and
                receive perfectly formatted data every time.
              </p>
              <code className={styles.featureCode}>answerFormat=PydanticModel</code>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Schools Section */}
      <section id="schools" className={styles.schoolsSection}>
        <div className={styles.schoolsContent}>
          <div className={`${styles.schoolsHeader} animate-on-scroll fade-in-up`}>
            <p className={styles.sectionTagline}>
              <span className={styles.mono}>{'['}</span> Supported Schools <span className={styles.mono}>{']'}</span>
            </p>
            <h2 className={styles.sectionTitle}>
              Boston-Area
              <br />
              <span className={styles.sectionTitleAccent}>Universities</span>
            </h2>
            <p className={styles.schoolsSubtitle}>
              Each school has custom-tuned prompting that understands its unique credit systems,
              course codes, degree requirements, and curriculum structures.
            </p>
          </div>

          <div className={styles.schoolsGrid}>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-100`}>
              <div className={styles.schoolName}>Northeastern University</div>
              <div className={styles.schoolLocation}>Boston, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-100`}>
              <div className={styles.schoolName}>MIT</div>
              <div className={styles.schoolLocation}>Cambridge, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-100`}>
              <div className={styles.schoolName}>Harvard University</div>
              <div className={styles.schoolLocation}>Cambridge, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-200`}>
              <div className={styles.schoolName}>Boston University</div>
              <div className={styles.schoolLocation}>Boston, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-200`}>
              <div className={styles.schoolName}>Boston College</div>
              <div className={styles.schoolLocation}>Chestnut Hill, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-200`}>
              <div className={styles.schoolName}>Tufts University</div>
              <div className={styles.schoolLocation}>Medford, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-300`}>
              <div className={styles.schoolName}>Brandeis University</div>
              <div className={styles.schoolLocation}>Waltham, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-300`}>
              <div className={styles.schoolName}>Bentley University</div>
              <div className={styles.schoolLocation}>Waltham, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-300`}>
              <div className={styles.schoolName}>Suffolk University</div>
              <div className={styles.schoolLocation}>Boston, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-400`}>
              <div className={styles.schoolName}>UMass Boston</div>
              <div className={styles.schoolLocation}>Boston, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-400`}>
              <div className={styles.schoolName}>UMass Amherst</div>
              <div className={styles.schoolLocation}>Amherst, MA</div>
            </div>
            <div className={`${styles.schoolCard} animate-on-scroll fade-in-up delay-400`}>
              <div className={styles.schoolName}>WPI</div>
              <div className={styles.schoolLocation}>Worcester, MA</div>
            </div>
          </div>

          <div className={`${styles.schoolsNote} animate-on-scroll fade-in-up delay-500`}>
            <p>
              <strong>Why school-specific prompting matters:</strong> Each university has unique credit systems
              (units vs credits), course prefixes (CS vs COSI vs COMP), BA/BS distinctions, and core curriculum
              requirements. Our agent knows the difference between Northeastern&apos;s 4-credit courses and
              Bentley&apos;s 3-credit structure, between Harvard&apos;s concentration model and BU&apos;s group-based major.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.ctaBackground}>
          <div className={styles.ctaOrb1} />
          <div className={styles.ctaOrb2} />
        </div>
        <div className={`${styles.ctaContent} animate-on-scroll scale-in`}>
          <Image
            src="/Subconscious_Logo_Graphic.png"
            alt=""
            width={60}
            height={60}
            className={styles.ctaIcon}
          />
          <h2 className={styles.ctaTitle}>
            Build with
            <br />
            Subconscious
          </h2>
          <p className={styles.ctaSubtitle}>
            Ready to add autonomous AI agents to your own projects?
            The SDK that powers this demo is available now.
          </p>
          <div className={styles.ctaActions}>
            <a href="https://docs.subconscious.dev" target="_blank" rel="noopener noreferrer" className={styles.ctaButtonPrimary}>
              Read the Docs
              <span className={styles.ctaArrow}>→</span>
            </a>
            <a href="https://subconscious.dev" target="_blank" rel="noopener noreferrer" className={styles.ctaButtonSecondary}>
              Visit Subconscious
            </a>
          </div>
          <div className={styles.ctaInstall}>
            <code>pip install subconscious-sdk</code>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerBrand}>
            <Image
              src="/Subconscious_Logo.png"
              alt="Subconscious"
              width={130}
              height={24}
              style={{ objectFit: 'contain' }}
            />
            <p className={styles.footerDesc}>
              This demo showcases the capabilities of the Subconscious Agent SDK
              for building autonomous AI systems.
            </p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Demo</h4>
              <Link href="/demo">Live Demo</Link>
              <a href="#capabilities">Capabilities</a>
              <a href="#sdk">About SDK</a>
            </div>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Subconscious</h4>
              <a href="https://subconscious.dev" target="_blank" rel="noopener noreferrer">Website</a>
              <a href="https://docs.subconscious.dev" target="_blank" rel="noopener noreferrer">Documentation</a>
              <a href="https://github.com/subconscious-ai" target="_blank" rel="noopener noreferrer">GitHub</a>
            </div>
            <div className={styles.footerCol}>
              <h4 className={styles.footerColTitle}>Resources</h4>
              <a href="https://docs.subconscious.dev/api-reference" target="_blank" rel="noopener noreferrer">API Reference</a>
              <a href="https://docs.subconscious.dev/examples" target="_blank" rel="noopener noreferrer">Examples</a>
              <a href="https://discord.gg/subconscious" target="_blank" rel="noopener noreferrer">Discord</a>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <p>A Subconscious SDK Demo • Showcasing Autonomous AI Agents</p>
        </div>
      </footer>
    </>
  )
}
