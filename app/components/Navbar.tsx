'use client'

import Image from 'next/image'
import Link from 'next/link'
import styles from './Navbar.module.css'

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.navContent}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/Subconscious_Logo.png"
            alt="Subconscious"
            width={162}
            height={30}
            priority
            style={{ objectFit: 'contain' }}
          />
        </Link>
        <div className={styles.navLinks}>
          <Link href="/demo" className={styles.navLink}>Live Demo</Link>
          <a 
            href="https://docs.subconscious.dev" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.navButton}
          >
            Docs
          </a>
        </div>
      </div>
    </nav>
  )
}

