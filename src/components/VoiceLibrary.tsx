"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFormData, setUploadFormData] = useState<VoiceFormData>(defaultFormData);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
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

  // Upload handlers
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setSelectedFile(file);
    if (!uploadFormData.name) {
      setUploadFormData(prev => ({
        ...prev,
        name: file.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setMessage("Please select an audio file");
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);
    setMessage("Uploading voice...");

    try {
      const formData = new FormData();
      formData.append("audio", selectedFile);
      formData.append("metadata", JSON.stringify(uploadFormData));

      const response = await fetch("/api/voices/upload", {
        method: "POST",
        body: formData,
      });

      setUploadProgress(70);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.userMessage || "Upload failed");
      }

      setUploadProgress(100);
      setMessage(data.nextSteps?.message || "Voice uploaded successfully!");
      setShowUploadModal(false);
      setSelectedFile(null);
      setUploadFormData(defaultFormData);
      await loadVoices();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
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

  // Filter voices
  const filteredVoices = voices.filter(voice => {
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

  const uniqueLanguages = [...new Set(voices.map(v => v.language).filter(Boolean))];

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
        <div className="voice-modal-overlay" onClick={() => setShowUploadModal(false)}>
          <div className="voice-modal" onClick={e => e.stopPropagation()}>
            <div className="voice-modal-header">
              <h3>Upload Voice Reference</h3>
              <button className="voice-modal-close" onClick={() => setShowUploadModal(false)}>×</button>
            </div>

            <div className="voice-modal-body">
              <div className="voice-upload-zone">
                <input
                  type="file"
                  accept="audio/wav,audio/mp3,audio/mpeg,audio/ogg,audio/webm,.wav,.mp3"
                  onChange={handleFileSelect}
                  id="voice-file-input"
                />
                <label htmlFor="voice-file-input" className="voice-upload-label">
                  {selectedFile ? (
                    <span>{selectedFile.name} ({formatFileSize(selectedFile.size)})</span>
                  ) : (
                    <span>Click to select audio file<br/>(WAV, MP3 - max 50MB)</span>
                  )}
                </label>
              </div>

              <div className="voice-form-grid">
                <label className="voice-form-field">
                  <span>Voice Name *</span>
                  <input
                    type="text"
                    value={uploadFormData.name}
                    onChange={e => setUploadFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="My Custom Voice"
                  />
                </label>

                <label className="voice-form-field">
                  <span>Description</span>
                  <textarea
                    value={uploadFormData.description}
                    onChange={e => setUploadFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description of this voice"
                    rows={2}
                  />
                </label>

                <div className="voice-form-row">
                  <label className="voice-form-field">
                    <span>Language</span>
                    <select
                      value={uploadFormData.language}
                      onChange={e => setUploadFormData(prev => ({ ...prev, language: e.target.value }))}
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
                  />
                </label>
              </div>

              {isUploading && (
                <div className="voice-upload-progress">
                  <div className="voice-progress-bar">
                    <div className="voice-progress-fill" style={{ width: `${uploadProgress}%` }} />
                  </div>
                  <span>{uploadProgress}% uploaded</span>
                </div>
              )}

              <div className="voice-upload-requirements">
                <strong>Requirements for best results:</strong>
                <ul>
                  <li>10-60 seconds of clear speech</li>
                  <li>Minimal background noise</li>
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
                disabled={isUploading || !selectedFile || !uploadFormData.name}
              >
                {isUploading ? "Uploading..." : "Upload Voice"}
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
