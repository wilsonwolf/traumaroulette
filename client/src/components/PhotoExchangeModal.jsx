/**
 * @file PhotoExchangeModal.jsx
 * @description Dual-purpose modal for the photo exchange feature.
 *
 * Operates in two modes based on the props it receives:
 *
 *   1. **Upload mode** (`photos` is null, `onSubmit` is provided):
 *      Shows a file picker for the user to choose a photo. Once selected the
 *      photo is submitted via `onSubmit` and a "waiting for partner" message
 *      is shown. Both users must submit before the reveal.
 *
 *   2. **Rating mode** (`photos` is provided, `onRate` is provided):
 *      Displays both users' photos side-by-side ("Photo Reveal!") and a
 *      1-5 star rating widget for the partner's photo. The rating is submitted
 *      via `onRate`.
 *
 * The parent Chat component controls which mode is active by passing different
 * prop combinations.
 */

import { useState, useRef } from 'react';

/**
 * Photo exchange modal component (upload + reveal + rating).
 *
 * @component
 * @param {Object} props
 * @param {((file: File) => void)|null} props.onSubmit - Called with the selected File
 *   in upload mode. Null in rating mode.
 * @param {Array<{ userId: number, photoUrl: string }>|null} props.photos - Both users'
 *   photos for the reveal. Null in upload mode.
 * @param {((score: number) => void)|null} props.onRate - Called with the 1-5 star
 *   rating in rating mode. Null in upload mode.
 * @param {number} [props.currentUserId] - The authenticated user's ID, used to
 *   distinguish "You" vs "Partner" labels in the reveal.
 * @returns {React.ReactElement} The modal overlay in the appropriate mode.
 */
export default function PhotoExchangeModal({ onSubmit, photos, onRate, currentUserId }) {
  /** @type {[string|null, Function]} Local object URL for immediate photo preview */
  const [preview, setPreview] = useState(null);
  /** @type {[boolean, Function]} Whether the user has already submitted their photo */
  const [submitted, setSubmitted] = useState(false);
  /** @type {[number, Function]} The currently selected star rating (1-5, 0 = none) */
  const [rating, setRating] = useState(0);
  /** @type {[number, Function]} Temporarily highlighted star on hover (0 = none) */
  const [hoverRating, setHoverRating] = useState(0);
  /** Ref for the hidden file input to trigger it programmatically */
  const fileRef = useRef(null);

  /**
   * Handles file selection from the hidden input. Creates a local preview,
   * calls the parent's onSubmit with the raw File object, and marks the
   * submission as complete.
   *
   * @param {React.ChangeEvent<HTMLInputElement>} e - File input change event.
   */
  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSubmit(file);
    setSubmitted(true);
  }

  // -- Rating mode: both photos have been submitted and revealed --
  if (photos && onRate) {
    // Identify the partner's photo so we can show the rating prompt for it
    const partnerPhoto = photos.find(p => p.userId !== currentUserId);

    return (
      <div className="modal-overlay">
        <div className="modal photo-exchange-modal">
          <h2>Photo Reveal!</h2>
          {/* Display both photos side-by-side with "You" / "Partner" labels */}
          <div className="photo-reveal">
            {photos.map(p => (
              <div key={p.userId} className="photo-card">
                <img src={p.photoUrl} alt="" />
                <div className="photo-label">
                  {p.userId === currentUserId ? 'You' : 'Partner'}
                </div>
              </div>
            ))}
          </div>

          {/* Star rating widget for the partner's photo */}
          {partnerPhoto && (
            <>
              <p>Rate your partner's photo:</p>
              <div className="rating-stars">
                {/* Render 5 stars; fill based on hover state or selected rating */}
                {[1, 2, 3, 4, 5].map(star => (
                  <span
                    key={star}
                    className={`star ${star <= (hoverRating || rating) ? 'filled' : 'empty'}`}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(star)}
                  >
                    &#9733;
                  </span>
                ))}
              </div>
              <button
                className="btn-primary"
                disabled={!rating}
                onClick={() => onRate(rating)}
                style={{width:'100%'}}
              >
                Submit Rating
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // -- Upload mode: user needs to select and submit a photo --
  return (
    <div className="modal-overlay">
      <div className="modal photo-exchange-modal">
        <h2>Photo Exchange</h2>
        <p>Both of you need to share a photo before continuing. It will be revealed simultaneously!</p>

        {submitted ? (
          /* Post-submission: show the uploaded preview and a waiting message */
          <>
            {preview && <img src={preview} alt="" style={{width:120,height:120,borderRadius:8,objectFit:'cover',margin:'12px auto'}} />}
            <p style={{color:'var(--whatsapp-green)',fontWeight:600}}>Photo submitted! Waiting for partner...</p>
          </>
        ) : (
          /* Pre-submission: clickable upload area with hidden file input */
          <div className="upload-area" onClick={() => fileRef.current?.click()}>
            {preview ? (
              <img src={preview} alt="" />
            ) : (
              <div>
                <div style={{fontSize:36,marginBottom:8}}>+</div>
                <div>Click to choose a photo</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={handleFile} />
          </div>
        )}
      </div>
    </div>
  );
}
