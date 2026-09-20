import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addStory,
  deleteMemory,
  deleteMusic,
  deletePhoto,
  deleteStory,
  getMemory,
  photoUrl,
  updateStory,
  uploadMusic,
  uploadPhoto,
} from "../api/memories.js";
import { getSavedPlan } from "../api/savedPlans.js";
import TripClipPlayer from "../components/memories/TripClipPlayer.jsx";

function StoryRow({ memoryId, story, onChanged }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(story.text);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await updateStory(memoryId, story.id, text);
      setEditing(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteStory(memoryId, story.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="story-row">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
        <div className="story-row__actions">
          <button type="button" onClick={save} disabled={busy}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="story-row">
      <p>{story.text}</p>
      <div className="story-row__actions">
        <button type="button" onClick={() => setEditing(true)}>
          Edit
        </button>
        <button type="button" onClick={remove} disabled={busy}>
          Delete
        </button>
      </div>
    </div>
  );
}

export default function MemoryDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const musicInputRef = useRef(null);
  const [memory, setMemory] = useState(null);
  const [city, setCity] = useState("");
  const [newStory, setNewStory] = useState("");
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const [addingStory, setAddingStory] = useState(false);
  const [playing, setPlaying] = useState(false);

  function refresh() {
    getMemory(id)
      .then((m) => {
        setMemory(m);
        return getSavedPlan(m.saved_plan_id);
      })
      .then((plan) => setCity(plan.city))
      .catch((err) => setError(err.message));
  }

  useEffect(refresh, [id]);

  async function handleAddStory(e) {
    e.preventDefault();
    if (!newStory.trim()) return;
    setAddingStory(true);
    try {
      await addStory(id, newStory);
      navigate("/memories");
    } catch (err) {
      setError(err.message);
      setAddingStory(false);
    }
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadPhoto(id, file);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(photoId) {
    try {
      await deletePhoto(id, photoId);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleUploadMusic(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMusic(true);
    setError(null);
    try {
      await uploadMusic(id, file);
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingMusic(false);
      if (musicInputRef.current) musicInputRef.current.value = "";
    }
  }

  async function handleDeleteMusic() {
    try {
      await deleteMusic(id);
      refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDeleteMemory() {
    try {
      await deleteMemory(id);
      navigate("/memories");
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !memory) {
    return (
      <div className="itin-empty">
        <p className="error">{error}</p>
        <Link to="/memories">Back to memories</Link>
      </div>
    );
  }

  if (!memory) {
    return <div className="itin-empty">Loading…</div>;
  }

  const { summary } = memory;

  if (playing) {
    return <TripClipPlayer memory={memory} city={city} onClose={() => setPlaying(false)} />;
  }

  return (
    <div className="summary-page">
      <header className="itin-header">
        <Link to="/memories" className="itin-header__logo">
          <span className="nav__logo-hap">HAPP</span>
          <span className="nav__logo-end">END</span>
        </Link>
        <h1>Trip memory</h1>
        <button type="button" className="itin-header__summary-btn" onClick={handleDeleteMemory}>
          Delete memory
        </button>
      </header>

      {error && <p className="error">{error}</p>}

      <div className="memory-summary">
        <span>
          {summary.days} day{summary.days === 1 ? "" : "s"}
        </span>
        <span>{summary.done_count} stops made</span>
        <span>{summary.skipped_count} skipped</span>
        <span>₹{summary.total_spend} spent</span>
      </div>
      {summary.places_visited?.length > 0 && (
        <p className="memory-summary__places">Visited: {summary.places_visited.join(", ")}</p>
      )}

      <button
        type="button"
        className="planner-submit trip-clip-launch"
        onClick={() => setPlaying(true)}
        disabled={memory.photos.length === 0 && memory.stories.length === 0}
      >
        ▶ Play trip clip
      </button>

      <div className="memory-music">
        {memory.has_music ? (
          <>
            <span>Background song added.</span>
            <button type="button" onClick={handleDeleteMusic}>
              Remove
            </button>
          </>
        ) : (
          <label className="memory-music__add">
            {uploadingMusic ? "Uploading…" : "+ Add a background song"}
            <input
              ref={musicInputRef}
              type="file"
              accept="audio/mpeg,audio/mp4,audio/wav"
              onChange={handleUploadMusic}
              disabled={uploadingMusic}
              hidden
            />
          </label>
        )}
      </div>

      <h2 className="landing__section-title">Photos</h2>
      <div className="memory-photos">
        {memory.photos.map((photo) => (
          <div key={photo.id} className="memory-photo">
            <img src={photoUrl(id, photo.id)} alt={photo.original_filename} />
            <button type="button" onClick={() => handleDeletePhoto(photo.id)} aria-label="Delete photo">
              ×
            </button>
          </div>
        ))}
        <label className="memory-photo memory-photo--upload">
          {uploading ? "Uploading…" : "+ Add photo"}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleUpload}
            disabled={uploading}
            hidden
          />
        </label>
      </div>

      <h2 className="landing__section-title">Stories</h2>
      <form className="planner-form" onSubmit={handleAddStory}>
        <label>
          Write about a moment from the trip
          <textarea
            value={newStory}
            onChange={(e) => setNewStory(e.target.value)}
            rows={3}
            placeholder="The sunrise at Promenade Beach was unreal…"
          />
        </label>
        <button type="submit" className="planner-submit" disabled={addingStory}>
          {addingStory ? "Adding…" : "Add story"}
        </button>
      </form>

      <div className="story-list">
        {memory.stories.length === 0 && <p className="itin-empty-day">No stories yet.</p>}
        {memory.stories.map((story) => (
          <StoryRow key={story.id} memoryId={id} story={story} onChanged={refresh} />
        ))}
      </div>
    </div>
  );
}
