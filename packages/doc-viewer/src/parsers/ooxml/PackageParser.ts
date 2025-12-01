import { ZipParser } from '../zip/ZipParser';

/**
 * OOXML Content Type
 */
export interface ContentType {
  extension: string;
  contentType: string;
}

/**
 * OOXML Relationship
 */
export interface Relationship {
  id: string;
  type: string;
  target: string;
  targetMode?: 'Internal' | 'External';
}

/**
 * OOXML Package Parser
 * Parses the structure of Office Open XML packages (DOCX, XLSX, PPTX)
 */
export class PackageParser {
  private zipParser: ZipParser;
  private contentTypes: Map<string, string> = new Map();
  private relationships: Map<string, Relationship[]> = new Map();

  constructor(zipParser: ZipParser) {
    this.zipParser = zipParser;
  }

  /**
   * Parse package structure
   */
  async parse(): Promise<void> {
    await this.parseContentTypes();
    await this.parseRelationships();
  }

  /**
   * Parse [Content_Types].xml
   */
  private async parseContentTypes(): Promise<void> {
    const doc = this.zipParser.getFileAsXml('[Content_Types].xml');
    if (!doc) {
      throw new Error('Missing [Content_Types].xml');
    }

    const root = doc.documentElement;

    // Parse Default elements (by extension)
    const defaults = root.querySelectorAll('Default');
    for (let i = 0; i < defaults.length; i++) {
      const element = defaults[i];
      if (!element) continue;
      const extension = element.getAttribute('Extension');
      const contentType = element.getAttribute('ContentType');
      if (extension && contentType) {
        this.contentTypes.set(`.${extension}`, contentType);
      }
    }

    // Parse Override elements (by part name)
    const overrides = root.querySelectorAll('Override');
    for (let i = 0; i < overrides.length; i++) {
      const element = overrides[i];
      if (!element) continue;
      const partName = element.getAttribute('PartName');
      const contentType = element.getAttribute('ContentType');
      if (partName && contentType) {
        this.contentTypes.set(partName, contentType);
      }
    }
  }

  /**
   * Parse relationships from _rels/.rels and other .rels files
   */
  private async parseRelationships(): Promise<void> {
    // Parse root relationships
    const rootRels = this.parseRelationshipFile('_rels/.rels');
    if (rootRels) {
      this.relationships.set('', rootRels);
    }

    // Find and parse all other .rels files
    const relsPaths = this.zipParser.getFilesByPattern(/\.rels$/);
    for (const entry of relsPaths) {
      if (entry.name === '_rels/.rels') continue;

      const rels = this.parseRelationshipFile(entry.name);
      if (rels) {
        // Extract the source part name from .rels path
        // e.g., "word/_rels/document.xml.rels" -> "word/document.xml"
        const sourcePart = entry.name.replace('/_rels/', '/').replace('.rels', '');
        this.relationships.set(sourcePart, rels);
      }
    }
  }

  /**
   * Parse a single relationship file
   */
  private parseRelationshipFile(path: string): Relationship[] | undefined {
    const doc = this.zipParser.getFileAsXml(path);
    if (!doc) return undefined;

    const relationships: Relationship[] = [];
    const relElements = doc.documentElement.querySelectorAll('Relationship');

    for (let i = 0; i < relElements.length; i++) {
      const element = relElements[i];
      if (!element) continue;
      const id = element.getAttribute('Id');
      const type = element.getAttribute('Type');
      const target = element.getAttribute('Target');
      const targetMode = element.getAttribute('TargetMode') as 'Internal' | 'External' | null;

      if (id && type && target) {
        relationships.push({
          id,
          type,
          target,
          targetMode: targetMode || 'Internal',
        });
      }
    }

    return relationships;
  }

  /**
   * Get content type for a part
   */
  getContentType(partName: string): string | undefined {
    // Try exact match first
    if (this.contentTypes.has(partName)) {
      return this.contentTypes.get(partName);
    }

    // Try by extension
    const extension = partName.split('.').pop();
    if (extension) {
      return this.contentTypes.get(`.${extension}`);
    }

    return undefined;
  }

  /**
   * Get relationships for a part
   */
  getRelationships(partName: string = ''): Relationship[] {
    return this.relationships.get(partName) || [];
  }

  /**
   * Get relationship by ID
   */
  getRelationshipById(partName: string, relationshipId: string): Relationship | undefined {
    const rels = this.getRelationships(partName);
    return rels.find(rel => rel.id === relationshipId);
  }

  /**
   * Get relationships by type
   */
  getRelationshipsByType(partName: string, type: string): Relationship[] {
    const rels = this.getRelationships(partName);
    return rels.filter(rel => rel.type.endsWith(type) || rel.type === type);
  }

  /**
   * Resolve relationship target to absolute path
   */
  resolveTarget(sourcePart: string, target: string): string {
    if (target.startsWith('/')) {
      return target.slice(1);
    }

    // Get directory of source part
    const sourceDir = sourcePart.includes('/') 
      ? sourcePart.substring(0, sourcePart.lastIndexOf('/'))
      : '';

    // Resolve relative path
    const parts = (sourceDir ? `${sourceDir}/${target}` : target).split('/');
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '..') {
        resolved.pop();
      } else if (part !== '.' && part !== '') {
        resolved.push(part);
      }
    }

    return resolved.join('/');
  }

  /**
   * Get main document part (varies by document type)
   */
  getMainDocumentPart(): string | undefined {
    // Look for office document relationship in root relationships
    const rootRels = this.getRelationships('');
    
    // Word: officeDocument
    const wordRel = rootRels.find(rel => 
      rel.type.includes('officeDocument') || 
      rel.type.includes('document')
    );
    if (wordRel) {
      return this.resolveTarget('', wordRel.target);
    }

    return undefined;
  }
}
