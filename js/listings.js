/**
 * Heavy Line Asset Group — Dynamic Listings Engine
 * Fetches listings via Netlify Function (no GitHub rate limits)
 * Andrew adds a listing in CMS → it appears on the site automatically
 */

const GITHUB_OWNER  = 'navinramharak-rgb';
const GITHUB_REPO   = 'heavyline-site';
const GITHUB_BRANCH = 'main';
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;

// ── FETCH ALL LISTINGS ────────────────────────────────────────
async function fetchAllListings() {
  // Primary: Netlify serverless function — no rate limits, fully automatic
  try {
    const fnRes = await fetch('/.netlify/functions/listings');
    if (fnRes.ok) {
      const listings = await fnRes.json();
      if (Array.isArray(listings)) return listings;
    }
  } catch (e) {
    console.warn('Netlify function unavailable, trying fallback...');
  }

  // Fallback: index.json via raw GitHub (no API rate limits)
  try {
    const indexRes = await fetch(`${RAW_BASE}/listings/index.json`);
    if (indexRes.ok) {
      const index = await indexRes.json();
      const slugs = index.slugs || [];
      const listings = await Promise.all(
        slugs.map(async (slug) => {
          const r = await fetch(`${RAW_BASE}/listings/${slug}.json`);
          if (!r.ok) return null;
          const data = await r.json();
          data._slug = slug;
          return data;
        })
      );
      return listings.filter(Boolean)
        .sort((a, b) => new Date(b.date || '2020-01-01') - new Date(a.date || '2020-01-01'));
    }
  } catch (e) {
    console.warn('Index fallback failed');
  }
  return [];
}

// ── IMAGE URL ─────────────────────────────────────────────────
function imgUrl(path) {
  if (!path) return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80';
  if (path.startsWith('http')) return path;
  return `${RAW_BASE}/${path.replace(/^\//, '')}`;
}

// ── RENDER CARD ───────────────────────────────────────────────
function renderCard(listing, classes = '') {
  const status = listing.status || 'Available';
  const badgeClass = status.toLowerCase() === 'available' ? 'available'
                   : status.toLowerCase() === 'pending'   ? 'pending' : 'sold';
  const specs = [];
  if (listing.hours)    specs.push({ l: 'Hours',    v: listing.hours });
  if (listing.year)     specs.push({ l: 'Year',     v: listing.year });
  if (listing.location) specs.push({ l: 'Location', v: listing.location.split(',')[0].trim() });

  return `<a href="listing.html?slug=${listing._slug}" class="lst-card ${classes}" data-cat="${listing.category||''}" data-status="${status}" data-title="${(listing.title||'').replace(/"/g,'&quot;')}">
    <div class="lst-card__imgw">
      <img src="${imgUrl(listing.image)}" alt="${listing.title||''}" class="lst-card__img" loading="lazy">
      <span class="lst-card__badge ${badgeClass}">${status}</span>
    </div>
    <div class="lst-card__body">
      <p class="lst-card__cat">${listing.category||''}</p>
      <h3 class="lst-card__title">${listing.title||''}</h3>
      <p class="lst-card__sub">${listing.year||''} · ${(listing.condition||'').split('—')[0].trim()} · ${(listing.location||'').split(',')[0].trim()}</p>
      <div class="lst-card__specs">${specs.map(s=>`<div><div class="lst-card__spec-l">${s.l}</div><div class="lst-card__spec-v">${s.v}</div></div>`).join('')}</div>
    </div>
  </a>`;
}

function loadingHtml() {
  return `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;"><div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#555;">Loading Equipment...</div></div>`;
}
function emptyHtml(msg) {
  return `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;"><p style="font-size:16px;color:#666;">${msg}</p></div>`;
}

// ── BUY PAGE ──────────────────────────────────────────────────
window._allListings = [];

async function initBuyPage() {
  const grid = document.getElementById('listings-grid');
  if (!grid) return;
  grid.innerHTML = loadingHtml();
  window._allListings = await fetchAllListings();
  if (window._allListings.length === 0) {
    grid.innerHTML = emptyHtml('No listings available yet. Check back soon.');
    return;
  }
  renderBuyGrid(window._allListings);
}

