// lib/smartcar.js
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const SMARTCAR_CLIENT_ID = process.env.EXPO_PUBLIC_SMARTCAR_CLIENT_ID;
const REDIRECT_URI = 'otopair://smartcar/callback';

const SCOPES = [
  'read_vehicle_info',
  'read_odometer',
  'read_location',
  'read_tires',
  'read_engine_oil',
  'read_fuel',
  'read_battery',
];

export async function connectVehicle(userId) {
  // Build the Smartcar Connect URL
  const authUrl = new URL('https://connect.smartcar.com/oauth/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', SMARTCAR_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES.join(' '));
  authUrl.searchParams.set('mode', __DEV__ ? 'simulated' : 'live');
  authUrl.searchParams.set('state', userId); // Pass user ID to link vehicle later

  // Open in-app browser
  const result = await WebBrowser.openAuthSessionAsync(
    authUrl.toString(),
    REDIRECT_URI
  );

  if (result.type === 'success') {
    // Parse the callback URL to get the auth code
    const url = new URL(result.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    
    // Send code to your backend to exchange for tokens
    return await exchangeCodeForTokens(code, state);
  }
  
  return null;
}

async function exchangeCodeForTokens(code, userId) {
  // Call your Supabase Edge Function
  const response = await fetch('YOUR_SUPABASE_URL/functions/v1/smartcar-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, userId }),
  });
  return response.json();
}