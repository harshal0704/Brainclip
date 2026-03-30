"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";

type CustomVoice = {
  id: string;
  name: string;
  description: string | null;
  source: "upload" | "clone" | "preset";
  referenceAudioKey: string | null;
  previewAudioKey: string | null;
  fishModelId: string | null;
  fishCloneStatus: string | null;
  durationSec: number | null;
  sampleRate: number | null;
  format: string | null;
  fileSizeBytes: number | null;
  language: string | null;
  gender: string | null;
  tone: string | null;
  tags: string[];
  recommendedEmotion: string | null;
  recommendedRate: number | null;
  isPublic: boolean;
  isFavorite: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  urls?: {
    reference?: string;
    preview?: string;
  };
};

type VoiceFormData = {
  name: string;
  description: string;
  language: string;
  gender: string;
  tone: string;
  tags: string[];
  recommendedEmotion: string;
  recommendedRate: number;
};

type UploadStage = "idle" | "validating" | "uploading" | "processing" | "complete" | "error";

interface FileValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  estimatedDuration?: string;
}

const defaultFormData: VoiceFormData = {
  name: "",
  description: "",
  language: "en",
  gender: "",
  tone: "",
  tags: [],
  recommendedEmotion: "neutral",
  recommendedRate: 1.0,
};

const SUPPORTED_FORMATS = ["audio/wav", "audio/mpeg", "audio/mp3", "audio/ogg", "audio/webm", "audio/m4a", "audio/aac", "audio/x-wav"];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_DURATION_SEC = 300; // 5 minutes
const MIN_DURATION_SEC = 3;
const RECOMMENDED_DURATION_SEC = 30;

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "--";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
};

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const validateAudioFile = async (file: File): Promise<FileValidation> => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!SUPPORTED_FORMATS.includes(file.type) && !file.name.match(/\.(wav|mp3|ogg|webm|m4a|aac)$/i)) {
    errors.push(`Unsupported format: ${file.type || "unknown"}. Use WAV, MP3, OGG, WebM, or M4A.`);
  }

  if (file.size > MAX_FILE_SIZE) {
    errors.push(`File too large: ${formatFileSize(file.size)}. Maximum is 50MB.`);
  }

  if (file.size < 1024) {
    errors.push("File appears to be empty or corrupted.");
  }

  // Try to estimate duration from file size (rough estimate for compressed formats)
  const estimatedKbps = file.type.includes("mpeg") || file.type.includes("mp3") ? 128 : 256;
  const estimatedDurationSec = (file.size / 1024 / estimatedKbps);
  
  if (estimatedDurationSec < MIN_DURATION_SEC) {
    warnings.push(`File may be too short (estimated ${formatDuration(estimatedDurationSec)}). Aim for at least ${MIN_DURATION_SEC} seconds.`);
  }

  if (estimatedDurationSec > MAX_DURATION_SEC) {
    errors.push(`File may be too long (estimated ${formatDuration(estimatedDurationSec)}). Maximum is ${formatDuration(MAX_DURATION_SEC)}.`);
  }

  if (estimatedDurationSec < RECOMMENDED_DURATION_SEC && estimatedDurationSec >= MIN_DURATION_SEC) {
    warnings.push(`For best cloning results, use at least ${RECOMMENDED_DURATION_SEC} seconds of audio.`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    estimatedDuration: formatDuration(estimatedDurationSec),
  };
};

const getUploadStageLabel = (stage: UploadStage): string => {
  switch (stage) {
    case "validating": return "Validating file...";
    case "uploading": return "Uploading audio...";
    case "processing": return "Processing & cloning...";
    case "complete": return "Upload complete!";
    case "error": return "Upload failed";
    default: return "";
  }
};

export type VoiceLibraryProps = {
  /** Called when user selects a voice for Speaker A or B */
  onSelectVoice?: (voice: CustomVoice, speaker: "A" | "B") => void;
  /** Enable selection mode (shows speaker assignment buttons) */
  selectionMode?: boolean;
  /** Currently selected voice IDs for highlighting */
  selectedVoiceIds?: { speakerA?: string; speakerB?: string };
};

