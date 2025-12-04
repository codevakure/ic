import {
  TextPaths,
  FilePaths,
  CodePaths,
  AudioPaths,
  VideoPaths,
  SheetPaths,
  DocumentPaths,
  PDFPaths,
  CSVPaths,
  ExcelPaths,
  PPTPaths,
  ZipPaths,
  HTMLPaths,
  PythonPaths,
  JavaScriptPaths,
  TypeScriptPaths,
  SQLPaths,
  JSONPaths,
  CSSPaths,
  MarkdownPaths,
  YAMLPaths,
  ShellPaths,
  XMLPaths,
} from '@ranger/client';
import {
  megabyte,
  QueryKeys,
  excelMimeTypes,
  EToolResources,
  codeTypeMapping,
  fileConfig as defaultFileConfig,
} from 'ranger-data-provider';
import type { TFile, EndpointFileConfig, FileConfig } from 'ranger-data-provider';
import type { QueryClient } from '@tanstack/react-query';
import type { ExtendedFile } from '~/common';

export const partialTypes = ['text/x-'];

const textDocument = {
  paths: TextPaths,
  fill: 'transparent',
  title: 'Document',
};

const wordDocument = {
  paths: DocumentPaths,
  fill: 'transparent',
  title: 'Word Document',
};

const pdfDocument = {
  paths: PDFPaths,
  fill: 'transparent',
  title: 'PDF Document',
};

const spreadsheet = {
  paths: ExcelPaths,
  fill: 'transparent',
  title: 'Spreadsheet',
};

const csvFile = {
  paths: CSVPaths,
  fill: 'transparent',
  title: 'CSV File',
};

const htmlFile = {
  paths: HTMLPaths,
  fill: 'transparent',
  title: 'HTML File',
};

const powerPointPresentation = {
  paths: PPTPaths,
  fill: 'transparent',
  title: 'PowerPoint Presentation',
};

const zipFile = {
  paths: ZipPaths,
  fill: 'transparent',
  title: 'Archive',
};

const codeFile = {
  paths: CodePaths,
  fill: '#2D305C',
  title: 'Code',
};

const pythonFile = {
  paths: PythonPaths,
  fill: 'transparent',
  title: 'Python',
};

const javascriptFile = {
  paths: JavaScriptPaths,
  fill: 'transparent',
  title: 'JavaScript',
};

const typescriptFile = {
  paths: TypeScriptPaths,
  fill: 'transparent',
  title: 'TypeScript',
};

const sqlFile = {
  paths: SQLPaths,
  fill: 'transparent',
  title: 'SQL',
};

const jsonFile = {
  paths: JSONPaths,
  fill: 'transparent',
  title: 'JSON',
};

const cssFile = {
  paths: CSSPaths,
  fill: 'transparent',
  title: 'CSS',
};

const markdownFile = {
  paths: MarkdownPaths,
  fill: 'transparent',
  title: 'Markdown',
};

const yamlFile = {
  paths: YAMLPaths,
  fill: 'transparent',
  title: 'YAML',
};

const shellFile = {
  paths: ShellPaths,
  fill: 'transparent',
  title: 'Shell Script',
};

const xmlFile = {
  paths: XMLPaths,
  fill: 'transparent',
  title: 'XML',
};

const audioFile = {
  paths: AudioPaths,
  fill: 'transparent',
  title: 'Audio',
};

const videoFile = {
  paths: VideoPaths,
  fill: 'transparent',
  title: 'Video',
};

const artifact = {
  paths: CodePaths,
  fill: '#2D305C',
  title: 'Code',
};

