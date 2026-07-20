document.getElementById('year').textContent = new Date().getFullYear();

// Back to top
const backToTop = document.getElementById('backToTop');

window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    backToTop.classList.add('visible');
  } else {
    backToTop.classList.remove('visible');
  }
});

backToTop.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Netlify Forms only exists once the site is actually deployed on Netlify
// (or run through `netlify dev`). Opening index.html as a file:// path, or
// serving it from a plain static server, has no form backend at all — fetch
// would always fail there, so skip the real network call in that case and
// show an accurate preview message instead of a false "something went wrong".
function isLocalPreview() {
  return location.protocol === 'file:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
}

// Quote request form (Netlify Forms)
// Sent as native multipart/form-data (no Content-Type set — the browser adds
// the boundary itself) so the "photos" file input actually reaches Netlify.
const quoteForm = document.getElementById('quote-form');
const formStatus = document.getElementById('form-status');

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_UPLOAD_FILES = 25;

if (quoteForm) {
  quoteForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const jobName = document.getElementById('jobName').value.trim();
    const jobContact = document.getElementById('jobContact').value.trim();
    if (!jobName || !jobContact) {
      formStatus.textContent = 'Please fill in your name and phone or email before submitting.';
      return;
    }

    const jobPhotosInput = document.getElementById('jobPhotos');
    if (jobPhotosInput && jobPhotosInput.files.length > MAX_UPLOAD_FILES) {
      formStatus.textContent = `Please choose at most ${MAX_UPLOAD_FILES} files (you selected ${jobPhotosInput.files.length}).`;
      return;
    }
    const oversizeFile = jobPhotosInput && Array.from(jobPhotosInput.files).find((f) => f.size > MAX_UPLOAD_BYTES);
    if (oversizeFile) {
      formStatus.textContent = `"${oversizeFile.name}" is over 15MB — please choose a smaller file.`;
      return;
    }

    wizardSubmit.disabled = true;
    try {
      if (isLocalPreview()) {
        formStatus.textContent = 'Preview mode — this will actually send once the site is live on Netlify.';
        quoteForm.reset();
        resetWizard();
        return;
      }

      formStatus.textContent = 'Sending...';
      const res = await fetch('/', {
        method: 'POST',
        body: new FormData(quoteForm),
      });
      if (res.ok) {
        formStatus.textContent = 'Sent — Roby will get back to you soon.';
        quoteForm.reset();
        resetWizard();
      } else {
        console.error('Quote form submission rejected:', res.status, await res.text().catch(() => ''));
        formStatus.textContent = 'Something went wrong. Please call or text instead.';
      }
    } catch (err) {
      console.error('Quote form submission failed:', err);
      formStatus.textContent = 'Something went wrong. Please call or text instead.';
    } finally {
      wizardSubmit.disabled = false;
    }
  });
}

// Multi-step job wizard
const wizardSteps = Array.from(document.querySelectorAll('.wizard-step'));
const wizardBack = document.getElementById('wizardBack');
const wizardNext = document.getElementById('wizardNext');
const wizardSubmit = document.getElementById('wizardSubmit');
const wizardProgressBar = document.getElementById('wizardProgressBar');
const wizardStepLabel = document.getElementById('wizardStepLabel');
let wizardCurrent = 1;

function wizardValidateStep(step) {
  if (step === 1) {
    return document.getElementById('jobPostal').value.trim() !== '';
  }
  if (step === 2) {
    return document.querySelectorAll('input[name="object_types"]:checked').length > 0;
  }
  return true;
}

function goToStep(step) {
  wizardCurrent = step;
  wizardSteps.forEach((el) => {
    el.hidden = Number(el.dataset.step) !== step;
  });
  const total = wizardSteps.length;
  wizardProgressBar.style.width = `${(step / total) * 100}%`;
  wizardStepLabel.textContent = `Step ${step} of ${total}`;
  wizardBack.disabled = step === 1;
  const isLast = step === total;
  wizardNext.hidden = isLast;
  wizardSubmit.hidden = !isLast;
}

function resetWizard() {
  document.getElementById('objectOtherWrap').hidden = true;
  document.getElementById('photoUploadWrap').hidden = true;
  goToStep(1);
}

if (wizardSteps.length) {
  const objectOther = document.getElementById('objectOther');
  const objectOtherWrap = document.getElementById('objectOtherWrap');
  objectOther.addEventListener('change', () => {
    objectOtherWrap.hidden = !objectOther.checked;
  });

  const wantsPhotosYes = document.getElementById('wantsPhotosYes');
  const wantsPhotosNo = document.getElementById('wantsPhotosNo');
  const photoUploadWrap = document.getElementById('photoUploadWrap');
  [wantsPhotosYes, wantsPhotosNo].forEach((radio) => {
    radio.addEventListener('change', () => {
      photoUploadWrap.hidden = !wantsPhotosYes.checked;
    });
  });

  wizardNext.addEventListener('click', () => {
    if (!wizardValidateStep(wizardCurrent)) {
      formStatus.textContent = 'Please fill in this step before continuing.';
      return;
    }
    formStatus.textContent = '';
    goToStep(Math.min(wizardCurrent + 1, wizardSteps.length));
  });

  wizardBack.addEventListener('click', () => {
    goToStep(Math.max(wizardCurrent - 1, 1));
  });

  // Enter's default action submits the form via the first submit button in
  // the DOM — wizardSubmit — even though it's still `hidden` on earlier
  // steps. Without this, pressing Enter while typing (e.g. the postal code)
  // attempts a real submit with the later steps still empty instead of
  // advancing to the next step like a user would expect.
  quoteForm.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.tagName === 'TEXTAREA') return;
    if (wizardCurrent === wizardSteps.length) return;
    e.preventDefault();
    wizardNext.click();
  });

  goToStep(1);
}

