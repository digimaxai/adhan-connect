import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RequestHandler } from 'expo-router/server';

type UserProfileRow = {
  id: string;
  email: string | null;
  role: string | null;
  display_name?: string | null;
  created_at?: string | null;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function deriveDisplayName(preferred?: string | null, existing?: string | null, email?: string | null) {
  const trimmedPreferred = preferred?.trim();
  if (trimmedPreferred) return trimmedPreferred;
  const trimmedExisting = existing?.trim();
  if (trimmedExisting) return trimmedExisting;
  const emailLocal = email?.split('@')[0]?.trim();
  if (emailLocal) return emailLocal;
  return 'Muezzin';
}

function isDuplicateError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) return false;
  const message = (error.message || '').toLowerCase();
  return error.code === '23505' || message.includes('duplicate');
}

async function findAuthUserByEmail(supabaseAdmin: SupabaseClient, email: string) {
  let page = 1;
  const perPage = 200;

  while (page <= 20) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) return { user: null, error };

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return { user: match, error: null };

    if (!data.nextPage || page >= data.lastPage) break;
    page = data.nextPage;
  }

  return { user: null, error: null };
}

export const POST: RequestHandler = async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE;

  if (!supabaseUrl) {
    return json({ error: 'Server is missing SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL.' }, 500);
  }
  if (!serviceRoleKey) {
    return json(
      {
        error:
          'Server is missing SUPABASE_SERVICE_ROLE. Create .env.local from .env.local.example, add the service-role key, then restart Expo.',
      },
      500
    );
  }

  const authHeader = request.headers.get('authorization') || '';
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!accessToken) {
    return json({ error: 'Missing bearer token.' }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return json({ error: 'Session is invalid or has expired.' }, 401);
  }

  const { data: requesterProfile, error: requesterError } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (requesterError || !requesterProfile) {
    return json({ error: 'Unable to verify your access level.' }, 403);
  }

  let body: { email?: string; displayName?: string; mosqueId?: string };
  try {
    body = (await request.json()) as { email?: string; displayName?: string; mosqueId?: string };
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400);
  }

  const email = body.email?.trim().toLowerCase() || '';
  const displayNameInput = body.displayName?.trim() || '';
  const mosqueId = body.mosqueId?.trim() || '';

  if (!email || !email.includes('@')) {
    return json({ error: 'A valid email is required.' }, 400);
  }
  if (!mosqueId) {
    return json({ error: 'A mosque id is required.' }, 400);
  }

  const isMainAdmin = requesterProfile.role === 'main_admin';
  let isLocalAdminForMosque = false;

  if (!isMainAdmin) {
    const { data: adminAssignment, error: adminAssignmentError } = await supabaseAdmin
      .from('mosque_admins')
      .select('id')
      .eq('mosque_id', mosqueId)
      .eq('user_id', requesterProfile.id)
      .maybeSingle();

    if (adminAssignmentError) {
      return json({ error: 'Unable to verify the requester mosque assignment.' }, 403);
    }

    isLocalAdminForMosque = !!adminAssignment;
  }

  if (!isMainAdmin && !isLocalAdminForMosque) {
    return json({ error: 'Only main admins and mosque local admins can invite muezzins.' }, 403);
  }

  const { data: mosque, error: mosqueError } = await supabaseAdmin
    .from('mosques')
    .select('id, name')
    .eq('id', mosqueId)
    .maybeSingle();

  if (mosqueError || !mosque) {
    return json({ error: 'The selected mosque could not be found.' }, 404);
  }

  let userProfile: UserProfileRow | null = null;
  let createdNewUser = false;
  let inviteSent = false;

  const { data: existingProfile, error: existingProfileError } = await supabaseAdmin
    .from('users')
    .select('id, email, role, display_name, created_at')
    .ilike('email', email)
    .maybeSingle();

  if (existingProfileError) {
    return json({ error: 'Unable to look up the requested user.' }, 500);
  }

  if (existingProfile) {
    userProfile = existingProfile;
  } else {
    const authLookup = await findAuthUserByEmail(supabaseAdmin, email);
    if (authLookup.error) {
      return json({ error: 'Unable to inspect the auth directory for this email.' }, 500);
    }

    if (authLookup.user) {
      userProfile = {
        id: authLookup.user.id,
        email: authLookup.user.email ?? email,
        role: 'user',
        display_name: deriveDisplayName(
          displayNameInput,
          (authLookup.user.user_metadata?.display_name as string | undefined) ?? null,
          authLookup.user.email ?? email
        ),
        created_at: authLookup.user.created_at ?? null,
      };
    } else {
      const { data: invitedUserData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        email,
        {
          data: {
            display_name: deriveDisplayName(displayNameInput, null, email),
          },
          redirectTo: new URL('/new-password', request.url).toString(),
        }
      );

      if (inviteError || !invitedUserData.user) {
        return json(
          {
            error: inviteError?.message || 'Unable to send the invite email right now.',
          },
          500
        );
      }

      createdNewUser = true;
      inviteSent = true;
      userProfile = {
        id: invitedUserData.user.id,
        email: invitedUserData.user.email ?? email,
        role: 'user',
        display_name: deriveDisplayName(
          displayNameInput,
          (invitedUserData.user.user_metadata?.display_name as string | undefined) ?? null,
          invitedUserData.user.email ?? email
        ),
        created_at: invitedUserData.user.created_at ?? null,
      };
    }
  }

  if (!userProfile) {
    return json({ error: 'Unable to prepare a muezzin account for this email.' }, 500);
  }

  const nextRole = userProfile.role === 'main_admin' ? 'main_admin' : 'user';
  const nextDisplayName = deriveDisplayName(displayNameInput, userProfile.display_name, userProfile.email ?? email);

  const { data: savedProfile, error: saveProfileError } = await supabaseAdmin
    .from('users')
    .upsert(
      {
        id: userProfile.id,
        email: userProfile.email ?? email,
        display_name: nextDisplayName,
        role: nextRole,
      },
      { onConflict: 'id' }
    )
    .select('id, email, role, display_name, created_at')
    .single();

  if (saveProfileError || !savedProfile) {
    return json({ error: 'Unable to persist the muezzin profile.' }, 500);
  }

  const { data: existingAssignment, error: existingAssignmentError } = await supabaseAdmin
    .from('muezzins')
    .select('user_id, is_active')
    .eq('mosque_id', mosqueId)
    .eq('user_id', savedProfile.id)
    .maybeSingle();

  if (existingAssignmentError) {
    return json({ error: 'Unable to inspect the current muezzin assignment.' }, 500);
  }

  let alreadyAssigned = false;
  if (existingAssignment) {
    alreadyAssigned = existingAssignment.is_active !== false;
    if (existingAssignment.is_active === false) {
      const { error: reactivateError } = await supabaseAdmin
        .from('muezzins')
        .update({ is_active: true })
        .eq('mosque_id', mosqueId)
        .eq('user_id', savedProfile.id);

      if (reactivateError) {
        return json({ error: 'Unable to reactivate this muezzin assignment.' }, 500);
      }
    }
  } else {
    const { error: assignmentError } = await supabaseAdmin
      .from('muezzins')
      .insert({ mosque_id: mosqueId, user_id: savedProfile.id, is_active: true });

    if (assignmentError && !isDuplicateError(assignmentError)) {
      return json(
        { error: assignmentError.message || 'Unable to assign this user as a muezzin for the selected mosque.' },
        assignmentError.code === 'P0001' ? 409 : 500
      );
    }
    alreadyAssigned = isDuplicateError(assignmentError);
  }

  return json({
    invited: inviteSent,
    created: createdNewUser,
    alreadyAssigned,
    mosque: {
      id: mosque.id,
      name: mosque.name,
    },
    user: savedProfile,
  });
};
