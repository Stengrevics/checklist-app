import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// GET /api/checklist/jobs?group_id=...
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
        .from('checklist_jobs')
        .select('*')
        .eq('group_id', groupId)
        .order('inserted_at', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST – jauns darbs (auto modelis + darba nosaukums)
export async function POST(request: Request) {
    const body = await request.json();
    const { group_id, car_model, job_name, recommended_minutes } = body;

    if (!group_id || !car_model || !job_name) {
        return NextResponse.json(
            { error: 'group_id, car_model and job_name are required' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('checklist_jobs')
        .insert({
            group_id,
            car_model,
            job_name,
            recommended_minutes: recommended_minutes ?? 0,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

// PATCH – labot esošu job (auto modeli, darba nosaukumu, ieteicamo laiku)
export async function PATCH(request: Request) {
    const body = await request.json();
    const { id, car_model, job_name, recommended_minutes } = body;

    if (!id) {
        return NextResponse.json(
            { error: 'id is required' },
            { status: 400 }
        );
    }

    const updates: any = {};
    if (car_model !== undefined) updates.car_model = car_model;
    if (job_name !== undefined) updates.job_name = job_name;
    if (recommended_minutes !== undefined)
        updates.recommended_minutes = recommended_minutes;

    const { data, error } = await supabase
        .from('checklist_jobs')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/checklist/jobs?id=...
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
        .from('checklist_jobs')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
