// Shared Klaviyo API wrapper — used by subscribe, track-cart, sync-to-klaviyo edge functions

const BASE_URL = 'https://a.klaviyo.com/api';
const REVISION = '2024-02-15';

function headers(apiKey: string): Record<string, string> {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'Authorization': `Klaviyo-API-Key ${apiKey}`,
    'revision': REVISION,
  };
}

// ── Create or update a Klaviyo profile ──────────────────────────────────────

export async function upsertProfile(
  apiKey: string,
  profile: {
    email: string;
    first_name?: string | null;
    date_of_birth?: string | null;
    goggle_interest?: string | null;
    child_age?: number | null;
    source?: string | null;
  }
): Promise<string | null> {
  const body = {
    data: {
      type: 'profile',
      attributes: {
        email: profile.email,
        first_name: profile.first_name ?? undefined,
        properties: {
          ...(profile.goggle_interest && { goggle_interest: profile.goggle_interest }),
          ...(profile.child_age       && { child_age: profile.child_age }),
          ...(profile.date_of_birth   && { date_of_birth: profile.date_of_birth }),
          ...(profile.source          && { acquisition_source: profile.source }),
        },
      },
    },
  };

  const res = await fetch(`${BASE_URL}/profiles/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (res.status === 201 || res.status === 200) {
    const json = await res.json();
    return json?.data?.id ?? null;
  }

  // 409 = profile already exists — extract ID from response
  if (res.status === 409) {
    const json = await res.json();
    const existingId = json?.errors?.[0]?.meta?.duplicate_profile_id ?? null;
    if (existingId) {
      // Patch existing profile with latest properties
      await fetch(`${BASE_URL}/profiles/${existingId}/`, {
        method: 'PATCH',
        headers: headers(apiKey),
        body: JSON.stringify({
          data: {
            type: 'profile',
            id: existingId,
            attributes: {
              first_name: profile.first_name ?? undefined,
              properties: {
                ...(profile.goggle_interest && { goggle_interest: profile.goggle_interest }),
                ...(profile.child_age       && { child_age: profile.child_age }),
              },
            },
          },
        }),
      });
      return existingId;
    }
  }

  console.error('[Klaviyo] upsertProfile failed', res.status, await res.text());
  return null;
}

// ── Subscribe a profile to an email list (with consent) ─────────────────────

export async function subscribeToList(
  apiKey: string,
  listId: string,
  email: string,
  source: string
): Promise<void> {
  const body = {
    data: {
      type: 'profile-subscription-bulk-create-job',
      attributes: {
        custom_source: source,
        profiles: {
          data: [
            {
              type: 'profile',
              attributes: {
                email,
                subscriptions: {
                  email: {
                    marketing: { consent: 'SUBSCRIBED' },
                  },
                },
              },
            },
          ],
        },
      },
      relationships: {
        list: { data: { type: 'list', id: listId } },
      },
    },
  };

  const res = await fetch(`${BASE_URL}/profile-subscription-bulk-create-jobs/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[Klaviyo] subscribeToList failed', res.status, await res.text());
  }
}

// ── Track a custom event ─────────────────────────────────────────────────────

export async function trackEvent(
  apiKey: string,
  event: {
    name: string;
    email: string;
    properties: Record<string, unknown>;
    value?: number;
  }
): Promise<void> {
  const body = {
    data: {
      type: 'event',
      attributes: {
        metric: {
          data: {
            type: 'metric',
            attributes: { name: event.name },
          },
        },
        profile: {
          data: {
            type: 'profile',
            attributes: { email: event.email },
          },
        },
        properties: event.properties,
        ...(event.value !== undefined && { value: event.value }),
        time: new Date().toISOString(),
      },
    },
  };

  const res = await fetch(`${BASE_URL}/events/`, {
    method: 'POST',
    headers: headers(apiKey),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error('[Klaviyo] trackEvent failed', event.name, res.status, await res.text());
  }
}
