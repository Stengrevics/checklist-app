import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabaseClient';

// GET /api/checklist/steps?job_id=...
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('job_id');

    if (!jobId) {
        return NextResponse.json({ error: 'job_id required' }, { status: 400 });
    }

    const { data, error } = await supabase
        .from('checklist_steps')
        .select('*')
        .eq('job_id', jobId)
        .order('order_index', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST – izveidot jaunu soli
export async function POST(request: Request) {
    const body = await request.json();
    const { job_id, title, description, torque_nm, image_url, order_index } =
        body;

    if (!job_id || !title) {
        return NextResponse.json(
            { error: 'job_id and title are required' },
            { status: 400 }
        );
    }

    const { data, error } = await supabase
        .from('checklist_steps')
        .insert({
            job_id,
            title,
            description,
            torque_nm,
            image_url,
            order_index: order_index ?? 0,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}

// PATCH – atjaunināt soli (secību, nosaukumu utt.)
export async function PATCH(request: Request) {
    const body = await request.json();
    const { id, title, description, torque_nm, image_url, order_index } = body;

    if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updates: any = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (torque_nm !== undefined) updates.torque_nm = torque_nm;
    if (image_url !== undefined) updates.image_url = image_url;
    if (order_index !== undefined) updates.order_index = order_index;

    const { data, error } = await supabase
        .from('checklist_steps')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/checklist/steps?id=...
export async function DELETE(request: Request) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
        return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const { error } = await supabase
        .from('checklist_steps')
        .delete()
        .eq('id', id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
