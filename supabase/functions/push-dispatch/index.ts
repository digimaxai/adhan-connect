import { createClient } from 'npm:@supabase/supabase-js@2';

type ClaimedDelivery = {
  delivery_id: string;
  device_id: string;
  expo_push_token: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  notification_kind: string;
  attempt_count: number;
};

type DeliveryResult = {
  deliveryId: string;
  status: 'sent' | 'delivered' | 'retry' | 'failed';
  ticketId?: string;
  receipt?: unknown;
  error?: string;
  retryAfterSeconds?: number;
  deactivateDevice?: boolean;
};

const EXPO_SEND_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';
const EXPO_REQUEST_TIMEOUT_MS = 10_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}.`);
  return value;
}

function expoHeaders() {
  const accessToken = Deno.env.get('EXPO_ACCESS_TOKEN')?.trim();
  return {
    Accept: 'application/json',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), EXPO_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function isInvalidDevice(code: unknown) {
  return code === 'DeviceNotRegistered';
}

function retryDelaySeconds(attemptCount: number) {
  return Math.min(30 * 2 ** Math.max(0, attemptCount - 1), 1800);
}

async function isVerifiedServiceRoleJwt(
  supabase: ReturnType<typeof createClient>,
  authorization: string
) {
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return false;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    return !error && data?.claims?.role === 'service_role';
  } catch {
    return false;
  }
}

function notificationMessage(delivery: ClaimedDelivery) {
  const urgent = delivery.notification_kind === 'live_adhan' || delivery.notification_kind === 'muezzin_duty';
  return {
    to: delivery.expo_push_token,
    title: delivery.title,
    body: delivery.body,
    data: delivery.data ?? {},
    sound: 'default',
    priority: urgent ? 'high' : 'default',
    channelId: 'adhan-alerts',
    categoryId: delivery.notification_kind,
    ttl: delivery.notification_kind === 'live_adhan' ? 1200 : 3600,
  };
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const supabaseUrl = env('SUPABASE_URL');
    const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const appVariant = env('APP_VARIANT');
    if (appVariant !== 'staging' && appVariant !== 'production') {
      return json({ error: 'APP_VARIANT must be staging or production.' }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const authorization = request.headers.get('authorization') ?? '';
    const suppliedCronSecret = request.headers.get('x-cron-secret') ?? '';
    const { data: cronSecretValid, error: cronSecretError } = suppliedCronSecret
      ? await supabase.rpc('verify_notification_dispatch_secret_v1', {
          p_secret: suppliedCronSecret,
        })
      : { data: false, error: null };
    const authorized = authorization === `Bearer ${serviceRoleKey}` ||
      await isVerifiedServiceRoleJwt(supabase, authorization) ||
      (!cronSecretError && cronSecretValid === true);
    if (!authorized) return json({ error: 'Unauthorized.' }, 401);

    const requestPayload = await request.json().catch(() => ({})) as {
      configureSchedule?: boolean;
    };
    let scheduleJobId: number | null = null;
    if (requestPayload.configureSchedule === true) {
      const { data, error } = await supabase.rpc(
        'configure_notification_dispatch_schedule_v1',
        {
          p_function_url: `${supabaseUrl.replace(/\/$/, '')}/functions/v1/push-dispatch`,
          p_app_variant: appVariant,
        },
      );
      if (error) throw error;
      scheduleJobId = Number(data);
    }

    const { data: remindersCreated, error: reminderError } = await supabase.rpc(
      'enqueue_due_adhan_reminders_v1',
      { p_now: new Date().toISOString() },
    );
    if (reminderError) throw reminderError;

    const { data: deliveriesCreated, error: materializeError } = await supabase.rpc(
      'materialize_notification_deliveries_v1',
      { p_app_variant: appVariant, p_limit: 1000 },
    );
    if (materializeError) throw materializeError;

    const { data: claimedData, error: claimError } = await supabase.rpc(
      'claim_notification_deliveries_v1',
      { p_app_variant: appVariant, p_limit: 100 },
    );
    if (claimError) throw claimError;

    const claimed = (claimedData ?? []) as ClaimedDelivery[];
    const deliveryResults: DeliveryResult[] = [];

    if (claimed.length) {
      let response: Response;
      try {
        response = await fetchWithTimeout(EXPO_SEND_URL, {
          method: 'POST',
          headers: expoHeaders(),
          body: JSON.stringify(claimed.map(notificationMessage)),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Expo push request failed.';
        for (const delivery of claimed) {
          deliveryResults.push({
            deliveryId: delivery.delivery_id,
            status: delivery.attempt_count >= 5 ? 'failed' : 'retry',
            error: message,
            retryAfterSeconds: retryDelaySeconds(delivery.attempt_count),
          });
        }
        response = new Response(null, { status: 503 });
      }

      if (response.ok) {
        const payload = await response.json().catch(() => null) as {
          data?: Array<{ status?: string; id?: string; message?: string; details?: { error?: string } }>;
          errors?: Array<{ message?: string }>;
        } | null;
        const tickets = payload?.data ?? [];

        claimed.forEach((delivery, index) => {
          const ticket = tickets[index];
          if (ticket?.status === 'ok' && ticket.id) {
            deliveryResults.push({
              deliveryId: delivery.delivery_id,
              status: 'sent',
              ticketId: ticket.id,
            });
            return;
          }

          const errorCode = ticket?.details?.error;
          const errorMessage = ticket?.message ?? payload?.errors?.[0]?.message ?? 'Expo rejected the push ticket.';
          deliveryResults.push({
            deliveryId: delivery.delivery_id,
            status: isInvalidDevice(errorCode) || delivery.attempt_count >= 5 ? 'failed' : 'retry',
            error: `${errorCode ? `${errorCode}: ` : ''}${errorMessage}`,
            retryAfterSeconds: retryDelaySeconds(delivery.attempt_count),
            deactivateDevice: isInvalidDevice(errorCode),
          });
        });
      } else if (!deliveryResults.length) {
        const errorBody = await response.text().catch(() => '');
        for (const delivery of claimed) {
          deliveryResults.push({
            deliveryId: delivery.delivery_id,
            status: delivery.attempt_count >= 5 ? 'failed' : 'retry',
            error: `Expo push HTTP ${response.status}${errorBody ? `: ${errorBody.slice(0, 400)}` : ''}`,
            retryAfterSeconds: retryDelaySeconds(delivery.attempt_count),
          });
        }
      }
    }

    if (deliveryResults.length) {
      const { error } = await supabase.rpc('apply_notification_delivery_results_v1', {
        p_results: deliveryResults,
      });
      if (error) throw error;
    }

    // Receipts are intentionally checked on a later invocation. A successful
    // ticket only means Expo accepted the message, not that APNs/FCM accepted it.
    const receiptCutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const receiptFloor = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: receiptRows, error: receiptRowsError } = await supabase
      .from('notification_deliveries')
      .select('id, device_id, expo_ticket_id, attempt_count')
      .eq('status', 'sent')
      .not('expo_ticket_id', 'is', null)
      .lte('sent_at', receiptCutoff)
      .gte('sent_at', receiptFloor)
      .limit(300);
    if (receiptRowsError) throw receiptRowsError;

    const receiptResults: DeliveryResult[] = [];
    if (receiptRows?.length) {
      try {
        const receiptResponse = await fetchWithTimeout(EXPO_RECEIPTS_URL, {
          method: 'POST',
          headers: expoHeaders(),
          body: JSON.stringify({ ids: receiptRows.map((row) => row.expo_ticket_id) }),
        });
        const receiptPayload = await receiptResponse.json().catch(() => null) as {
          data?: Record<string, { status?: string; message?: string; details?: { error?: string } }>;
        } | null;

        if (receiptResponse.ok && receiptPayload?.data) {
          for (const row of receiptRows) {
            const receipt = receiptPayload.data[row.expo_ticket_id as string];
            if (!receipt) continue;
            if (receipt.status === 'ok') {
              receiptResults.push({
                deliveryId: row.id,
                status: 'delivered',
                receipt,
              });
              continue;
            }

            const errorCode = receipt.details?.error;
            const shouldRetry = !isInvalidDevice(errorCode) && row.attempt_count < 5;
            receiptResults.push({
              deliveryId: row.id,
              status: shouldRetry ? 'retry' : 'failed',
              receipt,
              error: `${errorCode ? `${errorCode}: ` : ''}${receipt.message ?? 'Push delivery failed.'}`,
              retryAfterSeconds: retryDelaySeconds(row.attempt_count),
              deactivateDevice: isInvalidDevice(errorCode),
            });
          }
        }
      } catch (error) {
        // A receipt lookup is observational. Keep accepted tickets in `sent`
        // so a later invocation can check them; never duplicate the push.
        console.warn('[push-dispatch] receipt lookup deferred', error);
      }
    }

    if (receiptResults.length) {
      const { error } = await supabase.rpc('apply_notification_delivery_results_v1', {
        p_results: receiptResults,
      });
      if (error) throw error;
    }

    return json({
      ok: true,
      appVariant,
      remindersCreated: Number(remindersCreated ?? 0),
      deliveriesCreated: Number(deliveriesCreated ?? 0),
      claimed: claimed.length,
      ticketsUpdated: deliveryResults.length,
      receiptsUpdated: receiptResults.length,
      scheduleJobId,
    });
  } catch (error) {
    console.error('[push-dispatch]', error);
    return json({ error: error instanceof Error ? error.message : 'Push dispatch failed.' }, 500);
  }
});