export type { CustomVoice };

export const VoiceLibrary = ({ 
  onSelectVoice,
  selectionMode = false,
  selectedVoiceIds
}: VoiceLibraryProps = {}) => {
  const [voices, setVoices] = useState<CustomVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  
  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState<UploadStage>("idle");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState<VoiceFormData>(defaultFormData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileValidation, setFileValidation] = useState<FileValidation | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  
  // Edit state
  const [editingVoice, setEditingVoice] = useState<CustomVoice | null>(null);
  const [editFormData, setEditFormData] = useState<VoiceFormData>(defaultFormData);
  
  // Preview state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Filter/search state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLanguage, setFilterLanguage] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewAudioUrl) {
        URL.revokeObjectURL(previewAudioUrl);
      }
    };
  }, [previewAudioUrl]);

  const loadVoices = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/voices/custom?includeUrls=true");
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error?.userMessage || "Failed to load voices");
        return;
      }
      
      setVoices(data.voices || []);
      setError("");
    } catch {
      setError("Network error loading voices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadVoices();
  }, [loadVoices]);

  // Audio preview controls
  const playPreview = async (voice: CustomVoice) => {
    if (playingVoiceId === voice.id) {
      audioRef.current?.pause();
      setPlayingVoiceId(null);
      return;
    }

    const audioUrl = voice.urls?.preview || voice.urls?.reference;
    if (!audioUrl) {
      setMessage("No audio available for preview");
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audioRef.current = audio;
    
    audio.onended = () => setPlayingVoiceId(null);
    audio.onerror = () => {
      setMessage("Failed to play audio");
      setPlayingVoiceId(null);
    };
    
    setPlayingVoiceId(voice.id);
    await audio.play();
  };

  // Handle file selection with validation
  const handleFileSelection = async (file: File) => {
    // Cleanup previous preview
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }

    setSelectedFile(file);
    setFileValidation(null);
    setUploadStage("validating");
    
    // Auto-fill name if empty
    if (!uploadFormData.name) {
      setUploadFormData(prev => ({
        ...prev,
        name: file.name.replace(/\.[^/.]+$/, ""),
      }));
    }

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewAudioUrl(url);

    // Validate file
    const validation = await validateAudioFile(file);
    setFileValidation(validation);
    setUploadStage("idle");
  };

  // File input change handler
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("audio/") || file.name.match(/\.(wav|mp3|ogg|webm|m4a|aac)$/i)) {
        handleFileSelection(file);
      } else {
        setMessage("Please drop an audio file (WAV, MP3, OGG, WebM, or M4A)");
      }
    }
  };

  // Preview uploaded file
  const previewUploadedFile = () => {
    if (previewAudioUrl && audioRef.current) {
      if (audioRef.current.src === previewAudioUrl) {
        audioRef.current.play();
      } else {
        audioRef.current.src = previewAudioUrl;
        audioRef.current.play();
      }
    }
  };

  // Clear selected file
  const clearSelectedFile = () => {
    if (previewAudioUrl) {
      URL.revokeObjectURL(previewAudioUrl);
      setPreviewAudioUrl(null);
    }
    setSelectedFile(null);
    setFileValidation(null);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
  };

  // Upload handler with multi-stage progress
  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select an audio file");
      return;
    }

    if (fileValidation && !fileValidation.valid) {
      setMessage("Please fix the file errors before uploading");
      return;
    }

    setIsUploading(true);
    setUploadStage("uploading");
    setUploadProgress(10);
    setMessage("Starting upload...");

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("metadata", JSON.stringify(uploadFormData));

      // Simulate progress during upload phase
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 60) {
            clearInterval(progressInterval);
            return 60;
          }
          return prev + 5;
        });
      }, 200);

      const response = await fetch("/api/voices/upload", {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      
      setUploadProgress(70);
      setUploadStage("processing");
      setMessage("Processing your voice...");

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.userMessage || data.error || "Upload failed");
      }

      setUploadProgress(90);
      setUploadStage("complete");
      setMessage("Voice uploaded successfully!");
      
      // Brief delay to show completion
      await new Promise(resolve => setTimeout(resolve, 500));

      setShowUploadModal(false);
      setSelectedFile(null);
      setFileValidation(null);
      setUploadFormData(defaultFormData);
      setPreviewAudioUrl(null);
      setUploadProgress(0);
      setUploadStage("idle");
      await loadVoices();
    } catch (err) {
      setUploadStage("error");
      setMessage(err instanceof Error ? err.message : "Upload failed");
      setUploadProgress(0);
    } finally {
      setIsUploading(false);
    }
  };

  // Edit handlers
  const startEdit = (voice: CustomVoice) => {
    setEditingVoice(voice);
    setEditFormData({
      name: voice.name,
      description: voice.description || "",
      language: voice.language || "en",
      gender: voice.gender || "",
      tone: voice.tone || "",
      tags: voice.tags,
      recommendedEmotion: voice.recommendedEmotion || "neutral",
      recommendedRate: voice.recommendedRate || 1.0,
    });
  };

  const saveEdit = async () => {
    if (!editingVoice) return;

    setMessage("Saving changes...");
    try {
      const response = await fetch(`/api/voices/custom/${editingVoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editFormData),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.userMessage || "Update failed");
      }

      setMessage("Voice updated successfully!");
      setEditingVoice(null);
      await loadVoices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Update failed");
    }
  };

  // Delete handler
  const deleteVoice = async (voice: CustomVoice) => {
    if (!confirm(`Delete "${voice.name}"? This cannot be undone.`)) return;

    setMessage("Deleting voice...");
    try {
      const response = await fetch(`/api/voices/custom/${voice.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.userMessage || "Delete failed");
      }

      setMessage("Voice deleted successfully!");
      await loadVoices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Delete failed");
    }
  };

  // Clone handler
  const cloneVoice = async (voice: CustomVoice) => {
    if (voice.fishCloneStatus === "processing") {
      setMessage("Voice cloning is already in progress");
      return;
    }

    setMessage("Starting voice cloning with Fish.audio...");
    try {
      const response = await fetch(`/api/voices/custom/${voice.id}/clone`, {
        method: "POST",
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.userMessage || "Cloning failed");
      }

      setMessage(data.cloning?.message || "Voice cloned successfully!");
      await loadVoices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Cloning failed");
    }
  };

  // Toggle favorite
  const toggleFavorite = async (voice: CustomVoice) => {
    try {
      const response = await fetch(`/api/voices/custom/${voice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: !voice.isFavorite }),
      });

      if (response.ok) {
        await loadVoices();
      }
    } catch {
      // Silent fail for favorites
    }
  };

  // Filter voices - memoized for performance
  const filteredVoices = useMemo(() => {
    return voices.filter(voice => {
      if (showFavoritesOnly && !voice.isFavorite) return false;
      if (filterLanguage && voice.language !== filterLanguage) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          voice.name.toLowerCase().includes(query) ||
          voice.description?.toLowerCase().includes(query) ||
          voice.tags.some(tag => tag.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [voices, showFavoritesOnly, filterLanguage, searchQuery]);

  const uniqueLanguages = useMemo(
    () => [...new Set(voices.map(v => v.language).filter(Boolean))],
    [voices]
  );

  if (loading) {
    return (
      <div className="voice-library">
        <div className="voice-library-header">
          <h2>Voice Library</h2>
        </div>
        <div className="voice-library-loading">Loading your voices...</div>
      </div>
    );
  }

  return (
    <div className="voice-library">
      {/* Header */}
      <div className="voice-library-header">
        <div className="voice-library-title">
          <h2>Voice Library</h2>
          <span className="voice-count">{voices.length} voices</span>
        </div>
        <button className="primary-button" onClick={() => setShowUploadModal(true)}>
          + Upload Voice
        </button>
      </div>

      {/* Filters */}
      <div className="voice-library-filters">
        <input
          type="text"
          placeholder="Search voices..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="voice-search-input"
        />
        <select
          value={filterLanguage}
          onChange={e => setFilterLanguage(e.target.value)}
          className="voice-filter-select"
        >
          <option value="">All languages</option>
          {uniqueLanguages.map(lang => (
            <option key={lang} value={lang || ""}>{lang}</option>
          ))}
        </select>
        <label className="voice-filter-checkbox">
          <input
            type="checkbox"
            checked={showFavoritesOnly}
            onChange={e => setShowFavoritesOnly(e.target.checked)}
          />
          Favorites only
        </label>
      </div>

      {/* Status message */}
      {(error || message) && (
        <div className={error ? "voice-library-error" : "voice-library-message"}>
          {error || message}
        </div>
      )}

      {/* Voice grid */}
      <div className="voice-grid">
        {filteredVoices.length === 0 ? (
          <div className="voice-empty">
            {voices.length === 0
              ? "No voices yet. Upload your first voice reference to get started."
              : "No voices match your filters."}
          </div>
        ) : (
          filteredVoices.map(voice => (
            <article key={voice.id} className="voice-card">
              <div className="voice-card-header">
                <div className="voice-card-title">
                  <h3>{voice.name}</h3>
                  <button
                    className={`voice-favorite-btn ${voice.isFavorite ? "active" : ""}`}
                    onClick={() => toggleFavorite(voice)}
                    title={voice.isFavorite ? "Remove from favorites" : "Add to favorites"}
                  >
                    {voice.isFavorite ? "★" : "☆"}
                  </button>
                </div>
                <div className="voice-card-badges">
                  <span className={`voice-status-badge ${voice.fishCloneStatus || "pending"}`}>
                    {voice.fishCloneStatus === "ready" ? "Cloned" : voice.fishCloneStatus || "Pending"}
                  </span>
                  {voice.language && <span className="voice-lang-badge">{voice.language}</span>}
                </div>
              </div>

              {voice.description && (
                <p className="voice-card-description">{voice.description}</p>
              )}

              <div className="voice-card-meta">
                <span>Duration: {formatDuration(voice.durationSec)}</span>
                <span>Size: {formatFileSize(voice.fileSizeBytes)}</span>
                <span>Used: {voice.usageCount}x</span>
              </div>

              {voice.tags.length > 0 && (
                <div className="voice-card-tags">
                  {voice.tags.map((tag, i) => (
                    <span key={i} className="voice-tag">{tag}</span>
                  ))}
                </div>
              )}

              <div className="voice-card-actions">
                <button
                  className={`voice-action-btn preview ${playingVoiceId === voice.id ? "playing" : ""}`}
                  onClick={() => playPreview(voice)}
                  disabled={!voice.urls?.preview && !voice.urls?.reference}
                >
                  {playingVoiceId === voice.id ? "◼ Stop" : "▶ Preview"}
                </button>
                {selectionMode && onSelectVoice && voice.fishModelId && (
                  <>
                    <button
                      className={`voice-action-btn select-a ${selectedVoiceIds?.speakerA === voice.id ? "selected" : ""}`}
                      onClick={() => onSelectVoice(voice, "A")}
                      title="Use as Speaker A voice"
                    >
                      {selectedVoiceIds?.speakerA === voice.id ? "✓ Speaker A" : "Use as A"}
                    </button>
                    <button
                      className={`voice-action-btn select-b ${selectedVoiceIds?.speakerB === voice.id ? "selected" : ""}`}
                      onClick={() => onSelectVoice(voice, "B")}
                      title="Use as Speaker B voice"
                    >
                      {selectedVoiceIds?.speakerB === voice.id ? "✓ Speaker B" : "Use as B"}
                    </button>
                  </>
                )}
                <button
                  className="voice-action-btn edit"
                  onClick={() => startEdit(voice)}
                >
                  Edit
                </button>
                {voice.fishCloneStatus !== "ready" && voice.fishCloneStatus !== "processing" && (
                  <button
                    className="voice-action-btn clone"
                    onClick={() => cloneVoice(voice)}
                  >
                    Clone
                  </button>
                )}
                <button
                  className="voice-action-btn delete"
                  onClick={() => deleteVoice(voice)}
                >
                  Delete
                </button>
              </div>

              {voice.fishModelId && (
                <div className="voice-card-model-id">
                  Model: <code>{voice.fishModelId}</code>
                </div>
              )}
            </article>
          ))
        )}
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="voice-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="voice-modal" onClick={e => e.stopPropagation()}>
            <div className="voice-modal-header">
              <h3>Upload Voice Reference</h3>
              {!isUploading && (
                <button className="voice-modal-close" onClick={() => setShowUploadModal(false)}>×</button>
              )}
            </div>

            <div className="voice-modal-body">
              {/* Improved Drag & Drop Zone */}
              <div 
                className={`voice-upload-zone ${isDragging ? "dragging" : ""} ${selectedFile ? "has-file" : ""}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.webm,.m4a,.aac"
                  onChange={handleFileSelect}
                  id="voice-file-input"
                  disabled={isUploading}
                />
                
                {selectedFile ? (
                  <div className="voice-upload-preview">
                    <div className="voice-preview-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                      </svg>
                    </div>
                    <div className="voice-preview-info">
                      <strong className="voice-preview-name">{selectedFile.name}</strong>
                      <span className="voice-preview-meta">
                        {formatFileSize(selectedFile.size)} • {selectedFile.type.split("/")[1]?.toUpperCase() || "AUDIO"}
                      </span>
                      {fileValidation?.estimatedDuration && (
                        <span className="voice-preview-duration">
                          Est. duration: ~{fileValidation.estimatedDuration}
                        </span>
                      )}
                    </div>
                    {previewAudioUrl && !isUploading && (
                      <div className="voice-preview-actions">
                        <button 
                          type="button" 
                          className="voice-preview-play"
                          onClick={previewUploadedFile}
                          title="Preview audio"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M8 5v14l11-7z"/>
                          </svg>
                          Preview
                        </button>
                        <button 
                          type="button" 
                          className="voice-preview-remove"
                          onClick={clearSelectedFile}
                          title="Remove file"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <label htmlFor="voice-file-input" className="voice-upload-label">
                    <div className="voice-upload-icon">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <span className="voice-upload-text">
                      <strong>Drop your audio file here</strong>
                      <span>or click to browse</span>
                    </span>
                    <span className="voice-upload-hint">WAV, MP3, OGG, WebM, M4A • Max 50MB</span>
                  </label>
                )}
              </div>

              {/* Validation Results */}
              {fileValidation && (
                <div className={`voice-validation ${fileValidation.valid ? "valid" : "invalid"}`}>
                  {fileValidation.errors.length > 0 && (
                    <div className="voice-validation-errors">
                      {fileValidation.errors.map((err, i) => (
                        <div key={i} className="voice-validation-item error">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10"/>
                            <line x1="15" y1="9" x2="9" y2="15"/>
                            <line x1="9" y1="9" x2="15" y2="15"/>
                          </svg>
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                  {fileValidation.warnings.length > 0 && (
                    <div className="voice-validation-warnings">
                      {fileValidation.warnings.map((warn, i) => (
                        <div key={i} className="voice-validation-item warning">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                            <line x1="12" y1="9" x2="12" y2="13"/>
                            <line x1="12" y1="17" x2="12.01" y2="17"/>
                          </svg>
                          {warn}
                        </div>
                      ))}
                    </div>
                  )}
                  {fileValidation.valid && fileValidation.warnings.length === 0 && (
                    <div className="voice-validation-item success">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <polyline points="22 4 12 14.01 9 11.01"/>
                      </svg>
                      File looks good! Ready to upload.
                    </div>
                  )}
                </div>
              )}

              {/* Hidden audio element for preview */}
              <audio ref={audioRef} style={{ display: "none" }} />

              <div className="voice-form-grid">
                <label className="voice-form-field">
                  <span>Voice Name *</span>
                  <input
                    type="text"
                    value={uploadFormData.name}
                    onChange={e => setUploadFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Custom Voice"
                    disabled={isUploading}
                  />
                </label>

                <label className="voice-form-field">
                  <span>Description</span>
                  <textarea
                    value={uploadFormData.description}
                    onChange={e => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description of this voice"
                    rows={2}
                    disabled={isUploading}
                  />
                </label>

                <div className="voice-form-row">
                  <label className="voice-form-field">
                    <span>Language</span>
                    <select
                      value={uploadFormData.language}
                      onChange={e => setUploadFormData(prev => ({ ...prev, language: e.target.value }))}
                      disabled={isUploading}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="hi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </label>

                  <label className="voice-form-field">
                    <span>Gender</span>
                    <select
                      value={uploadFormData.gender}
                      onChange={e => setUploadFormData(prev => ({ ...prev, gender: e.target.value }))}
                      disabled={isUploading}
                    >
                      <option value="">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </label>
                </div>

                <div className="voice-form-row">
                  <label className="voice-form-field">
                    <span>Default Emotion</span>
                    <select
                      value={uploadFormData.recommendedEmotion}
                      onChange={e => setUploadFormData(prev => ({ ...prev, recommendedEmotion: e.target.value }))}
                      disabled={isUploading}
                    >
                      <option value="neutral">Neutral</option>
                      <option value="happy">Happy</option>
                      <option value="sad">Sad</option>
                      <option value="excited">Excited</option>
                      <option value="calm">Calm</option>
                      <option value="angry">Angry</option>
                    </select>
                  </label>

                  <label className="voice-form-field">
                    <span>Speaking Rate</span>
                    <input
                      type="number"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={uploadFormData.recommendedRate}
                      onChange={e => setUploadFormData(prev => ({ ...prev, recommendedRate: parseFloat(e.target.value) }))}
                      disabled={isUploading}
                    />
                  </label>
                </div>

                <label className="voice-form-field">
                  <span>Tags (comma separated)</span>
                  <input
                    type="text"
                    value={uploadFormData.tags.join(", ")}
                    onChange={e => setUploadFormData(prev => ({
                      ...prev,
                      tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean),
                    }))}
                    placeholder="warm, professional, narrator"
                    disabled={isUploading}
                  />
                </label>
              </div>

              {/* Multi-stage Progress */}
              {isUploading && (
                <div className="voice-upload-progress">
                  <div className="voice-progress-stages">
                    <div className={`voice-stage ${uploadStage === "uploading" || uploadStage === "processing" || uploadStage === "complete" ? "active" : ""} ${uploadStage === "complete" ? "done" : ""}`}>
                      <div className="voice-stage-dot">1</div>
                      <span>Upload</span>
                    </div>
                    <div className="voice-stage-line"></div>
                    <div className={`voice-stage ${uploadStage === "processing" || uploadStage === "complete" ? "active" : ""} ${uploadStage === "complete" ? "done" : ""}`}>
                      <div className="voice-stage-dot">2</div>
                      <span>Process</span>
                    </div>
                    <div className="voice-stage-line"></div>
                    <div className={`voice-stage ${uploadStage === "complete" ? "active done" : ""}`}>
                      <div className="voice-stage-dot">3</div>
                      <span>Ready</span>
                    </div>
                  </div>
                  <div className="voice-progress-bar">
                    <div className={`voice-progress-fill ${uploadStage}`} style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span className="voice-progress-status">{getUploadStageLabel(uploadStage)}</span>
                </div>
              )}

              <div className="voice-upload-requirements">
                <strong>Tips for best results:</strong>
                <ul>
                  <li>Use 30-60 seconds of clear speech for optimal cloning</li>
                  <li>Minimal background noise works best</li>
                  <li>Single speaker only</li>
                  <li>WAV format preferred (16-bit, 44.1kHz)</li>
                </ul>
              </div>
            </div>

            <div className="voice-modal-footer">
              <button
                className="secondary-button"
                onClick={() => setShowUploadModal(false)}
                disabled={isUploading}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={handleUpload}
                disabled={isUploading || !selectedFile || !uploadFormData.name || !!(fileValidation && !fileValidation.valid)}
              >
                {isUploading ? (
                  <span className="upload-button-loading">
                    <span className="spinner"></span>
                    {uploadStage === "uploading" ? "Uploading..." : uploadStage === "processing" ? "Processing..." : "Please wait..."}
                  </span>
                ) : "Upload Voice"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingVoice && (
        <div className="voice-modal-overlay" onClick={() => setEditingVoice(null)}>
          <div className="voice-modal" onClick={e => e.stopPropagation()}>
            <div className="voice-modal-header">
              <h3>Edit Voice: {editingVoice.name}</h3>
              <button className="voice-modal-close" onClick={() => setEditingVoice(null)}>×</button>
            </div>

            <div className="voice-modal-body">
              <div className="voice-form-grid">
                <label className="voice-form-field">
                  <span>Voice Name *</span>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={e => setEditFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </label>

                <label className="voice-form-field">
                  <span>Description</span>
                  <textarea
                    value={editFormData.description}
                    onChange={e => setEditFormData(prev => ({ ...prev, description: e.target.value }))}
                    rows={3}
                  />
                </label>

                <div className="voice-form-row">
                  <label className="voice-form-field">
                    <span>Language</span>
                    <select
                      value={editFormData.language}
                      onChange={e => setEditFormData(prev => ({ ...prev, language: e.target.value }))}
                    >
                      <option value="en">English</option>
                      <option value="es">Spanish</option>
                      <option value="fr">French</option>
                      <option value="de">German</option>
                      <option value="hi">Hindi</option>
                      <option value="hinglish">Hinglish</option>
                      <option value="zh">Chinese</option>
                      <option value="ja">Japanese</option>
                    </select>
                  </label>

                  <label className="voice-form-field">
                    <span>Gender</span>
                    <select
                      value={editFormData.gender}
                      onChange={e => setEditFormData(prev => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="">Not specified</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  </label>
                </div>

                <div className="voice-form-row">
                  <label className="voice-form-field">
                    <span>Default Emotion</span>
                    <select
                      value={editFormData.recommendedEmotion}
                      onChange={e => setEditFormData(prev => ({ ...prev, recommendedEmotion: e.target.value }))}
                    >
                      <option value="neutral">Neutral</option>
                      <option value="happy">Happy</option>
                      <option value="sad">Sad</option>
                      <option value="excited">Excited</option>
                      <option value="calm">Calm</option>
                      <option value="angry">Angry</option>
                    </select>
                  </label>

                  <label className="voice-form-field">
                    <span>Speaking Rate</span>
                    <input
                      type="number"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={editFormData.recommendedRate}
                      onChange={e => setEditFormData(prev => ({ ...prev, recommendedRate: parseFloat(e.target.value) }))}
                    />
                  </label>
                </div>

                <label className="voice-form-field">
                  <span>Tags (comma separated)</span>
                  <input
                    type="text"
                    value={editFormData.tags.join(", ")}
                    onChange={e => setEditFormData(prev => ({
                      ...prev,
                      tags: e.target.value.split(",").map(t => t.trim()).filter(Boolean),
                    }))}
                  />
                </label>
              </div>
            </div>

            <div className="voice-modal-footer">
              <button className="secondary-button" onClick={() => setEditingVoice(null)}>
                Cancel
              </button>
              <button
                className="primary-button"
                onClick={saveEdit}
                disabled={!editFormData.name}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