function renderBuyGrid(listings) {
  const grid = document.getElementById('listings-grid');
  const noResults = document.getElementById('no-results');
  if (!grid) return;
  if (listings.length === 0) {
    grid.innerHTML = '';
    if (noResults) noResults.style.display = 'block';
    return;
  }
  if (noResults) noResults.style.display = 'none';
  grid.innerHTML = listings.map(l => renderCard(l)).join('');
  // Trigger reveal on dynamically added cards
  grid.querySelectorAll('.reveal').forEach(el => el.classList.add('in-view'));
}

function filterListings() {
  if (!window._allListings) return;
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const cat    = document.getElementById('cat-filter')?.value || '';
  const status = document.getElementById('status-filter')?.value || '';
  const filtered = window._allListings.filter(l => {
    const matchCat    = !cat    || l.category === cat;
    const matchStatus = !status || l.status   === status;
    const matchSearch = !search || [l.title, l.category, l.make, l.model, l.location].join(' ').toLowerCase().includes(search);
    return matchCat && matchStatus && matchSearch;
  });
  renderBuyGrid(filtered);
}

function setCat(cat) {
  const f = document.getElementById('cat-filter');
  if (f) f.value = cat;
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', (!cat && b.textContent.trim() === 'All') || b.textContent.trim() === cat);
  });
  filterListings();
  document.getElementById('all-listings')?.scrollIntoView({ behavior: 'smooth' });
}

// ── HOMEPAGE FEATURED ─────────────────────────────────────────
async function initHomeFeatured() {
  const grid = document.getElementById('featured-listings');
  if (!grid) return;
  const listings = await fetchAllListings();
  // Show featured listings, or fall back to first 3 available
  const featured = listings.filter(l => l.featured === true || l.featured === 'true').slice(0, 3);
  const toShow = featured.length > 0 ? featured : listings.slice(0, 3);
  if (toShow.length > 0) {
    grid.innerHTML = toShow.map((l, i) => renderCard(l, `reveal rd${i+1}`)).join('');
    // Trigger reveal animation on newly added cards
    grid.querySelectorAll('.reveal').forEach(el => {
      el.classList.add('in-view');
    });
  }
}

// ── LISTING DETAIL PAGE ───────────────────────────────────────
async function initListingPage() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) return;
  try {
    const res = await fetch(`${RAW_BASE}/listings/${slug}.json`);
    if (!res.ok) throw new Error('Not found');
    const listing = await res.json();
    listing._slug = slug;
    populateListingPage(listing);
  } catch (err) {
    console.error('Listing not found:', err);
  }
}

