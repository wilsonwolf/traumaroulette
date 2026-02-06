import { useState, useRef } from 'react';

export default function PhotoExchangeModal({ onSubmit, photos, onRate, currentUserId }) {
  const [preview, setPreview] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onSubmit(file);
    setSubmitted(true);
  }

  // Rating mode
  if (photos && onRate) {
    const partnerPhoto = photos.find(p => p.userId !== currentUserId);

    return (
      <div className="modal-overlay">
        <div className="modal photo-exchange-modal">
          <h2>Photo Reveal!</h2>
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

          {partnerPhoto && (
            <>
              <p>Rate your partner's photo:</p>
              <div className="rating-stars">
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

  // Upload mode
  return (
    <div className="modal-overlay">
      <div className="modal photo-exchange-modal">
        <h2>Photo Exchange</h2>
        <p>Both of you need to share a photo before continuing. It will be revealed simultaneously!</p>

        {submitted ? (
          <>
            {preview && <img src={preview} alt="" style={{width:120,height:120,borderRadius:8,objectFit:'cover',margin:'12px auto'}} />}
            <p style={{color:'var(--whatsapp-green)',fontWeight:600}}>Photo submitted! Waiting for partner...</p>
          </>
        ) : (
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
