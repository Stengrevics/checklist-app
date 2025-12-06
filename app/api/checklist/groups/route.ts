import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// GET – visas grupas
export async function GET() {
    const { data, error } = await supabase
        .from('checklist_groups')
        .select('*')
        .order('inserted_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST – jauna grupa
export async function POST(request: Request) {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
        return NextResponse.json(
            { error: 'name is required' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('checklist_groups')
        .insert({ name, description })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

// PATCH – labot esošo group
export async function PATCH(request: Request) {
    const body = await request.json();
    const { id, name, description } = body;

    if (!id) {
        return NextResponse.json(
            { error: 'id is required' },
            { status: 400 }
        );
    }

    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;

    const { data, error } = await supabase
        .from('checklist_groups')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE – dzēst group (un visus tās darbus/solis ar ON DELETE CASCADE)
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json(
            { error: 'id is required' },
            { status: 400 }
        );
    }

    const { error } = await supabase
        .from('checklist_groups')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
