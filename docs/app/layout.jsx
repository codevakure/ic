import { Layout, Navbar } from 'nextra-theme-docs'
import { Head } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import { ThemeLogo } from '../components/theme-logo'
import 'nextra-theme-docs/style.css'
import '../styles/globals.css'

export const metadata = {
  title: {
    default: 'Ranger Documentation',
    template: '%s | Ranger Docs'
  },
  description: 'Complete documentation for Ranger application'
}

const navbar = (
  <Navbar
    logo={<ThemeLogo />}
  />
)

export default async function RootLayout({ children }) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
    >
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <script src="/docs/hide-copy-button.js" defer></script>
      </Head>
      <body>
        <Layout
          navbar={navbar}
          pageMap={await getPageMap()}
          footer={null}
          nextThemes={{
            defaultTheme: 'system',
            attribute: 'class',
            storageKey: 'theme'
          }}
          editLink={null}
          feedback={{
            content: null
          }}
          sidebar={{
            defaultMenuCollapseLevel: 1,
            autoCollapse: false,
            toggleButton: false
          }}
        >
          {children}
        </Layout>
      </body>
    </html>
  )
}