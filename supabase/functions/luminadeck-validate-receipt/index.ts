/**
 * Supabase Edge Function: luminadeck-validate-receipt
 *
 * Validates Apple StoreKit 2 receipts for LuminaDeck Pro purchases.
 * Called by the mobile app after a successful IAP transaction.
 *
 * POST /functions/v1/luminadeck-validate-receipt
 * Body: { transactionId: string, environment: "production" | "sandbox" }
 * Auth: Bearer token (Supabase auth JWT)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APPLE_STOREKIT_PROD_URL = 'https://api.storekit.itunes.apple.com/inApps/v1/transactions/';
const APPLE_STOREKIT_SANDBOX_URL = 'https://api.storekit-server.itunes.apple.com/inApps/v1/transactions/';

const LUMINADECK_PRO_PRODUCT_ID = 'com.luminadeck.pro';

Deno.serve(async (req: Request) => {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'authorization, content-type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    // Verify auth
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Get the user from their JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
    }

    // Parse request body
    const { transactionId, environment = 'production' } = await req.json();
    if (!transactionId) {
      return new Response(JSON.stringify({ error: 'Missing transactionId' }), { status: 400 });
    }

    // Validate with Apple StoreKit 2 API
    const appleUrl = environment === 'sandbox'
      ? APPLE_STOREKIT_SANDBOX_URL
      : APPLE_STOREKIT_PROD_URL;

    // NOTE: In production, this needs the App Store Server API key
    // configured as a Supabase secret (APPLE_STOREKIT_API_KEY)
    const apiKey = Deno.env.get('APPLE_STOREKIT_API_KEY');

    let isValid = false;
    let productId = '';

    if (apiKey) {
      // Real validation against Apple
      const response = await fetch(`${appleUrl}${transactionId}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        productId = data.productId ?? '';
        isValid = productId === LUMINADECK_PRO_PRODUCT_ID;
      }
    } else {
      // Development mode: accept sandbox transactions
      if (environment === 'sandbox') {
        isValid = true;
        productId = LUMINADECK_PRO_PRODUCT_ID;
        console.warn('DEV MODE: Accepting sandbox receipt without Apple validation');
      }
    }

    // Hash the transaction ID for logging (don't store raw)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(transactionId));
    const receiptHash = Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Ensure user exists in luminadeck_users
    const { data: existingUser } = await supabase
      .from('luminadeck_users')
      .select('id')
      .eq('auth_id', user.id)
      .single();

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
    } else {
      const { data: newUser, error: insertError } = await supabase
        .from('luminadeck_users')
        .insert({ auth_id: user.id, email: user.email })
        .select('id')
        .single();

      if (insertError || !newUser) {
        return new Response(JSON.stringify({ error: 'Failed to create user record' }), { status: 500 });
      }
      userId = newUser.id;
    }

    // Log the validation
    await supabase.from('luminadeck_receipt_validations').insert({
      user_id: userId,
      receipt_hash: receiptHash,
      product_id: productId || LUMINADECK_PRO_PRODUCT_ID,
      is_valid: isValid,
      validation_source: 'apple_storekit2',
      environment,
    });

    if (isValid) {
      // Grant Pro status
      await supabase
        .from('luminadeck_users')
        .update({
          is_pro: true,
          pro_purchased_at: new Date().toISOString(),
          pro_source: 'apple_iap',
        })
        .eq('id', userId);

      return new Response(JSON.stringify({
        valid: true,
        isPro: true,
        message: 'Pro upgrade activated',
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({
      valid: false,
      isPro: false,
      message: 'Receipt validation failed',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Receipt validation error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
});
