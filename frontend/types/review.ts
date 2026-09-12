export type ProcessingStatus = "processing" | "ready" | "error";

export interface DocumentationStep {
  id: string;
  /** Seconds into the video this step refers to. */
  timestamp: number;
  title: string;
  content: string;
  /** Object URL for an attached screenshot/image, if any. */
  imageUrl?: string;
}

export interface PlaylistOption {
  id: string;
  name: string;
}

export interface ReviewState {
  projectTitle: string;
  processingStatus: ProcessingStatus;
  isPublished: boolean;
  selectedPlaylistId: string | null;
  description: string;
  steps: DocumentationStep[];
}
