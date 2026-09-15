import { getStore } from '@netlify/blobs';

const STORE_NAME = 'logbook';
const KEY = 'data';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

export default async (req) => {
  // The passphrase is set as an environment variable in your Netlify site
  // settings. Without it, sync stays switched off rather than wide open.
  const expected = process.env.SYNC_PASSPHRASE;
  if (!expected) {
    return json(
      {
        error:
          'Sync is not set up yet. Add a SYNC_PASSPHRASE environment variable in your Netlify site settings, then redeploy.',
      },
      503
    );
  }

  const provided = req.headers.get('x-logbook-key') || '';
  if (provided !== expected) {
    return json({ error: 'Wrong passphrase.' }, 401);
  }

  // 'strong' consistency so a read right after a write returns the new value,
  // which matters when you save on one device and immediately open another.
  const store = getStore({ name: STORE_NAME, consistency: 'strong' });

  if (req.method === 'GET') {
    try {
      const existing = await store.get(KEY, { type: 'json' });
      return json({ data: existing || null });
    } catch (err) {
      return json({ error: 'Could not read stored data.' }, 500);
    }
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch (err) {
      return json({ error: 'Request body was not valid JSON.' }, 400);
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return json({ error: 'Unexpected payload shape.' }, 400);
    }
    try {
      await store.setJSON(KEY, body);
      return json({ ok: true, updatedAt: body.updatedAt || null });
    } catch (err) {
      return json({ error: 'Could not save data.' }, 500);
    }
  }

  return json({ error: 'Method not allowed.' }, 405);
};

export const config = {
  path: '/api/sync',
};
