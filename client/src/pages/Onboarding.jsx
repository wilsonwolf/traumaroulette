import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { api } from '../api';

const STEPS = ['Account', 'Photo', 'Demographics', 'Trauma', 'Confirm'];

export default function Onboarding() {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Step 2 - Photo
  const [photoUrl, setPhotoUrl] = useState(user?.photo_url || '');
  const [photoPreview, setPhotoPreview] = useState(user?.photo_url || '');
  const fileRef = useRef(null);

  // Step 3 - Demographics
  const [bio, setBio] = useState(user?.bio || '');
  const [location, setLocation] = useState(user?.location || '');
  const [gender, setGender] = useState(user?.gender || '');
  const [age, setAge] = useState(user?.age || '');

  // Step 4 - Trauma
  const [trauma, setTrauma] = useState(user?.childhood_trauma || '');
  const [traumaResponse, setTraumaResponse] = useState(user?.trauma_response || '');

  async function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      const data = await api.uploadProfilePhoto(formData);
      setPhotoUrl(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemographics() {
    if (!bio.trim()) return setError('Bio is required');
    if (!location.trim()) return setError('Location is required');
    if (!gender) return setError('Gender is required');
    if (!age || age < 21 || age > 50) return setError('Age must be 21-50');

    setLoading(true);
    try {
      await api.updateProfile({ bio, location, gender, age: parseInt(age) });
      setError('');
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTraumaSubmit() {
    if (!trauma.trim()) return setError('Please share something');
    setLoading(true);
    try {
      const data = await api.submitTrauma({ trauma });
      setTraumaResponse(data.response);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleComplete() {
    setLoading(true);
    try {
      await api.completeOnboarding();
      await refreshUser();
      navigate('/lobby');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function canAdvance() {
    switch (step) {
      case 0: return true; // Already registered
      case 1: return !!photoUrl;
      case 2: return bio && location && gender && age >= 21 && age <= 50;
      case 3: return !!traumaResponse;
      case 4: return true;
      default: return false;
    }
  }

  function nextStep() {
    setError('');
    if (step === 2) return handleDemographics();
    if (step < 4) setStep(step + 1);
    if (step === 4) handleComplete();
  }

  return (
    <div className="onboarding">
      <div className="onboarding-progress">
        <span style={{fontSize:13,opacity:0.8}}>Step {step + 1} of {STEPS.length}: {STEPS[step]}</span>
        <div className="steps">
          {STEPS.map((_, i) => (
            <div key={i} className={`step-dot ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`} />
          ))}
        </div>
      </div>

      <div className="onboarding-content">
        <div className="card">
          {step === 0 && (
            <>
              <h2>Welcome, {user?.display_name}!</h2>
              <p className="step-desc">Let's set up your profile before you enter the chaos.</p>
              <p style={{color:'var(--text-secondary)',fontSize:14}}>
                Your account has been created. Let's add some details.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <h2>Show Your Face</h2>
              <p className="step-desc">Upload a profile photo. This is required for the experience.</p>
              <div className="photo-upload">
                {photoPreview ? (
                  <img src={photoPreview} className="photo-preview" alt="Profile" />
                ) : (
                  <div className="photo-placeholder" onClick={() => fileRef.current?.click()}>?</div>
                )}
                <input ref={fileRef} type="file" accept="image/*" onChange={handlePhotoUpload} />
                <button className="btn-outline" onClick={() => fileRef.current?.click()} disabled={loading}>
                  {loading ? 'Uploading...' : photoUrl ? 'Change Photo' : 'Choose Photo'}
                </button>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2>Tell Us About Yourself</h2>
              <p className="step-desc">The bare minimum. We're not picky.</p>
              <div className="form-group">
                <label>Bio ({200 - bio.length} chars left)</label>
                <textarea
                  value={bio}
                  onChange={e => setBio(e.target.value.slice(0, 200))}
                  placeholder="Something witty or deeply sad"
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Location</label>
                <input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select value={gender} onChange={e => setGender(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Age (21-50)</label>
                <input type="number" min={21} max={50} value={age} onChange={e => setAge(e.target.value)} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2>The Trauma Question</h2>
              <p className="step-desc">Describe your childhood trauma in one sentence. Dr. Slavenko will assess you.</p>
              <div className="form-group">
                <textarea
                  value={trauma}
                  onChange={e => setTrauma(e.target.value)}
                  placeholder="e.g., My parents never showed up to my school plays..."
                  rows={3}
                />
              </div>
              <button
                className="btn-secondary"
                onClick={handleTraumaSubmit}
                disabled={loading || !trauma.trim()}
                style={{width:'100%',marginBottom:8}}
              >
                {loading ? 'Dr. Slavenko is typing...' : 'Submit to Dr. Slavenko'}
              </button>
              {traumaResponse && (
                <div className="trauma-response">{traumaResponse}</div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <h2>Ready for Chaos?</h2>
              <p className="step-desc">Here's your profile summary. Look good? (It doesn't matter.)</p>
              <div className="confirmation-summary">
                <div className="summary-item">
                  <span className="label">Name</span>
                  <span className="value">{user?.display_name}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Photo</span>
                  <span className="value">
                    {photoUrl && <img src={photoUrl} alt="Profile" />}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="label">Bio</span>
                  <span className="value">{bio || '—'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Location</span>
                  <span className="value">{location || '—'}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Age / Gender</span>
                  <span className="value">{age} / {gender}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Trauma</span>
                  <span className="value" style={{fontSize:12}}>{trauma || '—'}</span>
                </div>
              </div>
            </>
          )}

          {error && <p className="error">{error}</p>}

          <div className="onboarding-nav">
            {step > 0 && (
              <button className="btn-outline" onClick={() => { setStep(step - 1); setError(''); }}>
                Back
              </button>
            )}
            <button
              className="btn-primary"
              onClick={nextStep}
              disabled={!canAdvance() || loading}
            >
              {step === 4 ? 'Enter the Lobby' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