// Customer reviews — real shared storage via Firestore (see firebase-reviews.js).
// Every visitor's browser sees the same live collection, not just their own.
const userReviewsEl = document.getElementById('userReviews');
const reviewForm = document.getElementById('reviewForm');
const reviewFormMsg = document.getElementById('reviewFormMsg');

// A misconfigured Firebase project (or a dropped connection) can leave the
// Firestore SDK retrying forever instead of rejecting — without this, the
// submit button would stay disabled indefinitely with no feedback at all.
function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

function renderReview(review) {
  // Guard against any malformed record (bad write, future schema change)
  // instead of letting one bad document take the whole list down.
  const name = review.name || 'Anonymous';
  const city = review.city || 'GTA';
  const service = review.service || 'General';
  const text = review.text || '';
  // `|| 5` alone would also catch a *valid* explicit rating of 0 and bump it
  // to 5 (0 is falsy) instead of clamping it to 1 like every other value —
  // only fall back to 5 when the field is actually missing/non-numeric.
  const rawRating = Number(review.rating);
  const rating = Math.max(1, Math.min(5, Number.isFinite(rawRating) ? rawRating : 5));

  const card = document.createElement('div');
  card.className = 'review-card';

  const top = document.createElement('div');
  top.className = 'review-top';

  const stars = document.createElement('span');
  stars.className = 'review-stars';
  stars.textContent = '★'.repeat(rating) + '☆'.repeat(5 - rating);

  const loc = document.createElement('span');
  loc.className = 'review-loc mono';
  loc.textContent = city;

  top.append(stars, loc);

  card.append(top);

  const textEl = document.createElement('p');
  textEl.textContent = `"${text}"`;

  const job = document.createElement('div');
  job.className = 'review-job mono';
  job.textContent = service.toUpperCase();

  const reviewer = document.createElement('div');
  reviewer.className = 'review-name mono';
  reviewer.textContent = `— ${name}`;

  card.append(textEl, job, reviewer);
  userReviewsEl.appendChild(card);
  return card;
}

function renderAllReviews(reviews) {
  userReviewsEl.innerHTML = '';
  reviews.forEach((r) => {
    try {
      renderReview(r);
    } catch (e) {
      console.warn('Skipping malformed review record:', r, e);
    }
  });
}

let scrollToNewReview = false;

function startReviewsSync() {
  window.reviewsDB.subscribe((reviews) => {
    renderAllReviews(reviews);
    // A just-added review first arrives with createdAt still null (pending
    // server timestamp), which sorts it to the *bottom* of the desc-ordered
    // list instead of the top — skip scrolling until the server timestamp
    // resolves and the new review actually lands in front.
    if (scrollToNewReview && reviews[0] && reviews[0].createdAt) {
      scrollToNewReview = false;
      const firstCard = userReviewsEl.querySelector('.review-card');
      if (firstCard) firstCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
}

if (userReviewsEl) {
  if (window.reviewsDB) {
    startReviewsSync();
  } else {
    window.addEventListener('reviewsdb-ready', startReviewsSync, { once: true });
  }
}

if (reviewForm) {
  const reviewSubmitBtn = reviewForm.querySelector('button[type="submit"]');

  reviewForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('reviewName').value.trim();
    const city = document.getElementById('reviewCity').value.trim();
    const service = document.getElementById('reviewService').value;
    const text = document.getElementById('reviewText').value.trim();
    const rating = Math.max(1, Math.min(5, Number(document.getElementById('reviewRating').value)));

    if (!name || !city || !service || !text || !rating) {
      reviewFormMsg.textContent = 'Please fill in all fields before submitting.';
      return;
    }

    reviewSubmitBtn.disabled = true;
    try {
      if (!window.reviewsDB) {
        reviewFormMsg.textContent = 'Reviews aren’t connected yet — please try again in a moment.';
        return;
      }

      scrollToNewReview = true;
      await withTimeout(
        window.reviewsDB.addReview({ name, city, service, text, rating }),
        10000,
        'Timed out saving to the review database.'
      );

      // Captured before reset() clears the fields — the Netlify email
      // notification needs the submitted values, not the blanked-out form.
      const netlifyFormData = new FormData(reviewForm);

      // A genuinely good review deserves a warmer thank-you than a routine one.
      reviewFormMsg.textContent = rating >= 4
        ? 'Thank you so much for the great review — really appreciate it! \u{1F64F}'
        : 'Thanks for taking the time to share your feedback!';
      reviewForm.reset();

      // Best-effort email notification to Roby via Netlify Forms — Firestore
      // above is the real source of truth, so a failure here isn't fatal.
      if (!isLocalPreview()) {
        fetch('/', { method: 'POST', body: netlifyFormData }).catch((err) => {
          console.warn('Netlify email notification failed (review was still saved):', err);
        });
      }
    } catch (err) {
      scrollToNewReview = false;
      console.error('Failed to save review:', err);
      reviewFormMsg.textContent = 'Something went wrong saving your review — please try again.';
    } finally {
      reviewSubmitBtn.disabled = false;
      setTimeout(() => { reviewFormMsg.textContent = ''; }, 6000);
    }
  });
}