function populateListingPage(listing) {
  const status     = listing.status || 'Available';
  const badgeClass = status.toLowerCase() === 'available' ? 'available'
                   : status.toLowerCase() === 'pending'   ? 'pending' : 'sold';

  document.title = `${listing.title} — Heavy Line Asset Group`;

  const bc = document.getElementById('breadcrumb-title');
  if (bc) bc.textContent = listing.title;

  const heroImg = document.getElementById('hero-img');
  if (heroImg) heroImg.src = imgUrl(listing.image);

  const heroBadge = document.getElementById('hero-badge');
  if (heroBadge) {
    heroBadge.textContent = status;
    heroBadge.style.background = badgeClass === 'available' ? '#E87722' : '#555';
  }

  const gallery = document.getElementById('gallery');
  if (gallery) {
    const imgs = [listing.image, ...(listing.gallery || [])].filter(Boolean);
    if (imgs.length > 1) {
      gallery.innerHTML = imgs.map((img, i) => {
        const src = imgUrl(img);
        return `<img src="${src}" data-full="${src}" alt="" style="width:100%;height:80px;object-fit:cover;cursor:pointer;border:2px solid ${i===0?'#E87722':'#272727'};transition:border-color .2s;" class="gallery-thumb ${i===0?'active':''}">`;
      }).join('');
      // Use event delegation instead of inline onclick (safer with URLs)
      gallery.addEventListener('click', function(e) {
        const thumb = e.target.closest('.gallery-thumb');
        if (!thumb) return;
        const fullSrc = thumb.getAttribute('data-full');
        document.getElementById('hero-img').src = fullSrc;
        gallery.querySelectorAll('.gallery-thumb').forEach(t => { t.style.borderColor='#272727'; t.classList.remove('active'); });
        thumb.style.borderColor = '#E87722';
        thumb.classList.add('active');
      });
    } else { gallery.style.display = 'none'; }
  }

  const rTitle = document.getElementById('listing-right-title');
  if (rTitle) rTitle.textContent = listing.title;
  const rCat = document.getElementById('listing-right-cat');
  if (rCat) rCat.textContent = listing.category;
  const rSub = document.getElementById('listing-right-sub');
  if (rSub) rSub.textContent = `${listing.year||''} · ${listing.hours||''} · ${(listing.location||'').split(',')[0].trim()}`;
  const rStatus = document.getElementById('listing-status-text');
  if (rStatus) {
    rStatus.textContent = status;
    rStatus.closest('div')?.style.setProperty('background', badgeClass==='available'?'rgba(232,119,34,.1)':'rgba(100,100,100,.1)');
  }

  const specsTable = document.getElementById('specs-table');
  if (specsTable) {
    const rows = [
      ['Make', listing.make], ['Model', listing.model],
      ['Year', listing.year], ['Hours / Mileage', listing.hours],
      ['Category', listing.category], ['Condition', listing.condition],
      ['Serial Number', listing.serial], ['Location', listing.location],
      ['Attachments', listing.attachments],
    ].filter(([,v]) => v);
    specsTable.innerHTML = rows.map(([label, value], i) =>
      `<div style="background:${i%2===0?'#181818':'#1E1E1E'};padding:16px 20px;display:flex;justify-content:space-between;${label==='Attachments'?'grid-column:1/-1;':''}">
        <span style="font-size:13px;color:#999;">${label}</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;${label==='Condition'?'color:#E87722;':''}">${value}</span>
      </div>`
    ).join('');
  }

  const descEl = document.getElementById('listing-description');
  if (descEl && listing.description) {
    descEl.innerHTML = listing.description.split('\n').filter(p=>p.trim()).map(p=>
      `<p style="font-size:15px;font-weight:300;color:#b0b0b0;line-height:1.85;margin-bottom:12px;">${p}</p>`
    ).join('');
  }

  const issuesWrap = document.getElementById('listing-issues-wrap');
  const issuesEl   = document.getElementById('listing-issues');
  if (listing.issues && issuesEl) {
    issuesEl.textContent = listing.issues;
  } else if (issuesWrap) { issuesWrap.style.display = 'none'; }

  const shippingEl = document.getElementById('listing-shipping');
  if (shippingEl && listing.shipping) shippingEl.textContent = listing.shipping;

  const videoWrap = document.getElementById('listing-video-wrap');
  if (listing.video && videoWrap) {
    let url = listing.video.includes('watch?v=') ? listing.video.replace('watch?v=','embed/')
            : listing.video.includes('youtu.be/') ? 'https://www.youtube.com/embed/'+listing.video.split('youtu.be/')[1]
            : listing.video;
    videoWrap.innerHTML = `<div style="margin-bottom:40px;"><h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;text-transform:uppercase;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #E87722;">Equipment <span style="color:#E87722;">Video</span></h2><iframe src="${url}" style="width:100%;height:400px;border:none;" allowfullscreen></iframe></div>`;
  } else if (videoWrap) { videoWrap.style.display = 'none'; }

  const inqEquip = document.getElementById('inq-equipment');
  if (inqEquip) inqEquip.value = listing.title;
}

// ── AUTO INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if      (path.includes('buy'))      initBuyPage();
  else if (path.includes('listing'))  initListingPage();
  else                                initHomeFeatured();
});

// Also run on window load as backup (handles cached pages)
window.addEventListener('load', () => {
  const path = window.location.pathname;
  const grid = document.getElementById('featured-listings');
  if (grid && !path.includes('buy') && !path.includes('listing')) {
    if (grid.querySelector('.lst-card') === null) {
      initHomeFeatured();
    }
  }
});