export const fileTypes: Record<string, { paths: React.FC; fill: string; title: string }> = {
  /* Category matches */
  file: {
    paths: FilePaths,
    fill: '#a9a9ffff',
    title: 'File',
  },
  text: textDocument,
  txt: textDocument,
  audio: audioFile,
  video: videoFile,
  
  /* PDF Documents */
  'application/pdf': pdfDocument,
  pdf: pdfDocument,

  /* CSV Files */
  'text/csv': csvFile,
  csv: csvFile,

  /* HTML Files */
  'text/html': htmlFile,
  html: htmlFile,
  htm: htmlFile,

  /* Archive Files */
  'application/zip': zipFile,
  'application/x-zip-compressed': zipFile,
  'application/x-rar-compressed': zipFile,
  'application/x-7z-compressed': zipFile,
  'application/x-tar': zipFile,
  'application/gzip': zipFile,
  zip: zipFile,
  rar: zipFile,
  '7z': zipFile,
  tar: zipFile,
  gz: zipFile,

  /* Spreadsheet Files */
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': spreadsheet, // .xlsx
  'application/vnd.ms-excel': spreadsheet, // .xls
  'application/vnd.oasis.opendocument.spreadsheet': spreadsheet, // .ods
  xlsx: spreadsheet,
  xls: spreadsheet,
  ods: spreadsheet,

  /* Code Files - Language-specific icons */
  'text/javascript': javascriptFile,
  'application/javascript': javascriptFile,
  'text/typescript': typescriptFile,
  'application/typescript': typescriptFile,
  'text/x-python': pythonFile,
  'application/x-python': pythonFile,
  'application/json': jsonFile,
  'text/css': cssFile,
  'text/xml': xmlFile,
  'application/xml': xmlFile,
  'application/sql': sqlFile,
  'text/sql': sqlFile,
  'text/x-sql': sqlFile,
  'text/markdown': markdownFile,
  'text/x-markdown': markdownFile,
  'text/yaml': yamlFile,
  'application/x-yaml': yamlFile,
  'text/x-sh': shellFile,
  'application/x-sh': shellFile,
  
  /* Extension-based mappings - Language-specific */
  js: javascriptFile,
  mjs: javascriptFile,
  cjs: javascriptFile,
  jsx: javascriptFile,
  ts: typescriptFile,
  tsx: typescriptFile,
  mts: typescriptFile,
  cts: typescriptFile,
  py: pythonFile,
  pyw: pythonFile,
  pyi: pythonFile,
  json: jsonFile,
  jsonc: jsonFile,
  json5: jsonFile,
  css: cssFile,
  scss: cssFile,
  sass: cssFile,
  less: cssFile,
  xml: xmlFile,
  xsl: xmlFile,
  xslt: xmlFile,
  sql: sqlFile,
  md: markdownFile,
  mdx: markdownFile,
  markdown: markdownFile,
  yaml: yamlFile,
  yml: yamlFile,
  sh: shellFile,
  bash: shellFile,
  zsh: shellFile,
  fish: shellFile,
  
  /* Other code files - Generic code icon */
  'text/x-': codeFile, // Fallback for text/x-* MIME types
  java: codeFile,
  c: codeFile,
  cpp: codeFile,
  h: codeFile,
  hpp: codeFile,
  php: codeFile,
  rb: codeFile,
  go: codeFile,
  rs: codeFile,
  swift: codeFile,
  kt: codeFile,
  bat: codeFile,
  ps1: codeFile,
  toml: codeFile,
  ini: codeFile,
  conf: codeFile,
  r: codeFile,
  R: codeFile,
  lua: codeFile,
  perl: codeFile,
  pl: codeFile,
  scala: codeFile,
  dart: codeFile,
  vue: codeFile,
  svelte: codeFile,
  
  /* Special files */
  artifact: artifact,

  /* Word Documents */
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': wordDocument, // .docx
  'application/msword': wordDocument, // .doc
  'application/vnd.oasis.opendocument.text': wordDocument, // .odt
  'application/rtf': wordDocument, // .rtf
  'text/rtf': wordDocument, // .rtf alternative
  docx: wordDocument,
  doc: wordDocument,
  odt: wordDocument,
  rtf: wordDocument,

  /* PowerPoint Presentations */
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': powerPointPresentation, // .pptx
  'application/vnd.ms-powerpoint': powerPointPresentation, // .ppt
  'application/vnd.oasis.opendocument.presentation': powerPointPresentation, // .odp
  pptx: powerPointPresentation,
  ppt: powerPointPresentation,
  odp: powerPointPresentation,
};

// export const getFileType = (type = '') => {
//   let fileType = fileTypes.file;
//   const exactMatch = fileTypes[type];
//   const partialMatch = !exactMatch && partialTypes.find((type) => type.includes(type));
//   const category = (!partialMatch && (type.split('/')[0] ?? 'text') || 'text');

//   if (exactMatch) {
//     fileType = exactMatch;
//   } else if (partialMatch) {
//     fileType = fileTypes[partialMatch];
//   } else if (fileTypes[category]) {
//     fileType = fileTypes[category];
//   }

//   if (!fileType) {
//     fileType = fileTypes.file;
//   }

//   return fileType;
// };

export const getFileType = (
  type = '',
): {
  paths: React.FC;
  fill: string;
  title: string;
} => {
  // Direct match check
  if (fileTypes[type]) {
    return fileTypes[type];
  }

  if (excelMimeTypes.test(type)) {
    return spreadsheet;
  }

  // Partial match check
  const partialMatch = partialTypes.find((partial) => type.includes(partial));
  if (partialMatch && fileTypes[partialMatch]) {
    return fileTypes[partialMatch];
  }

  // Category check
  const category = type.split('/')[0] || 'text';
  if (fileTypes[category]) {
    return fileTypes[category];
  }

  // Default file type
  return fileTypes.file;
};

