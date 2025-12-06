import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const groupId = searchParams.get('group_id');

  if (!groupId) {
    return NextResponse.json(
      { error: 'group_id required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('checklist_tools')
    .select('*')
    .eq('group_id', groupId)
    .order('inserted_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { group_id, name, description } = body;

  if (!group_id || !name) {
    return NextResponse.json(
      { error: 'group_id and name required' },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from('checklist_tools')
    .insert({ group_id, name, description })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json(
      { error: 'id required' },
      { status: 400 }
    );
  }

  const { error } = await supabase
    .from('checklist_tools')
    .delete()
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
