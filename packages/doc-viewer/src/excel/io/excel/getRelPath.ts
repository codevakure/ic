/**
 */

export function getRelPath(path: string) {
  const arr = path.split('/');
  arr[arr.length - 1] = '_rels/' + arr[arr.length - 1] + '.rels';
  return arr.join('/');
}
