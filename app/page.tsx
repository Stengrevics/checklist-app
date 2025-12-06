'use client';

import React, { useEffect, useState, ChangeEvent } from 'react';

type Step = {
    id: string;
    title: string;
    description: string;
    imageUrl?: string;
    torqueNm?: number;
    elapsedSeconds: number;
    done: boolean;
};

type Tool = {
    id: string;
    name: string;
    prepared: boolean;
    imageUrl?: string;
};

type Checklist = {
    id: string;
    name: string;
    carModelId?: string;
    jobId?: string;
    steps: Step[];
    tools: Tool[];
    mainSeconds: number; // main timer for whole job
};

type CarModel = {
    id: string;
    name: string;
};

type Job = {
    id: string;
    name: string;
    recommendedMinutes: number;
};

function formatTime(seconds: number) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function ChecklistPage() {
    // editable lists
    const [models, setModels] = useState<CarModel[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);

    // checklists
    const [checklists, setChecklists] = useState<Checklist[]>(() => [
        {
            id: 'cl_1',
            name: 'Jauna čekliste',
            carModelId: undefined,
            jobId: undefined,
            steps: [],
            tools: [],
            mainSeconds: 0,
        },
    ]);
    const [activeChecklistId, setActiveChecklistId] = useState<string>('cl_1');

    // timers
    const [activeStepId, setActiveStepId] = useState<string | null>(null);
    const [stepTimerRunning, setStepTimerRunning] = useState(false);
    const [mainTimerRunning, setMainTimerRunning] = useState(false);

    // pricing
    const [hourlyRate, setHourlyRate] = useState<number>(30);
    const [hasRust, setHasRust] = useState<boolean>(false);
    const [hasExtraDifficulty, setHasExtraDifficulty] = useState<boolean>(false);

    // files + mode
    const [attachments, setAttachments] = useState<File[]>([]);
    const [editMode, setEditMode] = useState<boolean>(false);

    const activeChecklist =
        checklists.find(c => c.id === activeChecklistId) ?? checklists[0];

    const selectedModel = models.find(m => m.id === activeChecklist?.carModelId);
    const selectedJob = jobs.find(j => j.id === activeChecklist?.jobId);

    const steps = activeChecklist?.steps ?? [];
    const stepsSeconds = steps.reduce((sum, step) => sum + step.elapsedSeconds, 0);
    const mainSeconds = activeChecklist?.mainSeconds ?? 0;

    // price is calculated by main timer; if main timer = 0, fall back to sum of steps
    const effectiveSeconds = mainSeconds > 0 ? mainSeconds : stepsSeconds;
    const totalHours = effectiveSeconds / 3600;

    const basePrice = Number.isFinite(hourlyRate) ? totalHours * hourlyRate : 0;
    const rustExtraPercent = hasRust ? 0.25 : 0;
    const difficultyExtraPercent = hasExtraDifficulty ? 0.15 : 0;
    const totalExtraPercent = rustExtraPercent + difficultyExtraPercent;
    const finalPrice = basePrice * (1 + totalExtraPercent);

    const createId = () =>
        `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const updateActiveChecklist = (updater: (c: Checklist) => Checklist) => {
        if (!activeChecklist) return;
        setChecklists(prev =>
            prev.map(c => (c.id === activeChecklist.id ? updater(c) : c))
        );
    };

    // per-step timer
    useEffect(() => {
        if (!stepTimerRunning || !activeStepId || !activeChecklist) return;

        const interval = setInterval(() => {
            setChecklists(prev =>
                prev.map(c => {
                    if (c.id !== activeChecklistId) return c;
                    return {
                        ...c,
                        steps: c.steps.map(step =>
                            step.id === activeStepId
                                ? { ...step, elapsedSeconds: step.elapsedSeconds + 1 }
                                : step
                        ),
                    };
                })
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [stepTimerRunning, activeStepId, activeChecklistId, activeChecklist]);

    // main timer for whole job
    useEffect(() => {
        if (!mainTimerRunning || !activeChecklist) return;

        const interval = setInterval(() => {
            setChecklists(prev =>
                prev.map(c =>
                    c.id === activeChecklistId
                        ? { ...c, mainSeconds: c.mainSeconds + 1 }
                        : c
                )
            );
        }, 1000);

        return () => clearInterval(interval);
    }, [mainTimerRunning, activeChecklistId, activeChecklist]);

    // checklist actions
    const handleCreateChecklist = () => {
        const id = createId();
        const newChecklist: Checklist = {
            id,
            name: 'Jauna čekliste',
            carModelId: undefined,
            jobId: undefined,
            steps: [],
            tools: [],
            mainSeconds: 0,
        };
        setChecklists(prev => [...prev, newChecklist]);
        setActiveChecklistId(id);
        setActiveStepId(null);
        setStepTimerRunning(false);
        setMainTimerRunning(false);
    };

    const handleChecklistNameChange = (value: string) => {
        updateActiveChecklist(c => ({ ...c, name: value }));
    };

    // models
    const addModel = () => {
        const id = createId();
        setModels(prev => [...prev, { id, name: 'Jauns modelis' }]);
    };

    const updateModelName = (id: string, name: string) => {
        setModels(prev => prev.map(m => (m.id === id ? { ...m, name } : m)));
    };

    const deleteModel = (id: string) => {
        setModels(prev => prev.filter(m => m.id !== id));
        setChecklists(prev =>
            prev.map(c => (c.carModelId === id ? { ...c, carModelId: undefined } : c))
        );
    };

    // jobs
    const addJob = () => {
        const id = createId();
        setJobs(prev => [...prev, { id, name: 'Jauns darbs', recommendedMinutes: 0 }]);
    };

    const updateJob = (id: string, field: 'name' | 'minutes', value: string) => {
        setJobs(prev =>
            prev.map(job =>
                job.id === id
                    ? {
                        ...job,
                        name: field === 'name' ? value : job.name,
                        recommendedMinutes:
                            field === 'minutes'
                                ? value === ''
                                    ? 0
                                    : Number(value)
                                : job.recommendedMinutes,
                    }
                    : job
            )
        );
    };

    const deleteJob = (id: string) => {
        setJobs(prev => prev.filter(j => j.id !== id));
        setChecklists(prev =>
            prev.map(c => (c.jobId === id ? { ...c, jobId: undefined } : c))
        );
    };

    // steps
    const toggleStepDone = (id: string) => {
        updateActiveChecklist(c => ({
            ...c,
            steps: c.steps.map(step =>
                step.id === id ? { ...step, done: !step.done } : step
            ),
        }));
    };

    const handleStartStep = (id: string) => {
        setActiveStepId(id);
        setStepTimerRunning(true);
    };

    const handlePauseStep = () => {
        setStepTimerRunning(false);
    };

    const handleStepFieldChange = (
        stepId: string,
        field: 'title' | 'description' | 'torqueNm',
        value: string
    ) => {
        updateActiveChecklist(c => ({
            ...c,
            steps: c.steps.map(step =>
                step.id === stepId
                    ? {
                        ...step,
                        [field]:
                            field === 'torqueNm'
                                ? value === ''
                                    ? undefined
                                    : Number(value)
                                : value,
                    }
                    : step
            ),
        }));
    };

    const handleAddStep = () => {
        const id = createId();
        const newStep: Step = {
            id,
            title: 'Jauns solis',
            description: '',
            elapsedSeconds: 0,
            done: false,
        };
        updateActiveChecklist(c => ({ ...c, steps: [...c.steps, newStep] }));
    };

    const handleDeleteStep = (stepId: string) => {
        updateActiveChecklist(c => ({
            ...c,
            steps: c.steps.filter(step => step.id !== stepId),
        }));
        if (activeStepId === stepId) {
            setActiveStepId(null);
            setStepTimerRunning(false);
        }
    };

    // tools
    const toggleToolPrepared = (id: string) => {
        updateActiveChecklist(c => ({
            ...c,
            tools: c.tools.map(tool =>
                tool.id === id ? { ...tool, prepared: !tool.prepared } : tool
            ),
        }));
    };

    const addTool = () => {
        const id = createId();
        const newTool: Tool = {
            id,
            name: 'Jauns instruments',
            prepared: false,
        };
        updateActiveChecklist(c => ({ ...c, tools: [...c.tools, newTool] }));
    };

    const updateToolName = (id: string, name: string) => {
        updateActiveChecklist(c => ({
            ...c,
            tools: c.tools.map(t => (t.id === id ? { ...t, name } : t)),
        }));
    };

    const deleteTool = (id: string) => {
        updateActiveChecklist(c => ({
            ...c,
            tools: c.tools.filter(t => t.id !== id),
        }));
    };

    // other
    const handleFilesChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        setAttachments(Array.from(e.target.files));
    };

    const handleSelectModel = (id: string) => {
        updateActiveChecklist(c => ({ ...c, carModelId: id || undefined }));
    };

    const handleSelectJob = (id: string) => {
        updateActiveChecklist(c => ({ ...c, jobId: id || undefined }));
    };

    // main timer buttons
    const handleMainStartPause = () => {
        setMainTimerRunning(prev => !prev);
    };

    const handleMainReset = () => {
        setMainTimerRunning(false);
        updateActiveChecklist(c => ({ ...c, mainSeconds: 0 }));
    };

    if (!activeChecklist) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100">
                <p>Nav nevienas čeklistes.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100">
            <div className="mx-auto max-w-6xl px-4 py-8 space-y-6">
                {/* HEADER + MAIN TIMER */}
                <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 md:flex-row md:items-center md:justify-between">
                    <div className="space-y-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
                            <div className="text-xs uppercase text-slate-400">
                                Čeklistes izvēle
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                                <select
                                    className="w-full sm:w-56 rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    value={activeChecklistId}
                                    onChange={e => {
                                        setActiveChecklistId(e.target.value);
                                        setActiveStepId(null);
                                        setStepTimerRunning(false);
                                        setMainTimerRunning(false);
                                    }}
                                >
                                    {checklists.map(c => (
                                        <option key={c.id} value={c.id}>
                                            {c.name || 'Bez nosaukuma'}
                                        </option>
                                    ))}
                                </select>
                                <button
                                    onClick={handleCreateChecklist}
                                    className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium uppercase tracking-wide hover:bg-sky-500"
                                >
                                    Jauna čekliste
                                </button>
                                <button
                                    onClick={() => setEditMode(prev => !prev)}
                                    className="rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-xs font-medium uppercase tracking-wide hover:bg-slate-800"
                                >
                                    {editMode ? 'Beigt rediģēt' : 'Rediģēt visu'}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs text-slate-400 uppercase">
                                Čeklistes nosaukums
                            </label>
                            <input
                                type="text"
                                value={activeChecklist.name}
                                onChange={e => handleChecklistNameChange(e.target.value)}
                                className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                placeholder="Piemēram, W211 priekšējās atsaites maiņa"
                            />
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
                                Soļu summa: {formatTime(stepsSeconds)}
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleMainStartPause}
                                className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-medium hover:bg-emerald-500"
                            >
                                {mainTimerRunning ? 'Pauze galvenajam' : 'Startēt galveno'}
                            </button>
                            <button
                                onClick={handleMainReset}
                                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium hover:bg-slate-800"
                            >
                                Reset
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

                {/* MODELS + JOBS (only in edit mode) */}
                {editMode && (
                    <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 md:grid-cols-2">
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                                    Auto modeļi (filtri)
                                </h2>
                                <button
                                    onClick={addModel}
                                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium hover:bg-slate-700"
                                >
                                    Pievienot modeli
                                </button>
                            </div>
                            {models.length === 0 && (
                                <p className="text-xs text-slate-400">
                                    Nav neviena modeļa. Pievieno sarakstu, ko pēc tam varēsi
                                    izvēlēties čeklistē.
                                </p>
                            )}
                            <div className="space-y-2">
                                {models.map(model => (
                                    <div
                                        key={model.id}
                                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2"
                                    >
                                        <input
                                            type="text"
                                            value={model.name}
                                            onChange={e => updateModelName(model.id, e.target.value)}
                                            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                        />
                                        <button
                                            onClick={() => deleteModel(model.id)}
                                            className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-[11px] text-red-100 hover:bg-red-900"
                                        >
                                            Dzēst
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                                    Darbi un laiks
                                </h2>
                                <button
                                    onClick={addJob}
                                    className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-medium hover:bg-slate-700"
                                >
                                    Pievienot darbu
                                </button>
                            </div>
                            {jobs.length === 0 && (
                                <p className="text-xs text-slate-400">
                                    Nav neviena darba. Pievieno darbu un ieteicamo laiku
                                    (minūtēs).
                                </p>
                            )}
                            <div className="space-y-2">
                                {jobs.map(job => (
                                    <div
                                        key={job.id}
                                        className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-2 sm:flex-row sm:items-center"
                                    >
                                        <input
                                            type="text"
                                            value={job.name}
                                            onChange={e => updateJob(job.id, 'name', e.target.value)}
                                            className="flex-1 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Darba nosaukums"
                                        />
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                value={job.recommendedMinutes}
                                                onChange={e =>
                                                    updateJob(job.id, 'minutes', e.target.value)
                                                }
                                                className="w-20 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                placeholder="min"
                                            />
                                            <span className="text-[11px] text-slate-400">min</span>
                                        </div>
                                        <button
                                            onClick={() => deleteJob(job.id)}
                                            className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-[11px] text-red-100 hover:bg-red-900"
                                        >
                                            Dzēst
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </section>
                )}

                {/* TOOLS */}
                <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-4 shadow-lg shadow-slate-900/40">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Nepieciešamie instrumenti
                        </h2>
                        {editMode && (
                            <button
                                onClick={addTool}
                                className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium hover:bg-sky-500"
                            >
                                Pievienot instrumentu
                            </button>
                        )}
                    </div>

                    {activeChecklist.tools.length === 0 && (
                        <p className="text-xs text-slate-400">
                            Šobrīd nav neviena instrumenta. Rediģēšanas režīmā pievieno visu,
                            kas vajadzīgs šim darbam.
                        </p>
                    )}

                    <div className="space-y-2">
                        {activeChecklist.tools.map(tool => (
                            <div
                                key={tool.id}
                                onClick={() => toggleToolPrepared(tool.id)}
                                className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 hover:border-sky-600/80 hover:bg-slate-900"
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={tool.prepared}
                                        onClick={e => e.stopPropagation()}
                                        onChange={() => toggleToolPrepared(tool.id)}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                                    />
                                    {editMode ? (
                                        <input
                                            type="text"
                                            value={tool.name}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => updateToolName(tool.id, e.target.value)}
                                            className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                            placeholder="Instrumenta nosaukums"
                                        />
                                    ) : (
                                        <span className="text-sm select-none">{tool.name}</span>
                                    )}
                                </div>
                                {editMode && (
                                    <button
                                        onClick={e => {
                                            e.stopPropagation();
                                            deleteTool(tool.id);
                                        }}
                                        className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-[11px] text-red-100 hover:bg-red-900"
                                    >
                                        Dzēst
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>

                {/* CONFIGURATOR + EXTRAS + FILES */}
                <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-900/40 md:grid-cols-2">
                    <div className="space-y-4">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Remonta konfigurators
                        </h2>

                        <div className="space-y-2">
                            <label className="block text-xs text-slate-400 uppercase">
                                Auto modelis
                            </label>
                            {models.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                    Nav neviena modeļa. Ieslēdz rediģēšanu un pievieno tos
                                    augstāk.
                                </p>
                            ) : (
                                <select
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    value={activeChecklist.carModelId ?? ''}
                                    onChange={e => handleSelectModel(e.target.value)}
                                >
                                    <option value="">Nav izvēlēts</option>
                                    {models.map(model => (
                                        <option key={model.id} value={model.id}>
                                            {model.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="space-y-2">
                            <label className="block text-xs text-slate-400 uppercase">
                                Darbs
                            </label>
                            {jobs.length === 0 ? (
                                <p className="text-xs text-slate-500">
                                    Nav neviena darba. Ieslēdz rediģēšanu un pievieno darbus ar
                                    laiku.
                                </p>
                            ) : (
                                <select
                                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                    value={activeChecklist.jobId ?? ''}
                                    onChange={e => handleSelectJob(e.target.value)}
                                >
                                    <option value="">Nav izvēlēts</option>
                                    {jobs.map(job => (
                                        <option key={job.id} value={job.id}>
                                            {job.name}
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2 text-sm">
                            <p className="text-xs text-slate-400 uppercase">
                                Ieteicamais laiks šim darbam
                            </p>
                            <p className="font-mono text-base">
                                {selectedJob ? `${selectedJob.recommendedMinutes} min` : 'Nav definēts'}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                                Reālais laiks (galvenais): {formatTime(mainSeconds)}. Varēsi
                                salīdzināt ieteicamo ar reālo un rādīt starpību klientam.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                                Piemaksas par sarežģījumiem
                            </h3>
                            <div className="flex flex-col gap-2">
                                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={hasRust}
                                        onChange={e => setHasRust(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                                    />
                                    <span>Sarūsējušas skrūves (+25 % pie darba cenas)</span>
                                </label>
                                <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm">
                                    <input
                                        type="checkbox"
                                        checked={hasExtraDifficulty}
                                        onChange={e => setHasExtraDifficulty(e.target.checked)}
                                        className="h-4 w-4 rounded border-slate-500 bg-slate-900 text-sky-500"
                                    />
                                    <span>Papildu aizķeršanās (+15 % pie darba cenas)</span>
                                </label>
                            </div>
                            <p className="text-xs text-slate-400">
                                Bāzes cena: {basePrice.toFixed(2)} €. Piemaksas kopā:{' '}
                                {(totalExtraPercent * 100).toFixed(0)} %.
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
                            <p className="text-xs text-slate-500">
                                Šeit vari pievienot bildes un video ar sarūsējušām skrūvēm,
                                salūzušām detaļām utt., ko parādīt klientam.
                            </p>
                        </div>
                    </div>
                </section>

                {/* CALCULATOR */}
                <section className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-lg shadow-slate-900/40 md:grid-cols-3">
                    <div className="md:col-span-2 space-y-2">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Darba kalkulators
                        </h2>
                        <p className="text-sm text-slate-400">
                            Ievadi savu stundas likmi. Sistēma paņems laiku no galvenā
                            taimerā (ja tas ir ieslēgts) vai no soļiem, un aprēķinās cenu ar
                            piemaksām.
                        </p>
                    </div>
                    <div className="space-y-2">
                        <label className="block text-xs text-slate-400 uppercase">
                            Stundas likme (€ / h)
                        </label>
                        <input
                            type="number"
                            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                            value={hourlyRate}
                            onChange={e => setHourlyRate(parseFloat(e.target.value) || 0)}
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

                {/* STEPS */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                            Soļi remontam
                        </h2>
                        {editMode && (
                            <button
                                onClick={handleAddStep}
                                className="rounded-lg bg-sky-600 px-3 py-1 text-xs font-medium hover:bg-sky-500"
                            >
                                Pievienot soli
                            </button>
                        )}
                    </div>

                    {steps.length === 0 && (
                        <p className="text-xs text-slate-400">
                            Šobrīd nav neviena soļa. Rediģēšanas režīmā pievieno pirmo soli.
                        </p>
                    )}

                    <div className="space-y-3">
                        {steps.map(step => {
                            const isActive = activeStepId === step.id && stepTimerRunning;

                            return (
                                <div
                                    key={step.id}
                                    className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-md shadow-slate-900/40 md:flex-row"
                                >
                                    {step.imageUrl && (
                                        <div className="h-32 w-full overflow-hidden rounded-xl bg-slate-800 md:h-24 md:w-40">
                                            <img
                                                src={step.imageUrl}
                                                alt={step.title}
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                    )}

                                    <div className="flex-1 space-y-3">
                                        <div className="flex items-start justify-between gap-3">
                                            {/* click on text to toggle done */}
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
                                                    {editMode ? (
                                                        <>
                                                            <input
                                                                type="text"
                                                                value={step.title}
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e =>
                                                                    handleStepFieldChange(
                                                                        step.id,
                                                                        'title',
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                                placeholder="Soļa nosaukums"
                                                            />
                                                            <textarea
                                                                value={step.description}
                                                                onClick={e => e.stopPropagation()}
                                                                onChange={e =>
                                                                    handleStepFieldChange(
                                                                        step.id,
                                                                        'description',
                                                                        e.target.value
                                                                    )
                                                                }
                                                                className="w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-sm outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                                rows={2}
                                                                placeholder="Soļa apraksts"
                                                            />
                                                        </>
                                                    ) : (
                                                        <>
                                                            <h3 className="text-sm font-semibold">
                                                                {step.title}
                                                            </h3>
                                                            <p className="text-sm text-slate-400">
                                                                {step.description}
                                                            </p>
                                                        </>
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
                                                {editMode && (
                                                    <button
                                                        onClick={() => handleDeleteStep(step.id)}
                                                        className="rounded-md border border-red-800 bg-red-950 px-2 py-1 text-[11px] font-medium text-red-100 hover:bg-red-900"
                                                    >
                                                        Dzēst soli
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between gap-3">
                                            {typeof step.torqueNm !== 'undefined' || editMode ? (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] uppercase text-slate-500">
                                                        Skrūvju pievilkšana (Nm)
                                                    </span>
                                                    {editMode ? (
                                                        <input
                                                            type="number"
                                                            value={step.torqueNm ?? ''}
                                                            onChange={e =>
                                                                handleStepFieldChange(
                                                                    step.id,
                                                                    'torqueNm',
                                                                    e.target.value
                                                                )
                                                            }
                                                            className="w-20 rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                                                            placeholder="Nm"
                                                        />
                                                    ) : (
                                                        <span className="text-xs font-medium">
                                                            {step.torqueNm} Nm
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <div />
                                            )}

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
