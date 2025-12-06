'use client';

import React, { useEffect, useState } from 'react';

type Group = {
    id: string;
    name: string;
    description: string | null;
};

type JobTemplate = {
    id: string;
    group_id: string;
    car_model: string;
    job_name: string;
    recommended_minutes: number | null;
};

type StepTemplate = {
    id: string;
    job_id: string;
    title: string;
    description: string | null;
    torque_nm: number | null;
    image_url: string | null;
    order_index: number | null;
};

type StepRun = StepTemplate & {
    done: boolean;
};

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function ChecklistPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [jobs, setJobs] = useState<JobTemplate[]>([]);
    const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);
    const [steps, setSteps] = useState<StepRun[]>([]);

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    // Lielais galvenais taimeris
    const [mainSeconds, setMainSeconds] = useState(0);
    const [mainTimerRunning, setMainTimerRunning] = useState(false);
    const [manualMinutes, setManualMinutes] = useState<string>('');

    // Kalkulators
    const [hourlyRate, setHourlyRate] = useState<number>(30);
    const [hasRust, setHasRust] = useState<boolean>(false);
    const [hasExtraDifficulty, setHasExtraDifficulty] = useState<boolean>(false);

    // Edit mode
    const [editMode, setEditMode] = useState(false);
    const [savingError, setSavingError] = useState<string | null>(null);

    // jaunas grupas
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');

    // grupas labošanai
    const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;
    const [editGroupName, setEditGroupName] = useState('');
    const [editGroupDescription, setEditGroupDescription] = useState('');

    // jauns darbs
    const [newJobCarModel, setNewJobCarModel] = useState('');
    const [newJobName, setNewJobName] = useState('');
    const [newJobMinutes, setNewJobMinutes] = useState<number>(0);

    // darba labošanai
    const selectedJob = jobs.find(j => j.id === selectedJobId) || null;
    const [editJobCarModel, setEditJobCarModel] = useState('');
    const [editJobName, setEditJobName] = useState('');
    const [editJobMinutes, setEditJobMinutes] = useState<number>(0);

    // jauns solis
    const [newStepTitle, setNewStepTitle] = useState('');
    const [newStepDescription, setNewStepDescription] = useState('');
    const [newStepTorque, setNewStepTorque] = useState<number | ''>('');
    const [newStepOrder, setNewStepOrder] = useState<number | ''>('');

    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [loadingSteps, setLoadingSteps] = useState(false);

    const effectiveSeconds = mainSeconds;
    const totalHours = effectiveSeconds / 3600;
    const basePrice = Number.isFinite(hourlyRate) ? hourlyRate * totalHours : 0;
    const extraPercent =
        (hasRust ? 0.25 : 0) + (hasExtraDifficulty ? 0.15 : 0);
    const finalPrice = basePrice * (1 + extraPercent);

    const effectiveJobLabel = selectedJob
        ? `${selectedJob.car_model} – ${selectedJob.job_name}`
        : 'Nav izvēlēts darbs';

    // sync edit laukus, kad izvēlas group/job
    useEffect(() => {
        if (selectedGroup) {
            setEditGroupName(selectedGroup.name);
            setEditGroupDescription(selectedGroup.description || '');
        } else {
            setEditGroupName('');
            setEditGroupDescription('');
        }
    }, [selectedGroup]);

    useEffect(() => {
        if (selectedJob) {
            setEditJobCarModel(selectedJob.car_model);
            setEditJobName(selectedJob.job_name);
            setEditJobMinutes(selectedJob.recommended_minutes || 0);
        } else {
            setEditJobCarModel('');
            setEditJobName('');
            setEditJobMinutes(0);
        }
    }, [selectedJob]);

    // Lielais taimeris
    useEffect(() => {
        if (!mainTimerRunning) return;
        const id = setInterval(() => {
            setMainSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(id);
    }, [mainTimerRunning]);

    function resetRunState() {
        setSteps(prev => prev.map(s => ({ ...s, done: false })));
        setMainSeconds(0);
        setMainTimerRunning(false);
        setHasRust(false);
        setHasExtraDifficulty(false);
    }

    function handleApplyManualMinutes() {
        const val = Number(manualMinutes);
        if (Number.isNaN(val) || val < 0) {
            setMainSeconds(0);
            return;
        }
        setMainSeconds(Math.round(val * 60));
    }

    function toggleStepDone(id: string) {
        setSteps(prev =>
            prev.map(s => (s.id === id ? { ...s, done: !s.done } : s))
        );
    }

    // LOAD GROUPS
    useEffect(() => {
        const loadGroups = async () => {
            try {
                setLoadingGroups(true);
                const res = await fetch('/api/checklist/groups');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setGroups(data);
                    if (data.length > 0 && !selectedGroupId) {
                        setSelectedGroupId(data[0].id);
                    }
                }
            } catch (e) {
                console.error('Error loading groups', e);
            } finally {
                setLoadingGroups(false);
            }
        };

        loadGroups();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // LOAD JOBS when group changes
    useEffect(() => {
        if (!selectedGroupId) {
            setJobs([]);
            setSelectedJobId(null);
            return;
        }

        const loadJobs = async () => {
            try {
                setLoadingJobs(true);
                const res = await fetch(
                    `/api/checklist/jobs?group_id=${selectedGroupId}`
                );
                const data = await res.json();
                if (Array.isArray(data)) {
                    setJobs(data);
                    setSelectedJobId(null);
                    setStepTemplates([]);
                    setSteps([]);
                    resetRunState();
                }
            } catch (e) {
                console.error('Error loading jobs', e);
            } finally {
                setLoadingJobs(false);
            }
        };

        loadJobs();
    }, [selectedGroupId]);

    // LOAD STEPS when job changes
    useEffect(() => {
        if (!selectedJobId) {
            setStepTemplates([]);
            setSteps([]);
            resetRunState();
            return;
        }

        const loadSteps = async () => {
            try {
                setLoadingSteps(true);
                const res = await fetch(
                    `/api/checklist/steps?job_id=${selectedJobId}`
                );
                const templates: StepTemplate[] = await res.json();
                setStepTemplates(templates);

                const run: StepRun[] = templates
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map(t => ({
                        ...t,
                        done: false,
                    }));

                resetRunState();
                setSteps(run);
            } catch (e) {
                console.error('Error loading steps', e);
            } finally {
                setLoadingSteps(false);
            }
        };

        loadSteps();
    }, [selectedJobId]);

    // GROUP – izveide
    async function handleCreateGroup() {
        if (!newGroupName.trim()) return;
        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/groups', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newGroupName.trim(),
                    description: newGroupDescription || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                setSavingError(data.error || 'Neizdevās saglabāt grupu');
                return;
            }
            setGroups(prev => [...prev, data]);
            setSelectedGroupId(data.id);
            setNewGroupName('');
            setNewGroupDescription('');
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // GROUP – labošana
    async function handleUpdateGroup() {
        if (!selectedGroupId) return;
        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/groups', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedGroupId,
                    name: editGroupName.trim(),
                    description: editGroupDescription || null,
                }),
            });
            const data: Group = await res.json();
            if (!res.ok) {
                setSavingError((data as any).error || 'Neizdevās labot grupu');
                return;
            }

            setGroups(prev =>
                prev.map(g => (g.id === data.id ? data : g))
            );
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // GROUP – dzēšana
    async function handleDeleteGroup() {
        if (!selectedGroupId) return;
        const confirmDelete = window.confirm(
            'Dzēst šo galveno čeklisti (un visus darbus/soļus)?'
        );
        if (!confirmDelete) return;

        try {
            setSavingError(null);
            const res = await fetch(
                `/api/checklist/groups?id=${selectedGroupId}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (!res.ok) {
                setSavingError(data.error || 'Neizdevās dzēst grupu');
                return;
            }
            setGroups(prev => prev.filter(g => g.id !== selectedGroupId));
            setSelectedGroupId(null);
            setJobs([]);
            setSelectedJobId(null);
            setStepTemplates([]);
            setSteps([]);
            resetRunState();
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // JOB – izveide
    async function handleCreateJob() {
        if (!selectedGroupId) {
            setSavingError('Nav izvēlēta galvenā čekliste (group)');
            return;
        }
        if (!newJobCarModel.trim() || !newJobName.trim()) return;

        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    group_id: selectedGroupId,
                    car_model: newJobCarModel.trim(),
                    job_name: newJobName.trim(),
                    recommended_minutes: newJobMinutes || 0,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                setSavingError(data.error || 'Neizdevās saglabāt jobu');
                return;
            }

            setJobs(prev => [...prev, data]);
            setSelectedJobId(data.id);
            setNewJobCarModel('');
            setNewJobName('');
            setNewJobMinutes(0);
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // JOB – labošanai
    async function handleUpdateJob() {
        if (!selectedJobId) return;

        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/jobs', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: selectedJobId,
                    car_model: editJobCarModel.trim(),
                    job_name: editJobName.trim(),
                    recommended_minutes: editJobMinutes || 0,
                }),
            });
            const data: JobTemplate = await res.json();
            if (!res.ok) {
                setSavingError((data as any).error || 'Neizdevās labot jobu');
                return;
            }

            setJobs(prev =>
                prev.map(j => (j.id === data.id ? data : j))
            );
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // JOB – dzēšana
    async function handleDeleteJob() {
        if (!selectedJobId) return;
        const confirmDelete = window.confirm(
            'Dzēst šo konkrēto darbu (job) un tā soļus?'
        );
        if (!confirmDelete) return;

        try {
            setSavingError(null);
            const res = await fetch(
                `/api/checklist/jobs?id=${selectedJobId}`,
                { method: 'DELETE' }
            );
            const data = await res.json();
            if (!res.ok) {
                setSavingError(data.error || 'Neizdevās dzēst jobu');
                return;
            }

            setJobs(prev => prev.filter(j => j.id !== selectedJobId));
            setSelectedJobId(null);
            setStepTemplates([]);
            setSteps([]);
            resetRunState();
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // STEP – izveide
    async function handleCreateStep() {
        if (!selectedJobId) {
            setSavingError('Nav izvēlēts konkrēts darbs (job)');
            return;
        }
        if (!newStepTitle.trim()) return;

        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/steps', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: selectedJobId,
                    title: newStepTitle.trim(),
                    description: newStepDescription || null,
                    torque_nm: newStepTorque === '' ? null : Number(newStepTorque),
                    image_url: null,
                    order_index:
                        newStepOrder === '' ? stepTemplates.length : Number(newStepOrder),
                }),
            });

            const data: StepTemplate = await res.json();
            if (!res.ok) {
                setSavingError((data as any).error || 'Neizdevās saglabāt soli');
                return;
            }

            setStepTemplates(prev => [...prev, data]);
            setSteps(prev =>
                [...prev, { ...data, done: false }].sort(
                    (a, b) => (a.order_index || 0) - (b.order_index || 0)
                )
            );

            setNewStepTitle('');
            setNewStepDescription('');
            setNewStepTorque('');
            setNewStepOrder('');
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // STEP – secība
    async function handleUpdateStepOrder(id: string, newOrder: number) {
        try {
            setSavingError(null);
            const res = await fetch('/api/checklist/steps', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, order_index: newOrder }),
            });
            const data: StepTemplate = await res.json();
            if (!res.ok) {
                setSavingError((data as any).error || 'Neizdevās atjaunināt soli');
                return;
            }

            setStepTemplates(prev =>
                prev.map(s => (s.id === id ? { ...s, order_index: data.order_index } : s))
            );

            setSteps(prev =>
                prev
                    .map(s =>
                        s.id === id ? { ...s, order_index: data.order_index } : s
                    )
                    .sort(
                        (a, b) => (a.order_index || 0) - (b.order_index || 0)
                    )
            );
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // STEP – dzēšana
    async function handleDeleteStepTemplate(id: string) {
        try {
            setSavingError(null);
            const res = await fetch(`/api/checklist/steps?id=${id}`, {
                method: 'DELETE',
            });
            const data = await res.json();
            if (!res.ok) {
                setSavingError(data.error || 'Neizdevās dzēst soli');
                return;
            }

            setStepTemplates(prev => prev.filter(s => s.id !== id));
            setSteps(prev => prev.filter(s => s.id !== id));
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            {/* Sticky galvenais taimeris */}
            <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/95 backdrop-blur">
                <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-3 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-1">
                        <p className="text-[11px] uppercase text-slate-400">
                            Galvenais darba taimeris
                        </p>
                        <div className="flex items-end gap-4">
                            <span className="font-mono text-4xl md:text-5xl">
                                {formatTime(mainSeconds)}
                            </span>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMainTimerRunning(true)}
                                    className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-emerald-500"
                                >
                                    Start
                                </button>
                                <button
                                    onClick={() => setMainTimerRunning(false)}
                                    className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide hover:bg-slate-800"
                                >
                                    Pauze
                                </button>
                                <button
                                    onClick={resetRunState}
                                    className="rounded-xl border border-red-800 bg-red-950 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-red-100 hover:bg-red-900"
                                >
                                    Stop / Reset
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                            <span>Kopējais laiks cenai: {formatTime(effectiveSeconds)}</span>
                            <span>•</span>
                            <span>
                                Stundas likme: {hourlyRate.toFixed(2)} €/h, kopā{' '}
                                {finalPrice.toFixed(2)} €
                            </span>
                        </div>
                    </div>

                    {/* Manuālā laika labošana + edit režīms */}
                    <div className="flex flex-col items-end gap-2">
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                value={manualMinutes}
                                onChange={e => setManualMinutes(e.target.value)}
                                className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder={String(Math.round(mainSeconds / 60))}
                            />
                            <button
                                onClick={handleApplyManualMinutes}
                                className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] hover:bg-slate-800"
                            >
                                Uzlikt minūtes
                            </button>
                        </div>
                        <button
                            onClick={() => setEditMode(prev => !prev)}
                            className="rounded-md border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide hover:bg-slate-800"
                        >
                            {editMode ? 'Beigt rediģēt šablonus' : 'Rediģēt šablonus'}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-6xl px-4 py-6 space-y-6">
                {/* Kļūdu ziņa */}
                {savingError && (
                    <p className="text-xs text-red-400">
                        Saglabāšanas kļūda: {savingError}
                    </p>
                )}

                {/* Grupas un darbi */}
                <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <p className="text-xs uppercase text-slate-400">
                                Galvenā čekliste (group)
                            </p>
                            <select
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 md:w-72"
                                value={selectedGroupId ?? ''}
                                onChange={e =>
                                    setSelectedGroupId(
                                        e.target.value ? e.target.value : null
                                    )
                                }
                            >
                                <option value="">
                                    {loadingGroups
                                        ? 'Lādē grupas...'
                                        : 'Nav izvēlēts / tukšs'}
                                </option>
                                {groups.map(g => (
                                    <option key={g.id} value={g.id}>
                                        {g.name}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-slate-500">
                                Izvēlētais darbs: {effectiveJobLabel}
                            </p>
                            {selectedJob && (
                                <p className="text-xs text-slate-500">
                                    Ieteicamais laiks: {selectedJob.recommended_minutes} min
                                </p>
                            )}
                        </div>

                        <div className="space-y-2">
                            <p className="text-xs uppercase text-slate-400">
                                Auto modelis + darbs
                            </p>
                            <select
                                className="w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 md:w-80"
                                value={selectedJobId ?? ''}
                                onChange={e =>
                                    setSelectedJobId(
                                        e.target.value ? e.target.value : null
                                    )
                                }
                            >
                                <option value="">
                                    {loadingJobs ? 'Lādē darbus...' : 'Nav izvēlēts darbs'}
                                </option>
                                {jobs.map(job => (
                                    <option key={job.id} value={job.id}>
                                        {job.car_model} – {job.job_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                </section>

                {/* EDIT režīms – grupas, darbi, soļi */}
                {editMode && (
                    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        {/* Grupas edit + create */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Labot / dzēst izvēlēto grupu
                                </h3>
                                {!selectedGroup && (
                                    <p className="text-[11px] text-slate-500">
                                        Vispirms izvēlies grupu augšā.
                                    </p>
                                )}
                                {selectedGroup && (
                                    <>
                                        <input
                                            type="text"
                                            value={editGroupName}
                                            onChange={e => setEditGroupName(e.target.value)}
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Nosaukums – Bremzes..."
                                        />
                                        <input
                                            type="text"
                                            value={editGroupDescription}
                                            onChange={e =>
                                                setEditGroupDescription(e.target.value)
                                            }
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Apraksts (nav obligāts)"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateGroup}
                                                className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500"
                                            >
                                                Saglabāt grupu
                                            </button>
                                            <button
                                                onClick={handleDeleteGroup}
                                                className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-900"
                                            >
                                                Dzēst grupu
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Jauna grupa
                                </h3>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    placeholder="Nosaukums – Bremzes, Eļļa..."
                                />
                                <input
                                    type="text"
                                    value={newGroupDescription}
                                    onChange={e => setNewGroupDescription(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    placeholder="Apraksts (nav obligāts)"
                                />
                                <button
                                    onClick={handleCreateGroup}
                                    className="mt-1 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500"
                                >
                                    Pievienot grupu
                                </button>
                            </div>
                        </div>

                        {/* Darba (job) edit + create */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Labot / dzēst izvēlēto jobu
                                </h3>
                                {!selectedJob && (
                                    <p className="text-[11px] text-slate-500">
                                        Vispirms izvēlies jobu augšā.
                                    </p>
                                )}
                                {selectedJob && (
                                    <>
                                        <input
                                            type="text"
                                            value={editJobCarModel}
                                            onChange={e => setEditJobCarModel(e.target.value)}
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Auto modelis"
                                        />
                                        <input
                                            type="text"
                                            value={editJobName}
                                            onChange={e => setEditJobName(e.target.value)}
                                            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Darba nosaukums"
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={editJobMinutes}
                                                onChange={e =>
                                                    setEditJobMinutes(Number(e.target.value) || 0)
                                                }
                                                className="w-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                placeholder="min"
                                            />
                                            <span className="text-xs text-slate-400">min</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleUpdateJob}
                                                className="rounded-md bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500"
                                            >
                                                Saglabāt jobu
                                            </button>
                                            <button
                                                onClick={handleDeleteJob}
                                                className="rounded-md border border-red-800 bg-red-950 px-3 py-2 text-xs font-medium text-red-100 hover:bg-red-900"
                                            >
                                                Dzēst jobu
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Jauns job šai grupai
                                </h3>
                                <input
                                    type="text"
                                    value={newJobCarModel}
                                    onChange={e => setNewJobCarModel(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    placeholder="Auto modelis"
                                />
                                <input
                                    type="text"
                                    value={newJobName}
                                    onChange={e => setNewJobName(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    placeholder="Darba nosaukums"
                                />
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={newJobMinutes}
                                        onChange={e =>
                                            setNewJobMinutes(Number(e.target.value) || 0)
                                        }
                                        className="w-24 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                        placeholder="min"
                                    />
                                    <span className="text-xs text-slate-400">min</span>
                                </div>
                                <button
                                    onClick={handleCreateJob}
                                    className="mt-1 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500"
                                >
                                    Pievienot jobu
                                </button>
                            </div>
                        </div>

                        {/* Soļi */}
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold uppercase text-slate-300">
                                Soļi šim jobam
                            </h3>
                            {!selectedJob && (
                                <p className="text-[11px] text-slate-500">
                                    Vispirms izvēlies jobu.
                                </p>
                            )}

                            {selectedJob && (
                                <>
                                    <div className="grid gap-2 md:grid-cols-2">
                                        <input
                                            type="text"
                                            value={newStepTitle}
                                            onChange={e => setNewStepTitle(e.target.value)}
                                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Soļa nosaukums"
                                        />
                                        <input
                                            type="text"
                                            value={newStepDescription}
                                            onChange={e =>
                                                setNewStepDescription(e.target.value)
                                            }
                                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Soļa apraksts (nav obligāts)"
                                        />
                                        <input
                                            type="number"
                                            value={newStepTorque}
                                            onChange={e =>
                                                setNewStepTorque(
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(e.target.value)
                                                )
                                            }
                                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Nm (nav obligāts)"
                                        />
                                        <input
                                            type="number"
                                            value={newStepOrder}
                                            onChange={e =>
                                                setNewStepOrder(
                                                    e.target.value === ''
                                                        ? ''
                                                        : Number(e.target.value)
                                                )
                                            }
                                            className="rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Secība (0,1,2...)"
                                        />
                                    </div>
                                    <button
                                        onClick={handleCreateStep}
                                        className="mt-1 rounded-md bg-sky-600 px-3 py-2 text-xs font-medium hover:bg-sky-500"
                                    >
                                        Pievienot soli
                                    </button>

                                    {stepTemplates.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-[11px] text-slate-500">
                                                Esošie soļi (secība + dzēšana):
                                            </p>
                                            {[...stepTemplates]
                                                .sort(
                                                    (a, b) =>
                                                        (a.order_index || 0) -
                                                        (b.order_index || 0)
                                                )
                                                .map(step => (
                                                    <div
                                                        key={step.id}
                                                        className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"
                                                    >
                                                        <input
                                                            type="number"
                                                            value={step.order_index ?? 0}
                                                            onChange={e =>
                                                                handleUpdateStepOrder(
                                                                    step.id,
                                                                    Number(e.target.value) || 0
                                                                )
                                                            }
                                                            className="w-16 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                        />
                                                        <div className="flex-1 text-xs">
                                                            <div className="font-medium">
                                                                {step.title}
                                                            </div>
                                                            {step.description && (
                                                                <div className="text-slate-400">
                                                                    {step.description}
                                                                </div>
                                                            )}
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                handleDeleteStepTemplate(step.id)
                                                            }
                                                            className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-[11px] text-red-100 hover:bg-red-900"
                                                        >
                                                            Dzēst
                                                        </button>
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </section>
                )}

                {/* Piemaksas un kalkulators */}
                <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Piemaksas par sarežģījumiem
                        </h3>
                        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={hasRust}
                                onChange={e => setHasRust(e.target.checked)}
                                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                            />
                            <span>Sarūsējušas skrūves (+25 %)</span>
                        </label>
                        <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={hasExtraDifficulty}
                                onChange={e =>
                                    setHasExtraDifficulty(e.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                            />
                            <span>Papildu aizķeršanās (+15 %)</span>
                        </label>
                        <p className="text-xs text-slate-400">
                            Bāzes cena: {basePrice.toFixed(2)} €. Piemaksas kopā:{' '}
                            {(extraPercent * 100).toFixed(0)} %.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Darba kalkulators
                        </h3>
                        <label className="block text-xs text-slate-400 uppercase">
                            Stundas likme (€ / h)
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            value={hourlyRate}
                            onChange={e =>
                                setHourlyRate(parseFloat(e.target.value) || 0)
                            }
                            min={0}
                        />
                        <p className="text-xs text-slate-400">
                            Kopējais laiks: {totalHours.toFixed(2)} h
                        </p>
                        <p className="text-xs text-slate-400">
                            Cena ar piemaksām: {finalPrice.toFixed(2)} €
                        </p>
                    </div>
                </section>

                {/* Soļi ar checkboxiem */}
                <section className="space-y-3">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                        Soļi remontam
                    </h2>

                    {loadingSteps && (
                        <p className="text-xs text-slate-400">Lādē soļus...</p>
                    )}

                    {steps.length === 0 && !loadingSteps && (
                        <p className="text-xs text-slate-400">
                            Šobrīd nav neviens solis. Šabloni tiek veidoti rediģēšanas
                            režīmā un saglabāti Supabase.
                        </p>
                    )}

                    <div className="space-y-3">
                        {steps.map(step => (
                            <div
                                key={step.id}
                                className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4"
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div
                                        className="flex cursor-pointer items-start gap-2 select-none"
                                        onClick={() => toggleStepDone(step.id)}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={step.done}
                                            onClick={e => e.stopPropagation()}
                                            onChange={() => toggleStepDone(step.id)}
                                            className="mt-1 h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                                        />
                                        <div className="space-y-1">
                                            <h3 className="text-sm font-semibold">
                                                {step.title}
                                            </h3>
                                            {step.description && (
                                                <p className="text-sm text-slate-400">
                                                    {step.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {typeof step.torque_nm === 'number' && (
                                        <p className="text-[11px] text-slate-400">
                                            Nm: {step.torque_nm}
                                        </p>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}
