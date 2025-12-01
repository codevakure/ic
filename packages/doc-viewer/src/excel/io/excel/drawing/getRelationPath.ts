import {joinPath} from '../../../../util/joinPath';
import {IRelationship} from '../../../types/IRelationship';

export function getRelationPath(
  drawingPath: string,
  relationships: IRelationship[],
  rId: string
) {
  const relationship = relationships.find(
    relationship => relationship.id === rId
  );
  if (relationship) {
    const target = relationship.target;
    console.log('[getRelationPath] Input:', { drawingPath, rId, target });
    
    // Handle both relative (../media/image1.png) and absolute (xl/media/image1.png) paths
    let resolvedPath: string;
    if (target.startsWith('xl/') || target.startsWith('/xl/')) {
      // Absolute path - just remove leading slash
      resolvedPath = target.replace(/^\//, '');
      console.log('[getRelationPath] Detected absolute path, resolved:', resolvedPath);
    } else {
      // Relative path - resolve from drawing directory
      const drawingDir = drawingPath.substring(0, drawingPath.lastIndexOf('/'));
      resolvedPath = joinPath(drawingDir, target);
      console.log('[getRelationPath] Detected relative path, drawingDir:', drawingDir, 'resolved:', resolvedPath);
    }
    return resolvedPath;
  }
  return null;
}