/**
 * Format a date string to a human readable format
 * @example
 * formatDate('2020-01-01T00:00:00.000Z') // '1 Jan 2020'
 */
export function formatDate(dateString: string, isSmallScreen = false) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  if (isSmallScreen) {
    return date.toLocaleDateString('en-US', {
      month: 'numeric',
      day: 'numeric',
      year: '2-digit',
    });
  }

  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

/**
 * Adds a file to the query cache
 */
export function addFileToCache(queryClient: QueryClient, newfile: TFile) {
  const currentFiles = queryClient.getQueryData<TFile[]>([QueryKeys.files]);

  if (!currentFiles) {
    console.warn('No current files found in cache, skipped updating file query cache');
    return;
  }

  const fileIndex = currentFiles.findIndex((file) => file.file_id === newfile.file_id);

  if (fileIndex > -1) {
    console.warn('File already exists in cache, skipped updating file query cache');
    return;
  }

  queryClient.setQueryData<TFile[]>(
    [QueryKeys.files],
    [
      {
        ...newfile,
      },
      ...currentFiles,
    ],
  );
}

export function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) {
    return 0;
  }
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm));
}

const { checkType } = defaultFileConfig;

export const validateFiles = ({
  files,
  fileList,
  setError,
  endpointFileConfig,
  toolResource,
  fileConfig,
}: {
  fileList: File[];
  files: Map<string, ExtendedFile>;
  setError: (error: string) => void;
  endpointFileConfig: EndpointFileConfig;
  toolResource?: string;
  fileConfig: FileConfig | null;
}) => {
  const { fileLimit, fileSizeLimit, totalSizeLimit, supportedMimeTypes, disabled } =
    endpointFileConfig;
  /** Block all uploads if the endpoint is explicitly disabled */
  if (disabled === true) {
    setError('com_ui_attach_error_disabled');
    return false;
  }
  const existingFiles = Array.from(files.values());
  const incomingTotalSize = fileList.reduce((total, file) => total + file.size, 0);
  if (incomingTotalSize === 0) {
    setError('com_error_files_empty');
    return false;
  }
  const currentTotalSize = existingFiles.reduce((total, file) => total + file.size, 0);

  if (fileLimit && fileList.length + files.size > fileLimit) {
    setError(`You can only upload up to ${fileLimit} files at a time.`);
    return false;
  }

  for (let i = 0; i < fileList.length; i++) {
    let originalFile = fileList[i];
    let fileType = originalFile.type;
    const extension = originalFile.name.split('.').pop() ?? '';
    const knownCodeType = codeTypeMapping[extension];

    // Infer MIME type for Known Code files when the type is empty or a mismatch
    if (knownCodeType && (!fileType || fileType !== knownCodeType)) {
      fileType = knownCodeType;
    }

    // Check if the file type is still empty after the extension check
    if (!fileType) {
      setError('Unable to determine file type for: ' + originalFile.name);
      return false;
    }

    // Replace empty type with inferred type
    if (originalFile.type !== fileType) {
      const newFile = new File([originalFile], originalFile.name, { type: fileType });
      originalFile = newFile;
      fileList[i] = newFile;
    }

    let mimeTypesToCheck = supportedMimeTypes;
    if (toolResource === EToolResources.context) {
      mimeTypesToCheck = [
        ...(fileConfig?.text?.supportedMimeTypes || []),
        ...(fileConfig?.ocr?.supportedMimeTypes || []),
        ...(fileConfig?.stt?.supportedMimeTypes || []),
      ];
    }

    if (!checkType(originalFile.type, mimeTypesToCheck)) {
      console.log(originalFile);
      setError('Currently, unsupported file type: ' + originalFile.type);
      return false;
    }

    if (fileSizeLimit && originalFile.size >= fileSizeLimit) {
      setError(`File size exceeds ${fileSizeLimit / megabyte} MB.`);
      return false;
    }
  }

  if (totalSizeLimit && currentTotalSize + incomingTotalSize > totalSizeLimit) {
    setError(`The total size of the files cannot exceed ${totalSizeLimit / megabyte} MB.`);
    return false;
  }

  const combinedFilesInfo = [
    ...existingFiles.map(
      (file) =>
        `${file.file?.name ?? file.filename}-${file.size}-${file.type?.split('/')[0] ?? 'file'}`,
    ),
    ...fileList.map(
      (file: File | undefined) =>
        `${file?.name}-${file?.size}-${file?.type.split('/')[0] ?? 'file'}`,
    ),
  ];

  const uniqueFilesSet = new Set(combinedFilesInfo);

  if (uniqueFilesSet.size !== combinedFilesInfo.length) {
    setError('com_error_files_dupe');
    return false;
  }

  return true;
};
