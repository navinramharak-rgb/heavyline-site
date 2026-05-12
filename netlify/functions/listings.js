// Netlify Function: proxies GitHub API with auth token to avoid rate limits
// Deployed at: /.netlify/functions/listings

exports.handler = async (event, context) => {
  const GITHUB_OWNER = 'navinramharak-rgb';
  const GITHUB_REPO = 'heavyline-site';
  const GITHUB_BRANCH = 'main';
  const LISTINGS_PATH = 'listings';
  const TOKEN = process.env.GITHUB_TOKEN;

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  try {
    const apiUrl = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${LISTINGS_PATH}?ref=${GITHUB_BRANCH}`;
    
    const fetchHeaders = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'HeavyLine-Site',
    };
    if (TOKEN) fetchHeaders['Authorization'] = `token ${TOKEN}`;

    const dirRes = await fetch(apiUrl, { headers: fetchHeaders });
    if (!dirRes.ok) {
      return { statusCode: dirRes.status, headers, body: JSON.stringify({ error: 'GitHub API error', status: dirRes.status }) };
    }

    const files = await dirRes.json();
    if (!Array.isArray(files)) {
      return { statusCode: 200, headers, body: JSON.stringify([]) };
    }

    const jsonFiles = files.filter(f => f.name.endsWith('.json') && f.name !== 'index.json');

    const listings = await Promise.all(
      jsonFiles.map(async (file) => {
        const r = await fetch(file.download_url);
        if (!r.ok) return null;
        const data = await r.json();
        data._slug = file.name.replace('.json', '');
        return data;
      })
    );

    const result = listings
      .filter(Boolean)
      .sort((a, b) => new Date(b.date || '2020-01-01') - new Date(a.date || '2020-01-01'));

    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
