export interface NoteFile {
  id: string;
  name: string;
  html: string;
  lastEdited: string;
}

export interface FileIndexEntry {
  id: string;
  name: string;
}

export interface ExportData {
  version: number;
  exportedAt: string;
  file: NoteFile;
}
