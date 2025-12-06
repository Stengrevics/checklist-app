'use client';

import React, { useEffect, useState, ChangeEvent } from 'react';

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
    elapsedSeconds: number;
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
    // Supabase data
    const [groups, setGroups] = useState<Group[]>([]);
    const [jobs, setJobs] = useState<JobTemplate[]>([]);
    const [stepTemplates, setStepTemplates] = useState<StepTemplate[]>([]);

    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

    // Run-time state (konkrētais remonts)
    const [steps, setSteps] = useState<StepRun[]>([]);
    const [mainSeconds, setMainSeconds] = useState(0);
    const [mainTimerRunning, setMainTimerRunning] = useState(false);

    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [stepTimerRunning, setStepTimerRunning] = useState(false);

    // Kalkulators
    const [hourlyRate, setHourlyRate] = useState<number>(30);
    const [hasRust, setHasRust] = useState<boolean>(false);
    const [hasExtraDifficulty, setHasExtraDifficulty] = useState<boolean>(false);

    const [attachments, setAttachments] = useState<File[]>([]);
    const [editMode, setEditMode] = useState(false);

    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupDescription, setNewGroupDescription] = useState('');

    const [newJobCarModel, setNewJobCarModel] = useState('');
    const [newJobName, setNewJobName] = useState('');
    const [newJobMinutes, setNewJobMinutes] = useState<number>(0);

    const [newStepTitle, setNewStepTitle] = useState('');
    const [newStepDescription, setNewStepDescription] = useState('');
    const [newStepTorque, setNewStepTorque] = useState<number | ''>('');
    const [newStepOrder, setNewStepOrder] = useState<number | ''>('');

    const [loadingGroups, setLoadingGroups] = useState(false);
    const [loadingJobs, setLoadingJobs] = useState(false);
    const [loadingSteps, setLoadingSteps] = useState(false);
    const [savingError, setSavingError] = useState<string | null>(null);

    // PRICE
    const totalStepSeconds = steps.reduce((sum, s) => sum + s.elapsedSeconds, 0);
    const effectiveSeconds = mainSeconds > 0 ? mainSeconds : totalStepSeconds;
    const totalHours = effectiveSeconds / 3600;
    const basePrice = Number.isFinite(hourlyRate) ? hourlyRate * totalHours : 0;
    const extraPercent =
        (hasRust ? 0.25 : 0) + (hasExtraDifficulty ? 0.15 : 0);
    const finalPrice = basePrice * (1 + extraPercent);

    const selectedGroup = groups.find(g => g.id === selectedGroupId) || null;
    const selectedJob = jobs.find(j => j.id === selectedJobId) || null;

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
                const res = await fetch(`/api/checklist/jobs?group_id=${selectedGroupId}`);
                const data = await res.json();
                if (Array.isArray(data)) {
                    setJobs(data);
                    setSelectedJobId(null);
                    setSteps([]);
                    setStepTemplates([]);
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
                const res = await fetch(`/api/checklist/steps?job_id=${selectedJobId}`);
                const templates: StepTemplate[] = await res.json();
                setStepTemplates(templates);

                const run: StepRun[] = templates
                    .sort((a, b) => (a.order_index || 0) - (b.order_index || 0))
                    .map(t => ({
                        ...t,
                        elapsedSeconds: 0,
                        done: false,
                    }));

                setSteps(run);
                resetRunState();
            } catch (e) {
                console.error('Error loading steps', e);
            } finally {
                setLoadingSteps(false);
            }
        };

        loadSteps();
    }, [selectedJobId]);

    // main timer
    useEffect(() => {
        if (!mainTimerRunning) return;
        const id = setInterval(() => {
            setMainSeconds(prev => prev + 1);
        }, 1000);
        return () => clearInterval(id);
    }, [mainTimerRunning]);

    // step timer
    useEffect(() => {
        if (!stepTimerRunning || !activeStepId) return;
        const id = setInterval(() => {
            setSteps(prev =>
                prev.map(s =>
                    s.id === activeStepId
                        ? { ...s, elapsedSeconds: s.elapsedSeconds + 1 }
                        : s
                )
            );
        }, 1000);
        return () => clearInterval(id);
    }, [stepTimerRunning, activeStepId]);

    function resetRunState() {
        setMainSeconds(0);
        setMainTimerRunning(false);
        setActiveStepId(null);
        setStepTimerRunning(false);
        setAttachments([]);
        setHasRust(false);
        setHasExtraDifficulty(false);
    }

    // CREATE GROUP
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

    // CREATE JOB
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

    // CREATE STEP TEMPLATE FOR JOB
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
                setSavingError(data as any);
                return;
            }

            setStepTemplates(prev => [...prev, data]);
            setSteps(prev =>
                [...prev, { ...data, elapsedSeconds: 0, done: false }].sort(
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

    // UPDATE ORDER FOR EXISTING STEP
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

    // DELETE STEP TEMPLATE
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

            if (activeStepId === id) {
                setActiveStepId(null);
                setStepTimerRunning(false);
            }
        } catch (e: any) {
            setSavingError(e.message);
        }
    }

    // file input
    function handleFilesChange(e: ChangeEvent<HTMLInputElement>) {
        if (!e.target.files) return;
        setAttachments(Array.from(e.target.files));
    }

    function handleResetRun() {
        setSteps(prev =>
            prev.map(s => ({ ...s, done: false, elapsedSeconds: 0 }))
        );
        resetRunState();
    }

    function toggleStepDone(id: string) {
        setSteps(prev =>
            prev.map(s => (s.id === id ? { ...s, done: !s.done } : s))
        );
    }

    function handleStartStep(id: string) {
        setActiveStepId(id);
        setStepTimerRunning(true);
    }

    function handlePauseStep() {
        setStepTimerRunning(false);
    }

    const effectiveJobLabel = selectedJob
        ? `${selectedJob.car_model} – ${selectedJob.job_name}`
        : 'Nav izvēlēts darbs';

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
                {/* HEADER */}
                <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <div className="text-xs uppercase text-slate-400">
                                Galvenā čekliste (group) – piemēram, Bremzes
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <select
                                    className="w-full sm:w-64 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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
                                <button
                                    onClick={() => setEditMode(prev => !prev)}
                                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium uppercase tracking-wide hover:bg-slate-800"
                                >
                                    {editMode ? 'Beigt rediģēt šablonus' : 'Rediģēt šablonus'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <p className="text-xs text-slate-400">
                                Izvēlētais darbs: {effectiveJobLabel}
                            </p>
                            {selectedJob && (
                                <p className="text-xs text-slate-500">
                                    Ieteicamais laiks: {selectedJob.recommended_minutes} min
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-col items-end gap-3">
                        <div className="text-right">
                            <p className="text-[10px] uppercase text-slate-400">
                                Galvenais laiks (visa darba)
                            </p>
                            <p className="font-mono text-3xl tracking-tight">
                                {formatTime(mainSeconds)}
                            </p>
                            <p className="text-[11px] text-slate-500">
                                Soļu summa: {formatTime(totalStepSeconds)}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setMainTimerRunning(prev => !prev)}
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium hover:bg-emerald-500"
                            >
                                {mainTimerRunning ? 'Pauze galvenajam' : 'Startēt galveno'}
                            </button>
                            <button
                                onClick={handleResetRun}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium hover:bg-slate-800"
                            >
                                Jauns remonts (reset)
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-xs text-slate-400 uppercase">
                                    Kopējais laiks cenai
                                </p>
                                <p className="font-mono text-lg">
                                    {formatTime(effectiveSeconds)}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs text-slate-400 uppercase">
                                    Kopējā summa (darbs)
                                </p>
                                <p className="text-2xl font-semibold tracking-tight">
                                    {finalPrice.toFixed(2)} €
                                </p>
                            </div>
                        </div>
                    </div>
                </header>

                {savingError && (
                    <p className="text-xs text-red-400">
                        Saglabāšanas kļūda: {savingError}
                    </p>
                )}

                {/* TEMPLATE EDIT MODE – groups + jobs + steps definīcija */}
                {editMode && (
                    <section className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Šablonu rediģēšana (glabājas Supabase)
                        </h2>

                        {/* Group + Job */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Jauna galvenā čekliste (piem., Bremzes)
                                </h3>
                                <input
                                    type="text"
                                    value={newGroupName}
                                    onChange={e => setNewGroupName(e.target.value)}
                                    className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    placeholder="Nosaukums – Bremzes, Eļļa, Amortizatori..."
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
                                    Saglabāt grupu Supabase
                                </button>
                            </div>

                            <div className="space-y-2">
                                <h3 className="text-xs font-semibold uppercase text-slate-300">
                                    Jauns darbs šai grupai (modelis + darbs)
                                </h3>
                                <p className="text-[11px] text-slate-400">
                                    Piemēram: W211 2.2 CDI + Priekšējās bremzes
                                </p>
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
                                    Saglabāt jobu Supabase
                                </button>
                            </div>
                        </div>

                        {/* Step templates creation + list */}
                        <div className="mt-4 space-y-3">
                            <h3 className="text-xs font-semibold uppercase text-slate-300">
                                Soļi šim konkrētajam darbam (job šablons)
                            </h3>
                            {!selectedJob && (
                                <p className="text-[11px] text-slate-500">
                                    Vispirms izvēlies jobu augšā.
                                </p>
                            )}

                            {selectedJob && (
                                <>
                                    {/* Jauns solis */}
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
                                        Pievienot soli šim jobam Supabase
                                    </button>

                                    {/* Esošie soļi – secības labošana + dzēšana */}
                                    {stepTemplates.length > 0 && (
                                        <div className="mt-4 space-y-2">
                                            <p className="text-[11px] text-slate-500">
                                                Esošie soļi šim jobam (rediģē secību vai dzēs, ja kļūda).
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
                                                            Dzēst soli
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

                {/* JOB SELECTOR */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div className="space-y-2">
                            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                                Auto modelis + konkrētais darbs
                            </h2>
                            <p className="text-xs text-slate-400">
                                Šis ir izvēlētais šablons no Supabase. Katru reizi, kad
                                izvēlies citu jobu, tiek ielādēti atsevišķi soļi.
                            </p>
                        </div>
                        <div className="w-full md:w-80">
                            <select
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
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

                {/* Piemaksas + foto + kalkulators */}
                <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
                    <div className="space-y-4">
                        <div className="space-y-2">
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
                                Foto / video klientam
                            </h3>
                            <input
                                type="file"
                                multiple
                                onChange={handleFilesChange}
                                className="w-full rounded-lg border border-dashed border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-400"
                            />
                            {attachments.length > 0 && (
                                <ul className="space-y-1 text-xs text-slate-300">
                                    {attachments.map(file => (
                                        <li key={file.name} className="truncate">
                                            {file.name}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
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

                {/* STEPS RUN */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Soļi remontam (šī remonta run state)
                        </h2>
                    </div>

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
                        {steps.map(step => {
                            const isActive = stepTimerRunning && activeStepId === step.id;

                            return (
                                <div
                                    key={step.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:flex-row"
                                >
                                    {step.image_url && (
                                        <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-800 md:h-24 md:w-40">
                                            <img
                                                src={step.image_url}
                                                alt={step.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-1 space-y-3">
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

                                            <div className="flex flex-col items-end gap-2">
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase text-slate-500">
                                                        Laiks šim solim
                                                    </p>
                                                    <p className="font-mono text-sm">
                                                        {formatTime(step.elapsedSeconds)}
                                                    </p>
                                                </div>
                                                {typeof step.torque_nm === 'number' && (
                                                    <p className="text-[11px] text-slate-400">
                                                        Nm: {step.torque_nm}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            <div />
                                            <div className="flex gap-2">
                                                {isActive ? (
                                                    <button
                                                        onClick={handlePauseStep}
                                                        className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium hover:bg-slate-700"
                                                    >
                                                        Pauze
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleStartStep(step.id)}
                                                        className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium hover:bg-sky-500"
                                                    >
                                                        Startēt soli
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
}
