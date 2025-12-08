import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import { Cards } from 'nextra/components'

const docsComponents = getDocsMDXComponents()

export function useMDXComponents(components) {
  return {
    ...docsComponents,
    Cards,
    ...components
  }
}