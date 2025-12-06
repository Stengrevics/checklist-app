import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('group_id');

    let query = supabase
        .from('checklist_jobs')
        .select('*')
        .order('inserted_at', { ascending: true });

    if (groupId) {
        query = query.eq('group_id', groupId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

export async function POST(request: Request) {
    const body = await request.json();
    const { group_id, car_model, job_name, recommended_minutes } = body;

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
