/**
 * Heavy Line Asset Group — Dynamic Listings Engine
 * Reads listing JSON files from GitHub and renders them automatically
 */

const GITHUB_OWNER = 'navinramharak-rgb';
const GITHUB_REPO = 'heavyline-site';
const GITHUB_BRANCH = 'main';
const LISTINGS_PATH = 'listings';
const API_BASE = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LISTINGS_PATH}?ref=${GITHUB_BRANCH}`;

// Fetch all listings from GitHub
async function fetchAllListings() {
  try {
    const res = await fetch(API_BASE);
    if (!res.ok) return [];
    const files = await res.json();
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));
    const listings = await Promise.all(
      jsonFiles.map(async (file) => {
        const r = await fetch(file.download_url);
        if (!r.ok) return null;
        const data = await r.json();
        data._slug = file.name.replace('.json', '');
        return data;
      })
    );
    return listings.filter(Boolean).sort((a, b) => new Date(b.date || '2020-01-01') - new Date(a.date || '2020-01-01'));
  } catch (err) {
    console.error('Listings fetch error:', err);
    return [];
  }
}

// Build image URL from CMS path
function imgUrl(path) {
  if (!path) return 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80';
  if (path.startsWith('http')) return path;
  return `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${path}`;
}

// Render a single listing card
function renderCard(listing, classes = '') {
  const status = listing.status || 'Available';
  const badgeClass = status.toLowerCase() === 'available' ? 'available' : status.toLowerCase() === 'pending' ? 'pending' : 'sold';
  const specs = [];
  if (listing.hours) specs.push({ l: 'Hours', v: listing.hours });
  if (listing.year) specs.push({ l: 'Year', v: listing.year });
  if (listing.location) specs.push({ l: 'Location', v: listing.location.split(',')[0] });
  
  return `<a href="listing.html?slug=${listing._slug}" class="lst-card ${classes}" data-cat="${listing.category||''}" data-status="${status}" data-title="${listing.title||''}">
    <div class="lst-card__imgw">
      <img src="${imgUrl(listing.image)}" alt="${listing.title||''}" class="lst-card__img" loading="lazy">
      <span class="lst-card__badge ${badgeClass}">${status}</span>
    </div>
    <div class="lst-card__body">
      <p class="lst-card__cat">${listing.category||''}</p>
      <h3 class="lst-card__title">${listing.title||''}</h3>
      <p class="lst-card__sub">${listing.year||''} · ${(listing.condition||'').split('—')[0].trim()} · ${(listing.location||'').split(',')[0]}</p>
      <div class="lst-card__specs">${specs.map(s=>`<div><div class="lst-card__spec-l">${s.l}</div><div class="lst-card__spec-v">${s.v}</div></div>`).join('')}</div>
    </div>
  </a>`;
}

// Loading state HTML
function loadingHtml() {
  return `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;"><div style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#555;">Loading Equipment...</div></div>`;
}

// Empty state HTML
function emptyHtml(message) {
  return `<div style="grid-column:1/-1;text-align:center;padding:80px 20px;"><p style="font-size:16px;color:#666;">${message}</p></div>`;
}

// ============================================================
// BUY PAGE
// ============================================================
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
}

function filterListings() {
  if (!window._allListings) return;
  const search = (document.getElementById('search-input')?.value || '').toLowerCase();
  const cat = document.getElementById('cat-filter')?.value || '';
  const status = document.getElementById('status-filter')?.value || '';
  
  const filtered = window._allListings.filter(l => {
    const matchCat = !cat || l.category === cat;
    const matchStatus = !status || l.status === status;
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

// ============================================================
// HOMEPAGE FEATURED
// ============================================================
async function initHomeFeatured() {
  const grid = document.getElementById('featured-listings');
  if (!grid) return;
  
  const listings = await fetchAllListings();
  const featured = listings.filter(l => l.featured === true || l.featured === 'true').slice(0, 3);
  
  if (featured.length > 0) {
    grid.innerHTML = featured.map((l, i) => renderCard(l, `reveal rd${i+1}`)).join('');
  }
  // If no featured listings, keep the demo cards
}

// ============================================================
// LISTING DETAIL PAGE
// ============================================================
async function initListingPage() {
  const slug = new URLSearchParams(window.location.search).get('slug');
  if (!slug) return;

  try {
    const url = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/${LISTINGS_PATH}/${slug}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Not found');
    const listing = await res.json();
    listing._slug = slug;
    populateListingPage(listing);
  } catch (err) {
    console.error('Listing not found:', err);
  }
}

function populateListingPage(listing) {
  const status = listing.status || 'Available';
  const badgeClass = status.toLowerCase() === 'available' ? 'available' : status.toLowerCase() === 'pending' ? 'pending' : 'sold';

  // Page title
  document.title = `${listing.title} — Heavy Line Asset Group`;

  // Breadcrumb
  const bc = document.getElementById('breadcrumb-title');
  if (bc) bc.textContent = listing.title;

  // Hero image
  const heroImg = document.getElementById('hero-img');
  if (heroImg) heroImg.src = imgUrl(listing.image);

  // Status badge
  const heroBadge = document.getElementById('hero-badge');
  if (heroBadge) {
    heroBadge.textContent = status;
    heroBadge.style.background = badgeClass === 'available' ? '#E87722' : '#555';
  }

  // Gallery thumbnails
  const gallery = document.getElementById('gallery');
  if (gallery) {
    const imgs = [listing.image, ...(listing.gallery || [])].filter(Boolean);
    if (imgs.length > 1) {
      gallery.innerHTML = imgs.map((img, i) => {
        const src = imgUrl(img);
        return `<img src="${src}" alt="" style="width:100%;height:80px;object-fit:cover;cursor:pointer;border:2px solid ${i===0?'#E87722':'#272727'};transition:border-color .2s;" onclick="setHero('${src}')" class="gallery-thumb ${i===0?'active':''}">`;
      }).join('');
    } else {
      gallery.style.display = 'none';
    }
  }

  // Right panel - title and status
  const rTitle = document.getElementById('listing-right-title');
  if (rTitle) rTitle.textContent = listing.title;
  const rCat = document.getElementById('listing-right-cat');
  if (rCat) rCat.textContent = listing.category;
  const rSub = document.getElementById('listing-right-sub');
  if (rSub) rSub.textContent = `${listing.year||''} · ${listing.hours||''} · ${(listing.location||'').split(',')[0]}`;
  const rStatus = document.getElementById('listing-status-text');
  if (rStatus) {
    rStatus.textContent = status;
    rStatus.closest('div')?.style.setProperty('background', badgeClass==='available'?'rgba(232,119,34,.1)':'rgba(100,100,100,.1)');
  }

  // Specs table
  const specsTable = document.getElementById('specs-table');
  if (specsTable) {
    const rows = [
      ['Make', listing.make],
      ['Model', listing.model],
      ['Year', listing.year],
      ['Hours / Mileage', listing.hours],
      ['Category', listing.category],
      ['Condition', listing.condition],
      ['Serial Number', listing.serial],
      ['Location', listing.location],
      ['Attachments', listing.attachments],
    ].filter(([,v]) => v);

    specsTable.innerHTML = rows.map(([label, value], i) =>
      `<div style="background:${i%2===0?'#181818':'#1E1E1E'};padding:16px 20px;display:flex;justify-content:space-between;${label==='Attachments'?'grid-column:1/-1;':''}">
        <span style="font-size:13px;color:#999;">${label}</span>
        <span style="font-family:'Barlow Condensed',sans-serif;font-weight:700;font-size:15px;${label==='Condition'?'color:#E87722;':''}">${value}</span>
      </div>`
    ).join('');
  }

  // Description
  const descEl = document.getElementById('listing-description');
  if (descEl && listing.description) {
    descEl.innerHTML = listing.description.split('\n').filter(p=>p.trim()).map(p=>
      `<p style="font-size:15px;font-weight:300;color:#999;line-height:1.85;margin-bottom:12px;">${p}</p>`
    ).join('');
  }

  // Known issues
  const issuesWrap = document.getElementById('listing-issues-wrap');
  const issuesEl = document.getElementById('listing-issues');
  if (listing.issues && issuesEl) {
    issuesEl.textContent = listing.issues;
  } else if (issuesWrap) {
    issuesWrap.style.display = 'none';
  }

  // Shipping
  const shippingEl = document.getElementById('listing-shipping');
  if (shippingEl && listing.shipping) {
    shippingEl.textContent = listing.shipping;
  }

  // Video
  const videoWrap = document.getElementById('listing-video-wrap');
  if (listing.video && videoWrap) {
    let url = listing.video.includes('watch?v=') ? listing.video.replace('watch?v=','embed/') :
              listing.video.includes('youtu.be/') ? 'https://www.youtube.com/embed/'+listing.video.split('youtu.be/')[1] :
              listing.video;
    videoWrap.innerHTML = `<div style="margin-bottom:40px;"><h2 style="font-family:'Barlow Condensed',sans-serif;font-weight:900;font-size:28px;text-transform:uppercase;margin-bottom:16px;padding-bottom:12px;border-bottom:2px solid #E87722;">Equipment <span style="color:#E87722;">Video</span></h2><iframe src="${url}" style="width:100%;height:400px;border:none;" allowfullscreen></iframe></div>`;
  } else if (videoWrap) {
    videoWrap.style.display = 'none';
  }

  // Pre-fill inquiry form
  const inqEquip = document.getElementById('inq-equipment');
  if (inqEquip) inqEquip.value = listing.title;
}

// ============================================================
// AUTO INIT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  if (path.includes('buy')) initBuyPage();
  else if (path.includes('listing')) initListingPage();
  else initHomeFeatured();
});
