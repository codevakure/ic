/**
 */

export interface Relationship {
  id: string;
  type: string;
  target: string;
  targetMode?: string;
  // [comment removed]
  part: 'root' | 'word';
}

export function parseRelationship(
  element: Element,
  part: 'root' | 'word'
): Relationship {
  const id = element.getAttribute('Id') || '';
  const type = element.getAttribute('Type') || '';
  const target = element.getAttribute('Target') || '';
  const targetMode = element.getAttribute('TargetMode') || '';
  return {
    id,
    type,
    target,
    targetMode,
    part
  };
}

export function parseRelationships(
  element: Document,
  part: 'root' | 'word'
): Record<string, Relationship> {
  const relationships: Record<string, Relationship> = {};

  const relationshipElements = element.getElementsByTagName('Relationship');
  for (let i = 0; i < relationshipElements.length; i++) {
    const relationshipElement = relationshipElements[i];
    const relationship = parseRelationship(relationshipElement, part);
    relationships[relationship.id] = relationship;
  }

  return relationships;
}
