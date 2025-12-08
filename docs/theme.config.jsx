import React from 'react'
import { ThemeLogo } from './components/theme-logo.tsx'

const config = {
  logo: <ThemeLogo />,
  project: {
    link: null // Remove GitHub link
  },
  chat: {
    link: null // Remove Discord link
  },
  docsRepositoryBase: null, // Remove edit link
  footer: {
    text: null // Remove footer
  },
  feedback: {
    content: null // Remove feedback
  },
  editLink: {
    text: null // Remove edit link
  },
  sidebar: {
    defaultMenuCollapseLevel: 1,
    autoCollapse: false,
    toggleButton: false
  },
  nextThemes: {
    defaultTheme: 'system',
    attribute: 'class',
    storageKey: 'theme'
  },
  // Ensure no copy button on code blocks
  useNextSeoProps() {
    return {
      titleTemplate: '%s – Ranger Docs'
    }
  }
}

export default config