import { useEffect, useMemo, useState } from 'react';

const API_BASE =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : `http://${window.location.hostname}:3000`;

const colors = {
  pageBg: '#f3f5f1',
  panelBg: '#ffffff',
  panelMuted: '#f7f7f2',
  border: '#d8ddd2',
  text: '#17301f',
  textMuted: '#627166',
  primary: '#1d6b4f',
  primaryHover: '#15523d',
  success: '#1f7a45',
  successBg: '#e5f5ea',
  warning: '#a15d16',
  warningBg: '#f9eddc',
  danger: '#b42318',
  dangerBg: '#fee4e2',
  neutralBg: '#edf1eb',
  shadow: '0 16px 40px rgba(23, 48, 31, 0.08)',
  accent: '#c7dd9c',
};

function App() {
  const [tasks, setTasks] = useState([]);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [currentInput, setCurrentInput] = useState('');
  const [runningAll, setRunningAll] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState('');
  const [stepRefineInputs, setStepRefineInputs] = useState({});
  const [showHistory, setShowHistory] = useState({});
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const [activeStepHistoryId, setActiveStepHistoryId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('aiTasks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setTasks(parsed);
      }
    } catch (err) {
      console.error('Failed to load tasks from localStorage', err);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aiTasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    const checkMobile = () => {
      const width = window.innerWidth;
      const mobile = width < 768;
      setWindowWidth(width);
      setIsMobile(mobile);
      if (!mobile) setMobileMenuOpen(false); // close menu on desktop
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isSmallDesktop = !isMobile && windowWidth < 1024;
  const isMediumDesktop = !isMobile && windowWidth >= 1024 && windowWidth < 1440;
  const isLargeDesktop = !isMobile && windowWidth >= 1440;

  const containerStyle = {
    maxWidth: isMobile ? '100%' : 1440,
    width: '100%',
    margin: '0 auto',
    padding: isMobile
      ? '12px 12px 20px'
      : isLargeDesktop
      ? '36px 30px'
      : isMediumDesktop
      ? '30px 24px'
      : '24px 20px',
  };

  const layoutStyle = {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : '340px minmax(0, 1fr)',
    gap: isMobile ? 16 : isLargeDesktop ? 24 : isMediumDesktop ? 20 : 18,
    alignItems: 'start',
    width: '100%',
  };

  const sidebarStyle = {
    backgroundColor: colors.panelBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 24,
    boxShadow: colors.shadow,
    padding: 20,
    position: 'sticky',
    top: 20,
  };

  const mainStyle = {
    backgroundColor: colors.panelBg,
    border: `1px solid ${colors.border}`,
    borderRadius: isMobile ? 18 : 24,
    boxShadow: colors.shadow,
    padding: isMobile ? 14 : isLargeDesktop ? 28 : isMediumDesktop ? 24 : 20,
    minHeight: isMobile ? 'auto' : isLargeDesktop ? 'calc(100vh - 220px)' : isMediumDesktop ? 'calc(100vh - 180px)' : 'calc(100vh - 160px)',
    overflow: isMobile ? 'visible' : 'auto',
  };

  const selectedTask = useMemo(
    () => tasks.find((task) => task.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const createTask = (title) => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    title: title.trim(),
    status: 'queued',
    preview: '',
    taskType: '',
    result: {
      recommendation: '',
      summary: '',
      sections: [],
      steps: [],
      raw: null,
    },
    revisions: [],
    messages: [{ role: 'user', content: title.trim() }],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const createRevision = (changeNote, result) => ({
    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    changeNote,
    result: { ...result },
  });

  const saveRevisionBeforeUpdate = (task, changeNote) => {
    if (!task.result || (!task.result.summary && !task.result.recommendation)) return task;

    const revision = createRevision(changeNote, task.result);
    return {
      ...task,
      revisions: [revision, ...task.revisions],
    };
  };

  const saveStepRevision = (taskId, stepId, changeNote) => {
    const task = getTaskById(taskId);
    if (!task || !task.result || !Array.isArray(task.result.steps)) return;

    const step = task.result.steps.find((s) => s.id === stepId);
    if (!step || !step.result) return;

    const stepRevision = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
      createdAt: new Date().toISOString(),
      changeNote,
      result: { ...step.result },
    };

    updateTaskStep(taskId, stepId, {
      revisions: [stepRevision, ...(step.revisions || [])],
    });
  };

  const restoreRevision = (taskId, revisionId) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        const revision = task.revisions.find((r) => r.id === revisionId);
        if (!revision) return task;

        const taskWithRevision = saveRevisionBeforeUpdate(task, `Restored from ${new Date(revision.createdAt).toLocaleString()}`);

        return {
          ...taskWithRevision,
          result: { ...revision.result },
          preview: buildPreviewText(revision.result),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const setStepHistory = (stepId) => {
    setActiveStepHistoryId((prev) => (prev === stepId ? null : stepId));
  };

  const restoreStepRevision = (taskId, stepId, revision) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;
        const step = (task.result?.steps || []).find((s) => s.id === stepId);
        if (!step || !revision) return task;

        const updatedSteps = (task.result.steps || []).map((s) =>
          s.id === stepId
            ? {
                ...s,
                revisions: [
                  ...(s.revisions || []),
                  {
                    id: Date.now().toString() + Math.random().toString(36).slice(2, 7),
                    createdAt: new Date().toISOString(),
                    changeNote: `Restored ${revision.changeNote}`,
                    result: s.result,
                  },
                ],
                result: { ...revision.result },
              }
            : s
        );

        return {
          ...task,
          result: {
            ...task.result,
            steps: updatedSteps,
          },
          preview: buildPreviewText(revision.result),
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const buildPreviewText = (result) => {
    if (!result) return '';
    if (typeof result.summary === 'string' && result.summary.trim()) return result.summary.trim();
    if (typeof result.recommendation === 'string' && result.recommendation.trim()) {
      return result.recommendation.trim();
    }
    if (Array.isArray(result.steps) && result.steps.length > 0) {
      const firstWithResult = result.steps.find((step) => step?.result?.items?.length);
      if (firstWithResult?.result?.items?.[0]?.label) {
        return firstWithResult.result.items[0].label;
      }
    }
    return '';
  };

  const createEmptyStepResult = (title) => ({
    title: title || 'Step result',
    items: [],
    notes: '',
  });

  const createFallbackStepResult = (step, reason = '') => ({
    title: step?.title || 'Step result',
    resultType: step?.resultType || 'summary',
    summary: step?.title ? [`Best option: ${step.title}`] : [],
    highlights: step?.capability ? [`Capability used: ${step.capability}`] : [],
    items: step?.title
      ? [
          {
            label: step.title,
            subtitle: 'Execution fallback result',
            metadata: reason ? [reason] : ['Fallback used'],
          },
        ]
      : [],
    notes: reason || 'Execution fallback used. Review recommendations and refine further.',
  });

  const normalizeListingItem = (item) => {
    if (typeof item === 'string') {
      return { label: item };
    }

    if (!item || typeof item !== 'object') {
      return null;
    }

    const normalized = {
      label: typeof item.label === 'string' ? item.label : '',
      subtitle: typeof item.subtitle === 'string' ? item.subtitle : '',
      price: typeof item.price === 'string' ? item.price : '',
      rating: typeof item.rating === 'string' ? item.rating : '',
      thumbnail: typeof item.thumbnail === 'string' ? item.thumbnail : '',
      link: typeof item.link === 'string' ? item.link : '',
      checked: typeof item.checked === 'boolean' ? item.checked : false,
      time: typeof item.time === 'string' ? item.time : '',
      value: typeof item.value === 'string' ? item.value : '',
      columns: Array.isArray(item.columns)
        ? item.columns.filter((value) => typeof value === 'string' && value.trim())
        : [],
      metadata: Array.isArray(item.metadata)
        ? item.metadata.filter((value) => typeof value === 'string' && value.trim())
        : [],
    };

    return normalized.label ? normalized : null;
  };

  const normalizeStepResult = (payload, stepTitle) => {
    const result = payload?.result || payload || {};

    return {
      title: result?.title || stepTitle || 'Step result',
      resultType: result?.resultType || 'summary',
      items: Array.isArray(result?.items)
        ? result.items.map(normalizeListingItem).filter(Boolean)
        : [],
      links: Array.isArray(result?.links)
        ? result.links.filter((link) => typeof link === 'string' && link.trim())
        : [],
      summary: Array.isArray(result?.summary)
        ? result.summary.filter((item) => typeof item === 'string' && item.trim())
        : [],
      highlights: Array.isArray(result?.highlights)
        ? result.highlights.filter((item) => typeof item === 'string' && item.trim())
        : [],
      assumptions: Array.isArray(result?.assumptions)
        ? result.assumptions.filter((item) => typeof item === 'string' && item.trim())
        : [],
      bestOption: result?.bestOption ? normalizeListingItem(result.bestOption) : null,
      alternatives: Array.isArray(result?.alternatives)
        ? result.alternatives.map(normalizeListingItem).filter(Boolean)
        : [],
      actions: Array.isArray(result?.actions)
        ? result.actions.filter(
            (action) =>
              action &&
              typeof action === 'object' &&
              typeof action.url === 'string' &&
              action.url.trim()
          )
        : [],
      timeline: Array.isArray(result?.timeline) ? result.timeline : [],
      budget: Array.isArray(result?.budget) ? result.budget : [],
      notes:
        typeof result?.notes === 'string'
          ? result.notes
          : typeof result?.summary === 'string'
          ? result.summary
          : '',
    };
  };

  const isUsableStepResult = (result) =>
    Boolean(
      result &&
        ((Array.isArray(result.items) && result.items.length > 0) ||
          (Array.isArray(result.summary) && result.summary.length > 0) ||
          Boolean(result.bestOption) ||
          (Array.isArray(result.timeline) && result.timeline.length > 0) ||
          (Array.isArray(result.actions) && result.actions.length > 0) ||
          (typeof result.notes === 'string' && result.notes.trim()))
    );

  const addTask = () => {
    if (!currentInput.trim()) return;

    const newTask = createTask(currentInput);
    setTasks((prev) => [newTask, ...prev]);
    setCurrentInput('');
    setError('');

    if (!selectedTaskId) {
      setSelectedTaskId(newTask.id);
    }
  };

  const updateTask = (taskId, updates, changeNote) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        let updatedTask = { ...task };

        // Save revision if result is being updated and we have a change note
        if (changeNote && updates.result && (task.result?.summary || task.result?.recommendation)) {
          updatedTask = saveRevisionBeforeUpdate(task, changeNote);
        }

        return {
          ...updatedTask,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const updateTaskStep = (taskId, stepId, updates) => {
    setTasks((prev) =>
      prev.map((task) => {
        if (task.id !== taskId) return task;

        const currentSteps = Array.isArray(task.result?.steps) ? task.result.steps : [];
        const nextSteps = currentSteps.map((step) =>
          step.id === stepId ? { ...step, ...updates } : step
        );

        return {
          ...task,
          result: {
            ...task.result,
            steps: nextSteps,
          },
          updatedAt: new Date().toISOString(),
        };
      })
    );
  };

  const getTaskById = (taskId) => tasks.find((task) => task.id === taskId);

  const getStatusMeta = (status) => {
    switch (status) {
      case 'ready':
        return { icon: '✓', color: colors.success, bg: colors.successBg, label: 'Ready' };
      case 'completed':
        return { icon: '✓', color: colors.success, bg: colors.successBg, label: 'Completed' };
      case 'failed':
        return { icon: '!', color: colors.danger, bg: colors.dangerBg, label: 'Failed' };
      case 'running':
        return { icon: '⋯', color: colors.warning, bg: colors.warningBg, label: 'Running' };
      case 'analyzing':
        return { icon: '⋯', color: colors.warning, bg: colors.warningBg, label: 'Analyzing' };
      case 'needs_input':
        return { icon: '?', color: colors.warning, bg: colors.warningBg, label: 'Needs input' };
      default:
        return { icon: '○', color: colors.textMuted, bg: colors.neutralBg, label: 'Queued' };
    }
  };

  const toPreviewText = (payload) => {
    if (!payload) return '';
    if (
      Array.isArray(payload.steps) &&
      payload.steps.length > 0 &&
      !payload.steps.some((step) => step?.status === 'completed')
    ) {
      return 'Plan created. Execution still needed.';
    }
    if (typeof payload.summary === 'string' && payload.summary.trim()) return payload.summary.trim();
    if (typeof payload.recommendation === 'string' && payload.recommendation.trim()) {
      return payload.recommendation.trim();
    }
    if (Array.isArray(payload.steps) && payload.steps.length > 0) {
      const firstWithResult = payload.steps.find((step) => step?.result?.items?.length);
      if (firstWithResult?.result?.items?.[0]?.label) {
        return firstWithResult.result.items[0].label;
      }
      if (typeof payload.steps[0]?.title === 'string') {
        return payload.steps[0].title;
      }
    }
    return 'Could not generate detailed results yet.';
  };

  const cleanMarkdown = (text = '') => {
    if (typeof text !== 'string') return text;
    return text
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/__(.*?)__/g, '$1')
      .replace(/###\s+/g, '')
      .replace(/##\s+/g, '')
      .replace(/#\s+/g, '')
      .replace(/`{1,3}(.*?)`{1,3}/g, '$1')
      .replace(/!\[[^\]]*\]\([^\)]*\)/g, '')
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
      .replace(/^[-*+]\s+/gm, '')
      .replace(/\n{2,}/g, '\n')
      .trim();
  };

  const safeParse = (text) => {
    try {
      return JSON.parse(text);
    } catch {
      const jsonBlock = text.match(/\{[\s\S]*\}/); // first JSON block
      if (!jsonBlock) return null;
      try {
        return JSON.parse(jsonBlock[0]);
      } catch {
        return null;
      }
    }
  };

  const normalizePlanResponse = (data) => {
    const rawSteps = Array.isArray(data?.steps) ? data.steps : [];

    const normalizedSteps = rawSteps.map((step, index) => ({
      id: step?.id || `step-${index + 1}`,
      title:
        typeof step === 'string'
          ? step
          : step?.title || step?.task || `Step ${index + 1}`,
      purpose:
        typeof step === 'object'
          ? step?.purpose || step?.description || ''
          : '',
      capability:
        typeof step === 'object' ? step?.capability || 'summarize' : 'summarize',
      connectors:
        typeof step === 'object' && Array.isArray(step?.connectors)
          ? step.connectors.filter((connector) => typeof connector === 'string' && connector.trim())
          : [],
      description: typeof step === 'object' ? step?.description || step?.purpose || '' : '',
      resultType:
        typeof step === 'object' ? step?.resultType || 'summary' : 'summary',
      type: typeof step === 'object' ? step?.type || 'general' : 'general',
      status: typeof step === 'object' && step?.status ? step.status : 'pending',
      result:
        typeof step === 'object' && step?.result
          ? normalizeStepResult(step.result, step?.title)
          : null,
      revisions: [],
    }));

    const summary =
      data?.summary ||
      data?.recommendation ||
      data?.result?.summary ||
      'Plan created. Execute steps to see detailed results.';

    return {
      summary,
      recommendation: data?.recommendation || summary,
      sections: Array.isArray(data?.summarySections)
        ? data.summarySections
        : Array.isArray(data?.sections)
        ? data.sections
        : [],
      steps: normalizedSteps,
      raw: data,
    };
  };

  const getCompletedSteps = (task) => {
    const steps = Array.isArray(task?.result?.steps) ? task.result.steps : [];
    return steps.filter(
      (step) => step.status === 'completed' && isUsableStepResult(step.result)
    );
  };

  const buildTaskSummaryFromSteps = (task) => {
    const completed = getCompletedSteps(task);
    const totalSteps = Array.isArray(task?.result?.steps) ? task.result.steps.length : 0;
    const existingRecommendation =
      typeof task?.result?.recommendation === 'string' ? task.result.recommendation : '';
    const existingSummary =
      typeof task?.result?.summary === 'string' ? task.result.summary : '';

    if (!completed.length) {
      return {
        completedCount: 0,
        hasCompletedSteps: false,
        recommendation:
          existingRecommendation || 'Plan created. Execution still needed.',
        summary: existingSummary || 'Plan created. Execution still needed.',
        preview: 'Plan created. Execution still needed.',
        sections: [],
      };
    }

    const sections = completed.map((step) => ({
      title: step.title,
      content: (step.result?.items || [])
        .slice(0, 3)
        .map((item) =>
          [item.label, item.price, item.rating].filter(Boolean).join(' • ')
        )
        .concat(step.result?.notes ? [step.result.notes] : []),
    }));

    return {
      completedCount: completed.length,
      hasCompletedSteps: true,
      recommendation:
        completed.length < totalSteps
          ? 'Detailed results partially generated.'
          : 'Review recommendations and refine further.',
      summary:
        completed.length < totalSteps
          ? 'Detailed results partially generated.'
          : 'Review recommendations and refine further.',
      preview:
        completed.length < totalSteps
          ? 'Detailed results partially generated.'
          : 'Review recommendations and refine further.',
      sections,
    };
  };

  const buildTaskResultFromSteps = (task, nextSteps) => {
    const nextSummary = buildTaskSummaryFromSteps({
      ...task,
      result: { ...task?.result, steps: nextSteps },
    });

    return {
      nextSummary,
      nextResult: {
        ...(task?.result || {}),
        steps: nextSteps,
        recommendation: nextSummary.recommendation,
        summary: nextSummary.summary,
        sections: nextSummary.sections,
      },
    };
  };

  const buildTaskStateFromSteps = (task, workingSteps) => {
    const { nextSummary, nextResult } = buildTaskResultFromSteps(task, workingSteps);
    const completedSteps = workingSteps.filter(
      (step) => step.status === 'completed' && isUsableStepResult(step.result)
    );

    return {
      completedSteps,
      nextSummary,
      nextResult,
      nextStatus: completedSteps.length > 0 ? 'ready' : 'needs_input',
    };
  };

  const planTaskOnly = async (taskId) => {
    const task = getTaskById(taskId);
    if (!task) return null;

    updateTask(taskId, { status: 'analyzing' });
    setError('');

    const response = await fetch(`${API_BASE}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task: task.title }),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    const result = normalizePlanResponse(data);
    const preview = toPreviewText(result).slice(0, 110);

    updateTask(taskId, {
      status: 'running',
      preview: preview + (preview.length >= 110 ? '...' : ''),
      taskType: data?.taskType || 'general',
      result,
    });

    return result;
  };

  const executeStep = async (taskId, step) => {
    const task = getTaskById(taskId);
    if (!task) return null;
    if (!step) return null;

    console.log('Executing step:', step);
    const requestPayload = {
      projectTitle: task.title,
      userRequest: task.title,
      step: {
        id: step.id,
        title: step.title,
        purpose: step.purpose || step.description || '',
        capability: step.capability || 'summarize',
        resultType: step.resultType || 'summary',
        connectors: Array.isArray(step.connectors) ? step.connectors : [],
        type: step.type || 'general',
      },
    };
    console.log('Execute-step payload:', requestPayload);

    updateTask(taskId, { status: 'running' });
    updateTaskStep(taskId, step.id, { status: 'running' });

    try {
      const response = await fetch(`${API_BASE}/execute-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
      });
      const rawBody = await response.text();
      console.log('Execute-step response status:', response.status);
      console.log('Execute-step raw response body:', rawBody);

      const parsedBody = rawBody ? safeParse(rawBody) : null;
      let result = parsedBody ? normalizeStepResult(parsedBody, step.title) : null;

      if (!isUsableStepResult(result)) {
        result = createFallbackStepResult(
          step,
          response.ok
            ? 'Plan created. Execution fallback used.'
            : `Plan created. Execution fallback used after server response ${response.status}.`
        );
      }

      console.log('Execute-step result:', result);

      saveStepRevision(taskId, step.id, `Execute: ${step.title}`);
      return {
        stepId: step.id,
        result,
        status: 'completed',
      };
    } catch (err) {
      console.error('Step execution failed:', err);
      const fallbackResult = createFallbackStepResult(
        step,
        'Plan created. Execution fallback used.'
      );
      console.log('Execute-step result:', fallbackResult);
      saveStepRevision(taskId, step.id, `Execute fallback: ${step.title}`);
      return {
        stepId: step.id,
        result: fallbackResult,
        status: 'completed',
      };
    }
  };

  const handleExecuteSingleStep = async (taskId, step) => {
    const task = getTaskById(taskId);
    if (!task || !step) return;

    try {
      const stepUpdate = await executeStep(taskId, step);
      if (!stepUpdate) return;

      const workingSteps = (Array.isArray(task.result?.steps) ? task.result.steps : []).map(
        (item) =>
          item.id === stepUpdate.stepId
            ? { ...item, status: stepUpdate.status, result: stepUpdate.result }
            : item
      );
      const { nextSummary, nextResult, nextStatus } = buildTaskStateFromSteps(
        task,
        workingSteps
      );

      updateTask(
        taskId,
        {
          status: nextStatus,
          preview: nextSummary.preview,
          result: nextResult,
        },
        `Execute: ${step.title}`
      );
    } catch (err) {
      console.error('Single step execution failed:', err);
    }
  };

  const processTask = async (taskId) => {
    try {
      const task = getTaskById(taskId);
      if (!task) return;

      let workingTask = task;
      let plan = workingTask.result?.steps?.length ? workingTask.result : null;

      if (!plan || !Array.isArray(plan.steps) || plan.steps.length === 0) {
        plan = await planTaskOnly(taskId);
        if (plan) {
          workingTask = {
            ...workingTask,
            status: 'running',
            taskType: workingTask.taskType || 'general',
            result: plan,
          };
        }
      }

      let workingSteps = Array.isArray(plan?.steps) ? plan.steps : [];
      console.log('Working steps before loop:', workingSteps);

      if (!workingSteps.length) {
        updateTask(taskId, {
          status: 'needs_input',
          preview: 'Plan created. Execution still needed.',
          result: {
            ...(workingTask?.result || {}),
            ...(plan || {}),
            recommendation:
              plan?.recommendation || plan?.summary || 'Plan created. Execution still needed.',
            summary:
              plan?.summary || plan?.recommendation || 'Plan created. Execution still needed.',
            sections: Array.isArray(plan?.sections) ? plan.sections : [],
            steps: workingSteps,
          },
        });
        return;
      }

      for (const step of workingSteps) {
        if (step.status !== 'completed') {
          const stepUpdate = await executeStep(taskId, step);
          if (!stepUpdate) continue;

          workingSteps = workingSteps.map((item) =>
            item.id === stepUpdate.stepId
              ? { ...item, status: stepUpdate.status, result: stepUpdate.result }
              : item
          );
          console.log('Working steps after update:', workingSteps);

          const { nextSummary, nextResult } = buildTaskStateFromSteps(
            workingTask,
            workingSteps
          );

          workingTask = {
            ...workingTask,
            status: 'running',
            result: nextResult,
          };

          updateTask(taskId, {
            status: 'running',
            preview: nextSummary.preview,
            result: nextResult,
          });
        }
      }

      const finalTask = {
        ...workingTask,
        result: {
          ...(workingTask?.result || {}),
          steps: workingSteps,
        },
      };
      const { completedSteps, nextSummary, nextResult } = buildTaskStateFromSteps(
        finalTask,
        workingSteps
      );

      console.log('Final task before summary:', finalTask);
      console.log('Completed steps:', completedSteps);

      if (!Array.isArray(workingSteps) || workingSteps.length === 0) {
        updateTask(taskId, {
          status: 'needs_input',
          preview: 'Plan created. Execution still needed.',
          result: {
            ...nextResult,
            recommendation:
              nextResult?.recommendation || 'Plan created. Execution still needed.',
            summary:
              nextResult?.summary || 'Plan created. Execution still needed.',
            sections: nextResult?.sections || [],
          },
        });
        return;
      }

      if (!completedSteps.length) {
        updateTask(taskId, {
          status: 'needs_input',
          preview: 'Plan created. Execution fallback used.',
          result: {
            ...nextResult,
            recommendation:
              nextResult?.recommendation || 'Plan created. Execution fallback used.',
            summary:
              nextResult?.summary || 'Plan created. Execution fallback used.',
            sections: nextResult?.sections || [],
          },
        });
        return;
      }

      try {
        const summaryResponse = await fetch(`${API_BASE}/final-summary`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectTitle: finalTask.title,
            userRequest: finalTask.title,
            completedSteps,
          }),
        });

        const summaryData = await summaryResponse.json();
        const fallbackSummary = buildTaskSummaryFromSteps(finalTask);
        const summaryText =
          typeof summaryData.summary === 'string' && summaryData.summary.trim()
            ? summaryData.summary
            : fallbackSummary.summary;
        const summarySections = Array.isArray(summaryData.summarySections)
          ? summaryData.summarySections
          : fallbackSummary.sections;

        updateTask(taskId, {
          status: 'ready',
          preview: summaryText || fallbackSummary.preview,
          result: {
            ...(finalTask?.result || {}),
            recommendation:
              summaryText ||
              finalTask?.result?.recommendation ||
              'Could not generate detailed results yet.',
            summary:
              summaryText ||
              finalTask?.result?.summary ||
              'Could not generate detailed results yet.',
            sections: summarySections,
          },
        }, 'Task completed with final summary');
      } catch (err) {
        console.error('Final summary failed:', err);

        const finalSummary = nextSummary;

        updateTask(taskId, {
          status: completedSteps.length > 0 ? 'ready' : 'needs_input',
          preview:
            completedSteps.length > 0
              ? 'Detailed results partially generated.'
              : 'Plan created. Execution fallback used.',
          result: {
            ...nextResult,
            recommendation: finalSummary.recommendation,
            summary: finalSummary.summary,
            sections: finalSummary.sections,
          },
        }, 'Task completed (fallback summary)');
      }
    } catch (err) {
      console.error('Task processing failed:', err);
      updateTask(taskId, {
        status: 'failed',
        preview: 'Could not complete this task.',
      });
      setError('One or more tasks failed. Check the item and retry.');
    }
  };

  const runAllTasks = async () => {
    const runnable = tasks.filter((task) => task.status === 'queued' || task.status === 'failed');
    if (!runnable.length || runningAll) return;

    setRunningAll(true);
    setError('');

    try {
      for (const task of runnable) {
        await processTask(task.id);
      }
    } finally {
      setRunningAll(false);
    }
  };

  const refineStep = async (taskId, stepId, refinement) => {
    const task = getTaskById(taskId);
    if (!task || !refinement.trim()) return;

    const currentSteps = Array.isArray(task.result?.steps) ? task.result.steps : [];
    const step = currentSteps.find((item) => item.id === stepId);
    if (!step) return;

    updateTask(taskId, { status: 'running' });
    updateTaskStep(taskId, stepId, { status: 'running' });

    try {
      const response = await fetch(`${API_BASE}/refine-step`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectTitle: task.title,
          userRequest: task.title,
          step: {
            id: step.id,
            title: step.title,
            purpose: step.purpose || step.description || '',
            capability: step.capability || 'summarize',
            resultType: step.resultType || step.result?.resultType || 'summary',
            connectors: Array.isArray(step.connectors) ? step.connectors : [],
            type: step.type || 'general',
            result: step.result,
          },
          refinePrompt: refinement,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const result = normalizeStepResult(data, step.title);
      const nextSteps = currentSteps.map((item) =>
        item.id === stepId ? { ...item, status: 'completed', result } : item
      );
      const { nextSummary, nextResult, nextStatus } = buildTaskStateFromSteps(
        task,
        nextSteps
      );

      saveStepRevision(taskId, stepId, `Refined: ${step.title}`);

      updateTask(taskId, {
        status: nextStatus,
        preview: nextSummary.preview,
        result: nextResult,
        messages: [
          ...(task?.messages || []),
          { role: 'user', content: refinement },
          { role: 'assistant', content: `Updated ${step.title}.` },
        ],
      }, `Refined: ${step.title}`);

      setStepRefineInputs((prev) => ({ ...prev, [stepId]: '' }));
    } catch (err) {
      console.error('Refine failed:', err);
      updateTask(taskId, { status: 'failed' });
      updateTaskStep(taskId, stepId, { status: 'failed' });
      setError('Refinement failed. Try again.');
    }
  };

  const handleSendChat = async (e) => {
    e.preventDefault();
    if (!selectedTaskId || !chatInput.trim()) return;

    const task = getTaskById(selectedTaskId);
    if (!task) return;

    const nextMessages = [...(task.messages || []), { role: 'user', content: chatInput }];
    updateTask(selectedTaskId, {
      status: 'running',
      messages: nextMessages,
    });

    const question = chatInput;
    setChatInput('');

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const assistantTextRaw = data?.result || data?.summary || 'I updated the answer for this item.';
      const assistantText = cleanMarkdown(assistantTextRaw);

      const currentResult = task.result || {
        recommendation: '',
        summary: '',
        sections: [],
        steps: [],
        raw: null,
      };

      const updatedResult = {
        ...currentResult,
        recommendation: assistantText,
        summary: assistantText,
        raw: { ...(currentResult.raw || {}), chat: assistantTextRaw },
      };

      updateTask(selectedTaskId, {
        status: 'ready',
        preview: assistantText,
        result: updatedResult,
        messages: [...nextMessages, { role: 'assistant', content: assistantText }],
      }, `Follow-up: ${question.substring(0, 50)}${question.length > 50 ? '...' : ''}`);
    } catch (err) {
      console.error('Chat failed:', err);
      updateTask(selectedTaskId, {
        status: 'failed',
        messages: [
          ...nextMessages,
          { role: 'assistant', content: 'Chat failed. Please try again.' },
        ],
      });
      setError('Chat request failed.');
      setChatInput(question);
    }
  };

  const applyCustomization = async (instruction) => {
    if (!selectedTask || !selectedTaskId) return;

    const changeNote = instruction || 'Customize task';

    const nextMessages = [...(selectedTask.messages || []), { role: 'user', content: instruction }];

    updateTask(selectedTaskId, {
      status: 'running',
      messages: nextMessages,
    });

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const data = await response.json();
      const assistantTextRaw = data?.result || data?.summary || 'Task updated.';
      const assistantText = cleanMarkdown(assistantTextRaw);

      const currentResult = selectedTask.result || {
        summary: '',
        recommendation: '',
        sections: [],
        steps: [],
        raw: null,
      };

      const updatedResult = {
        ...currentResult,
        summary: assistantText,
        recommendation: assistantText,
        raw: { ...(currentResult.raw || {}), customize: assistantTextRaw },
      };

      updateTask(selectedTaskId, {
        status: 'ready',
        preview: assistantText,
        result: updatedResult,
        messages: [...nextMessages, { role: 'assistant', content: assistantText }],
      }, `Customize: ${changeNote}`);
    } catch (err) {
      console.error('Customization failed:', err);
      setError('Customization request failed.');
      updateTask(selectedTaskId, { status: 'failed' });
    }
  };

  const renderSectionContent = (content) => {
    if (Array.isArray(content)) {
      return (
        <ul style={{ margin: '10px 0 0', paddingLeft: 18, color: colors.text }}>
          {content.map((item, index) => (
            <li key={index} style={{ marginBottom: 8, lineHeight: 1.6 }}>
              {typeof item === 'string' ? item : JSON.stringify(item)}
            </li>
          ))}
        </ul>
      );
    }

    return (
      <p style={{ margin: '10px 0 0', color: colors.text, lineHeight: 1.7 }}>
        {String(content || '')}
      </p>
    );
  };

  const isValidImageUrl = (url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase();
    // Check for real image extensions
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg', '.bmp'];
    const hasImageExt = imageExtensions.some(ext => lower.includes(ext));
    // Reject placeholders and broken URLs
    const isPlaceholder = lower.includes('example.com') || lower.includes('placeholder') || lower.includes('...');
    const isValid = hasImageExt && !isPlaceholder;
    return isValid;
  };

  const renderResultCards = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 14,
          marginTop: 14,
        }}
      >
        {items.map((item, index) => {
          const hasValidImage = isValidImageUrl(item.thumbnail);
          const cardBody = (
            <>
              {hasValidImage && (
                <div
                  style={{
                    width: '100%',
                    aspectRatio: '16 / 10',
                    borderRadius: 14,
                    overflow: 'hidden',
                    marginBottom: 12,
                    backgroundColor: colors.panelMuted,
                  }}
                >
                  <img
                    src={item.thumbnail}
                    alt={item.label}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'flex-start',
                }}
              >
                <div style={{ fontWeight: 700, color: colors.text, lineHeight: 1.4 }}>
                  {item.label}
                </div>
                {(item.price || item.rating) && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.price ? (
                      <div style={{ fontWeight: 800, color: colors.primary }}>{item.price}</div>
                    ) : null}
                    {item.rating ? (
                      <div style={{ fontSize: 12, color: colors.textMuted }}>{item.rating}</div>
                    ) : null}
                  </div>
                )}
              </div>

              {item.subtitle ? (
                <div style={{ marginTop: 8, color: colors.textMuted, lineHeight: 1.6 }}>
                  {item.subtitle}
                </div>
              ) : null}

              {item.metadata?.length ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                  {item.metadata.map((meta, metaIndex) => (
                    <span
                      key={metaIndex}
                      style={{
                        display: 'inline-flex',
                        padding: '6px 10px',
                        borderRadius: 999,
                        backgroundColor: colors.panelMuted,
                        border: `1px solid ${colors.border}`,
                        fontSize: 12,
                        color: colors.textMuted,
                      }}
                    >
                      {meta}
                    </span>
                  ))}
                </div>
              ) : null}

              {item.link ? (
                <div style={{ marginTop: 14 }}>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '9px 12px',
                      borderRadius: 10,
                      backgroundColor: '#e8f3ee',
                      color: colors.primary,
                      fontWeight: 700,
                      fontSize: 13,
                    }}
                  >
                    Open source
                  </span>
                </div>
              ) : null}
            </>
          );

          const commonStyle = {
            display: 'block',
            borderRadius: 18,
            backgroundColor: colors.panelBg,
            border: `1px solid ${colors.border}`,
            padding: 16,
            textDecoration: 'none',
            boxShadow: '0 8px 24px rgba(23, 48, 31, 0.04)',
          };

          if (item.link) {
            return (
              <a
                key={`${item.label}-${index}`}
                href={item.link}
                target="_blank"
                rel="noreferrer"
                style={commonStyle}
              >
                {cardBody}
              </a>
            );
          }

          return (
            <div key={`${item.label}-${index}`} style={commonStyle}>
              {cardBody}
            </div>
          );
        })}
      </div>
    );
  };

  const renderLinksList = (items, links) => {
    const mergedLinks = [
      ...(Array.isArray(items) ? items.map((item) => item.link).filter(Boolean) : []),
      ...(Array.isArray(links) ? links : []),
    ];
    const uniqueLinks = [...new Set(mergedLinks)];
    if (!uniqueLinks.length) return null;

    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {uniqueLinks.map((link, index) => (
          <a
            key={`${link}-${index}`}
            href={link}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: 14,
              backgroundColor: colors.panelBg,
              border: `1px solid ${colors.border}`,
              color: colors.primary,
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            {link}
          </a>
        ))}
      </div>
    );
  };

  const renderChecklist = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'flex-start',
              padding: '12px 14px',
              borderRadius: 14,
              backgroundColor: colors.panelBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: 999,
                border: `2px solid ${item.checked ? colors.success : colors.border}`,
                backgroundColor: item.checked ? colors.successBg : '#fff',
                flexShrink: 0,
                marginTop: 2,
              }}
            />
            <div>
              <div style={{ fontWeight: 700, color: colors.text }}>{item.label}</div>
              {item.subtitle ? (
                <div style={{ marginTop: 4, color: colors.textMuted, lineHeight: 1.6 }}>
                  {item.subtitle}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderTimeline = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '96px 1fr',
              gap: 14,
              padding: '12px 14px',
              borderRadius: 14,
              backgroundColor: colors.panelBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontWeight: 800, color: colors.primary }}>
              {item.time || `Step ${index + 1}`}
            </div>
            <div>
              <div style={{ fontWeight: 700, color: colors.text }}>{item.label}</div>
              {item.subtitle ? (
                <div style={{ marginTop: 4, color: colors.textMuted, lineHeight: 1.6 }}>
                  {item.subtitle}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ExpandableSummaryBox = ({ text, colors }) => {
    const [showFullText, setShowFullText] = useState(false);
    const isLongText = text.length > 200;
    const displayText = isLongText && !showFullText ? text.substring(0, 200) + '...' : text;

    return (
      <div
        style={{
          marginTop: 14,
          padding: 14,
          borderRadius: 14,
          backgroundColor: colors.panelMuted,
          color: colors.text,
          lineHeight: 1.7,
          border: `1px solid ${colors.border}`,
        }}
      >
        {displayText}
        {isLongText && (
          <button
            onClick={() => setShowFullText(!showFullText)}
            style={{
              marginTop: 8,
              padding: '4px 8px',
              borderRadius: 6,
              backgroundColor: colors.neutralBg,
              border: `1px solid ${colors.border}`,
              color: colors.primary,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {showFullText ? 'Show less' : 'Show details'}
          </button>
        )}
      </div>
    );
  };

  const renderSummaryBox = (notes, items) => {
    const text =
      (typeof notes === 'string' && notes.trim()) ||
      (Array.isArray(items) && items[0]?.label) ||
      '';
    if (!text) return null;

    return <ExpandableSummaryBox text={text} colors={colors} />;
  };

  const renderTable = (items) => {
    if (!Array.isArray(items) || items.length === 0) return null;

    return (
      <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
        {items.map((item, index) => (
          <div
            key={`${item.label}-${index}`}
            style={{
              padding: '12px 14px',
              borderRadius: 14,
              backgroundColor: colors.panelBg,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontWeight: 700, color: colors.text }}>{item.label}</div>
            {item.value ? (
              <div style={{ marginTop: 4, color: colors.textMuted }}>{item.value}</div>
            ) : null}
            {item.columns?.length ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {item.columns.map((column, columnIndex) => (
                  <span
                    key={columnIndex}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 999,
                      backgroundColor: colors.panelMuted,
                      border: `1px solid ${colors.border}`,
                      fontSize: 12,
                      color: colors.textMuted,
                    }}
                  >
                    {column}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    );
  };

  const renderSummaryBullets = (summary) => {
    if (!Array.isArray(summary) || summary.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          {summary.map((bullet, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: colors.primary, fontSize: 14, fontWeight: 800, marginTop: 2 }}>•</div>
              <div style={{ color: colors.text, lineHeight: 1.5, fontSize: 14 }}>
                {bullet}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTimelineByDay = (timelineData) => {
    if (!Array.isArray(timelineData) || timelineData.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Timeline
        </div>
        <div style={{ display: 'grid', gap: 14 }}>
          {timelineData.map((daySection, dayIndex) => (
            <div
              key={dayIndex}
              style={{
                borderRadius: 14,
                backgroundColor: colors.panelBg,
                border: `1px solid ${colors.border}`,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: 12,
                  backgroundColor: colors.neutralBg,
                  fontWeight: 700,
                  color: colors.text,
                  fontSize: 14,
                  borderBottom: `1px solid ${colors.border}`,
                }}
              >
                {daySection.day}
              </div>
              <div style={{ display: 'grid', gap: 0 }}>
                {Array.isArray(daySection.items) && daySection.items.map((item, itemIndex) => (
                  <div
                    key={itemIndex}
                    style={{
                      padding: '12px 14px',
                      borderBottom: itemIndex < daySection.items.length - 1 ? `1px solid ${colors.border}` : 'none',
                      display: 'grid',
                      gridTemplateColumns: '80px 1fr',
                      gap: 14,
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ fontWeight: 800, color: colors.primary, fontSize: 13 }}>
                      {item.time}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, color: colors.text, fontSize: 14 }}>
                        {item.label}
                      </div>
                      {item.subtitle && (
                        <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 2 }}>
                          {item.subtitle}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderBudget = (budgetData) => {
    if (!Array.isArray(budgetData) || budgetData.length === 0) return null;

    const total = budgetData.reduce((sum, item) => {
      const numValue = parseInt(item.value?.replace(/\D/g, '')) || 0;
      return sum + numValue;
    }, 0);

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Budget
        </div>
        <div style={{ borderRadius: 14, backgroundColor: colors.panelBg, border: `1px solid ${colors.border}`, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gap: 0 }}>
            {budgetData.map((item, index) => (
              <div
                key={index}
                style={{
                  padding: '12px 14px',
                  borderBottom: index < budgetData.length - 1 ? `1px solid ${colors.border}` : 'none',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontWeight: 600, color: colors.text, fontSize: 14 }}>
                  {item.label}
                </div>
                <div style={{ fontWeight: 700, color: colors.primary, fontSize: 14 }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {total > 0 && (
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: colors.successBg,
                borderTop: `2px solid ${colors.border}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontWeight: 800,
              }}
            >
              <div style={{ color: colors.text }}>Total</div>
              <div style={{ color: colors.success }}>~${total}</div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderFeaturedCard = (bestOption) => {
    if (!bestOption) return null;

    const hasValidImage = isValidImageUrl(bestOption.thumbnail);

    return (
      <div
        style={{
          borderRadius: 18,
          backgroundColor: colors.panelBg,
          border: `1px solid ${colors.border}`,
          padding: 16,
          marginBottom: 16,
          boxShadow: '0 8px 24px rgba(23, 48, 31, 0.04)',
        }}
      >
        {hasValidImage && (
          <div
            style={{
              width: '100%',
              aspectRatio: '16 / 10',
              borderRadius: 14,
              overflow: 'hidden',
              marginBottom: 14,
              backgroundColor: colors.panelMuted,
            }}
          >
            <img
              src={bestOption.thumbnail}
              alt={bestOption.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, color: colors.text, fontSize: 18, lineHeight: 1.3, marginBottom: 4 }}>
              {bestOption.label}
            </div>
            {bestOption.subtitle && (
              <div style={{ color: colors.textMuted, lineHeight: 1.5, fontSize: 14 }}>
                {bestOption.subtitle}
              </div>
            )}
          </div>
          {(bestOption.price || bestOption.rating) && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              {bestOption.price && (
                <div style={{ fontWeight: 800, color: colors.primary, fontSize: 16 }}>{bestOption.price}</div>
              )}
              {bestOption.rating && (
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{bestOption.rating}</div>
              )}
            </div>
          )}
        </div>

        {bestOption.metadata?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {bestOption.metadata.map((meta, index) => (
              <span
                key={index}
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  backgroundColor: colors.neutralBg,
                  border: `1px solid ${colors.border}`,
                  fontSize: 12,
                  color: colors.textMuted,
                }}
              >
                {meta}
              </span>
            ))}
          </div>
        )}

        {bestOption.link && (
          <a
            href={bestOption.link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              padding: '10px 16px',
              borderRadius: 10,
              backgroundColor: colors.primary,
              color: 'white',
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(29, 107, 79, 0.3)',
            }}
          >
            Book now
          </a>
        )}
      </div>
    );
  };

  const renderAlternatives = (alternatives) => {
    if (!Array.isArray(alternatives) || alternatives.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Alternatives
        </div>
        <div style={{ display: 'grid', gap: 12 }}>
          {alternatives.map((item, index) => (
            <div
              key={index}
              style={{
                borderRadius: 14,
                backgroundColor: colors.panelBg,
                border: `1px solid ${colors.border}`,
                padding: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, color: colors.text, fontSize: 16, lineHeight: 1.3, marginBottom: 2 }}>
                    {item.label}
                  </div>
                  {item.subtitle && (
                    <div style={{ color: colors.textMuted, lineHeight: 1.5, fontSize: 13 }}>
                      {item.subtitle}
                    </div>
                  )}
                </div>
                {(item.price || item.rating) && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {item.price && (
                      <div style={{ fontWeight: 700, color: colors.primary }}>{item.price}</div>
                    )}
                    {item.rating && (
                      <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 1 }}>{item.rating}</div>
                    )}
                  </div>
                )}
              </div>
              {item.link && (
                <a
                  href={item.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '8px 12px',
                    borderRadius: 8,
                    backgroundColor: colors.neutralBg,
                    color: colors.primary,
                    fontWeight: 600,
                    fontSize: 13,
                    textDecoration: 'none',
                    marginTop: 10,
                  }}
                >
                  View option
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderHighlights = (highlights) => {
    if (!Array.isArray(highlights) || highlights.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Key highlights
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {highlights.map((highlight, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: colors.primary, fontSize: 14, fontWeight: 800, marginTop: 1 }}>•</div>
              <div style={{ color: colors.text, lineHeight: 1.5, fontSize: 14 }}>
                {highlight}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderAssumptions = (assumptions) => {
    if (!Array.isArray(assumptions) || assumptions.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: colors.textMuted,
            marginBottom: 10,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          Assumptions used
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          {assumptions.map((assumption, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ color: colors.warning, fontSize: 14, fontWeight: 800, marginTop: 1 }}>
                •
              </div>
              <div style={{ color: colors.textMuted, lineHeight: 1.5, fontSize: 13 }}>
                {assumption}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderActions = (actions) => {
    if (!Array.isArray(actions) || actions.length === 0) return null;

    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: colors.textMuted, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Actions
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {actions.map((action, index) => (
            <a
              key={index}
              href={action.url}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '8px 14px',
                borderRadius: 10,
                backgroundColor: colors.primary,
                color: 'white',
                fontWeight: 700,
                fontSize: 13,
                textDecoration: 'none',
                boxShadow: '0 4px 12px rgba(29, 107, 79, 0.2)',
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      </div>
    );
  };

  const renderStepContentByType = (result) => {
    const resultType = result?.resultType || 'summary';
    const items = result?.items || [];
    const links = result?.links || [];

    // Handle new structured format with all fields
    if (
      result?.summary?.length ||
      result?.bestOption ||
      result?.timeline?.length ||
      result?.budget?.length ||
      result?.actions?.length
    ) {
      return (
        <div style={{ marginTop: 14 }}>
          {result.summary && renderSummaryBullets(result.summary)}
          {result.bestOption && renderFeaturedCard(result.bestOption)}
          {result.alternatives && renderAlternatives(result.alternatives)}
          {result.actions && renderActions(result.actions)}
          {result.assumptions && renderAssumptions(result.assumptions)}
          {result.highlights && renderHighlights(result.highlights)}
          {result.timeline && renderTimelineByDay(result.timeline)}
          {result.budget && renderBudget(result.budget)}
          {result.notes && result.notes.length > 0 && (
            <div style={{ marginBottom: 16, fontSize: 13, color: colors.textMuted, fontStyle: 'italic' }}>
              {result.notes}
            </div>
          )}
        </div>
      );
    }

    // For structured types, show a compact note if no items
    if (['cards', 'checklist', 'timeline', 'links', 'table', 'comparison'].includes(resultType) && items.length === 0) {
      return (
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            backgroundColor: colors.neutralBg,
            color: colors.textMuted,
            fontSize: 14,
            lineHeight: 1.6,
            border: `1px solid ${colors.border}`,
          }}
        >
          {result?.notes || 'Review the recommendation and refine further.'}
        </div>
      );
    }

    switch (resultType) {
      case 'cards':
        return renderResultCards(items);
      case 'checklist':
        return renderChecklist(items);
      case 'timeline':
        return renderTimeline(items);
      case 'links':
        return renderLinksList(items, links);
      case 'comparison':
        return renderTable(items);
      case 'table':
        return renderTable(items);
      case 'summary':
      default:
        return renderSummaryBox(result?.notes, items);
    }
  };

  const renderStepResult = (taskId, step) => {
    const stepStatus = getStatusMeta(step.status);
    const refineValue = stepRefineInputs[step.id] || '';

    return (
      <div
        style={{
          marginTop: 16,
          padding: isMobile ? 14 : 18,
          borderRadius: 18,
          backgroundColor: '#fcfcf9',
          border: `1px solid ${colors.border}`,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 16,
            alignItems: 'center',
          }}
        >
          <div style={{ fontWeight: 700, color: colors.text }}>
            {step.result?.title || step.title}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 999,
                backgroundColor: colors.panelMuted,
                color: colors.textMuted,
                fontWeight: 700,
                fontSize: 12,
                textTransform: 'capitalize',
              }}
            >
              {(step.result?.resultType || step.resultType || 'summary').replace('-', ' ')}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '5px 10px',
                borderRadius: 999,
                backgroundColor: stepStatus.bg,
                color: stepStatus.color,
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {stepStatus.label}
            </span>
          </div>
        </div>

        {step.status === 'running' ? (
          <div style={{ color: colors.textMuted, fontSize: 14, marginTop: 14 }}>
            Processing this step...
          </div>
        ) : null}

        {step.status === 'failed' ? (
          <div style={{ color: colors.danger, fontSize: 14, marginTop: 14 }}>
            This step failed.
          </div>
        ) : null}

        {renderStepContentByType(step.result)}

        <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          {Array.isArray(step.revisions) && step.revisions.length > 0 && (
            <button
              onClick={() => setStepHistory(step.id)}
              type="button"
              style={{
                border: '1px solid #d1d5db',
                background: 'white',
                color: colors.primary,
                borderRadius: 8,
                padding: '6px 10px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {activeStepHistoryId === step.id ? 'Hide history' : 'Step history'}
            </button>
          )}
        </div>

        {activeStepHistoryId === step.id && (
          <div
            style={{
              marginTop: 12,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              backgroundColor: colors.panelMuted,
              padding: 12,
            }}
          >
            {(step.revisions || []).map((revision) => (
              <div
                key={revision.id}
                style={{ marginBottom: 10, padding: 10, border: `1px solid ${colors.border}`, borderRadius: 10 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{revision.changeNote || 'Revision'}</div>
                    <div style={{ fontSize: 12, color: colors.textMuted }}>
                      {new Date(revision.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={() => restoreStepRevision(taskId, step.id, revision)}
                    type="button"
                    style={{
                      border: 'none',
                      borderRadius: 8,
                      background: colors.primary,
                      color: 'white',
                      padding: '5px 9px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  >
                    Restore
                  </button>
                </div>

                {renderResultCards(revision.result?.items || [])}
                {revision.result?.notes ? <div style={{ marginTop: 8, color: colors.text }}>{revision.result.notes}</div> : null}
              </div>
            ))}
          </div>
        )}

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await refineStep(taskId, step.id, refineValue);
          }}
          style={{ marginTop: 16 }}
        >
          <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
            Refine this step
          </div>
          <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
            <input
              value={refineValue}
              onChange={(e) =>
                setStepRefineInputs((prev) => ({ ...prev, [step.id]: e.target.value }))
              }
              placeholder="Make it cheaper, more official, better rated, closer, etc."
              style={{
                flex: 1,
                minWidth: 0,
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                outline: 'none',
                fontSize: 14,
              }}
            />
            <button
              type="submit"
              disabled={!refineValue.trim() || step.status === 'running'}
              style={{
                border: 'none',
                borderRadius: 12,
                padding: '12px 16px',
                backgroundColor:
                  !refineValue.trim() || step.status === 'running'
                    ? '#cbd5c8'
                    : colors.primary,
                color: '#fff',
                fontWeight: 800,
                cursor:
                  !refineValue.trim() || step.status === 'running'
                    ? 'not-allowed'
                    : 'pointer',
                width: isMobile ? '100%' : 'auto',
              }}
            >
              Refine
            </button>
          </div>
        </form>
      </div>
    );
  };

  const renderTaskHistory = (task) => {
    if (!task || !Array.isArray(task.revisions) || task.revisions.length === 0) return null;

    return (
      <div
        style={{
          marginBottom: 20,
          border: `1px solid ${colors.border}`,
          borderRadius: 16,
          background: colors.panelMuted,
          padding: 14,
        }}
      >
        <div style={{ fontWeight: 700, color: colors.text, marginBottom: 8 }}>Task history</div>
        {task.revisions.map((revision) => (
          <div
            key={revision.id}
            style={{
              marginBottom: 10,
              padding: 10,
              borderRadius: 10,
              background: '#fff',
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
              {revision.changeNote || 'Revision'}
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 8 }}>
              {new Date(revision.createdAt).toLocaleString()}
            </div>
            {renderSectionContent(revision.result?.summary || revision.result?.recommendation || '')}
          </div>
        ))}
      </div>
    );
  };

  const renderTaskResult = (result, taskId) => {
    if (!result) return null;

    return (
      <>
        <div
          style={{
            background:
              'linear-gradient(135deg, rgba(199, 221, 156, 0.28) 0%, rgba(255,255,255,1) 75%)',
            border: `1px solid ${colors.border}`,
            borderRadius: 22,
            padding: isMobile ? 16 : 22,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: colors.primary,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            Final summary
          </div>
          {Array.isArray(result.recommendation || result.summary) ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {(result.recommendation || result.summary).slice(0, 3).map((bullet, index) => (
                <div key={index} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ color: colors.primary, fontSize: 16, fontWeight: 800, marginTop: -2 }}>•</div>
                  <div style={{ fontSize: 16, color: colors.text, lineHeight: 1.6 }}>
                    {bullet}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 17, color: colors.text, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
              {result.recommendation || result.summary}
            </div>
          )}
        </div>

        {Array.isArray(result.steps) && result.steps.length > 0 ? (
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 14px', color: colors.text, fontSize: 20 }}>
              Workflow steps
            </h3>
            <div style={{ display: 'grid', gap: 14 }}>
              {result.steps.map((step, index) => {
                const statusMeta = getStatusMeta(step.status);

                return (
                  <div
                    key={step.id || index}
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 18,
                      padding: isMobile ? 14 : 18,
                      backgroundColor: colors.panelBg,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        gap: 14,
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
                        <div
                          style={{
                            minWidth: 34,
                            height: 34,
                            borderRadius: 999,
                            backgroundColor: statusMeta.bg,
                            color: statusMeta.color,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: 13,
                          }}
                        >
                          {step.status === 'completed' ? '✓' : index + 1}
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, color: colors.text, fontSize: 17 }}>
                            {step.title}
                          </div>
                          {step.description ? (
                            <div
                              style={{
                                marginTop: 6,
                                color: colors.textMuted,
                                fontSize: 14,
                                lineHeight: 1.6,
                              }}
                            >
                              {step.description}
                            </div>
                          ) : null}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '5px 10px',
                            borderRadius: 999,
                            backgroundColor: statusMeta.bg,
                            color: statusMeta.color,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {step.status === 'completed' ? 'Completed' : statusMeta.label}
                        </span>

                        {step.status !== 'completed' ? (
                          <button
                            onClick={() => handleExecuteSingleStep(taskId, step)}
                            disabled={step.status === 'running'}
                            style={{
                              border: 'none',
                              borderRadius: 10,
                              padding: '8px 12px',
                              backgroundColor:
                                step.status === 'running' ? '#cbd5c8' : colors.primary,
                              color: '#fff',
                              fontWeight: 700,
                              cursor: step.status === 'running' ? 'not-allowed' : 'pointer',
                              fontSize: 13,
                              width: isMobile ? '100%' : 'auto',
                            }}
                          >
                            {step.status === 'running' ? 'Running...' : 'Execute'}
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {step.result || step.status !== 'pending' ? renderStepResult(taskId, step) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {Array.isArray(result.sections) && result.sections.length > 0 ? (
          <div style={{ marginTop: 28 }}>
            <h3 style={{ margin: '0 0 14px', color: colors.text, fontSize: 20 }}>
              Summary details
            </h3>
            <div style={{ display: 'grid', gap: 14 }}>
              {result.sections.map((section, index) => (
                <div
                  key={index}
                  style={{
                    border: `1px solid ${colors.border}`,
                    borderRadius: 18,
                    padding: isMobile ? 14 : 18,
                    backgroundColor: colors.panelBg,
                  }}
                >
                  <div style={{ fontWeight: 800, color: colors.text }}>
                    {section?.title || `Section ${index + 1}`}
                  </div>
                  {renderSectionContent(section?.content ?? section?.items ?? section?.text)}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </>
    );
  };

  const queuedCount = tasks.filter((task) => task.status === 'queued').length;
  const readyCount = tasks.filter((task) => task.status === 'ready').length;
  const runningCount = tasks.filter(
    (task) => task.status === 'running' || task.status === 'analyzing'
  ).length;

  const handleSelectTask = (taskId) => {
    setSelectedTaskId(taskId);
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  const renderTaskListPanel = (mobile = false) => (
    <>
      <div style={{ marginBottom: mobile ? 14 : 18 }}>
        <div style={{ fontSize: mobile ? 16 : 18, fontWeight: 700, marginBottom: 12 }}>
          Tomorrow’s list
        </div>
        <div style={{ display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: 10 }}>
          <input
            value={currentInput}
            onChange={(e) => setCurrentInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addTask();
            }}
            placeholder="Add one task at a time..."
            style={{
              flex: 1,
              minWidth: 0,
              padding: '12px 14px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              outline: 'none',
              fontSize: 14,
            }}
          />
          <button
            onClick={addTask}
            disabled={!currentInput.trim()}
            style={{
              border: 'none',
              borderRadius: 12,
              padding: '12px 16px',
              backgroundColor: currentInput.trim() ? colors.primary : '#cbd5c8',
              color: '#fff',
              fontWeight: 700,
              cursor: currentInput.trim() ? 'pointer' : 'not-allowed',
              width: mobile ? '100%' : 'auto',
            }}
          >
            Add
          </button>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          marginBottom: mobile ? 14 : 18,
        }}
      >
        {[
          { label: 'Queued', value: queuedCount },
          { label: 'Running', value: runningCount },
          { label: 'Ready', value: readyCount },
        ].map((item) => (
          <div
            key={item.label}
            style={{
              backgroundColor: colors.panelMuted,
              borderRadius: mobile ? 14 : 16,
              padding: mobile ? 10 : 12,
              border: `1px solid ${colors.border}`,
            }}
          >
            <div style={{ fontSize: mobile ? 18 : 20, fontWeight: 800 }}>{item.value}</div>
            <div style={{ color: colors.textMuted, fontSize: 12 }}>{item.label}</div>
          </div>
        ))}
      </div>

      <button
        onClick={runAllTasks}
        disabled={runningAll || queuedCount === 0}
        style={{
          width: '100%',
          border: 'none',
          borderRadius: mobile ? 12 : 14,
          padding: mobile ? '13px 14px' : '14px 16px',
          backgroundColor:
            runningAll || queuedCount === 0 ? '#cbd5c8' : colors.success,
          color: '#fff',
          fontWeight: 800,
          fontSize: 14,
          cursor: runningAll || queuedCount === 0 ? 'not-allowed' : 'pointer',
          marginBottom: mobile ? 14 : 18,
        }}
      >
        {runningAll ? 'Running tasks...' : 'Run My List'}
      </button>

      <div style={{ display: 'grid', gap: mobile ? 10 : 12 }}>
        {tasks.length === 0 ? (
          <div
            style={{
              border: `1px dashed ${colors.border}`,
              borderRadius: mobile ? 14 : 16,
              padding: mobile ? 16 : 20,
              textAlign: 'center',
              color: colors.textMuted,
              backgroundColor: colors.panelMuted,
            }}
          >
            Add your first item above.
          </div>
        ) : (
          tasks.map((task) => {
            const status = getStatusMeta(task.status);
            const isSelected = task.id === selectedTaskId;

            return (
              <button
                key={task.id}
                onClick={() => handleSelectTask(task.id)}
                style={{
                  textAlign: 'left',
                  border: isSelected
                    ? `2px solid ${colors.primary}`
                    : `1px solid ${colors.border}`,
                  borderRadius: mobile ? 16 : 18,
                  backgroundColor: isSelected ? '#f1f7f2' : colors.panelBg,
                  padding: mobile ? 14 : 16,
                  cursor: 'pointer',
                  boxShadow: isSelected ? colors.shadow : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      backgroundColor: status.bg,
                      color: status.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 800,
                      flexShrink: 0,
                    }}
                  >
                    {status.icon}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontWeight: 700,
                        color: colors.text,
                        lineHeight: 1.4,
                        marginBottom: 8,
                      }}
                    >
                      {task.title}
                    </div>

                    {task.preview ? (
                      <div
                        style={{
                          color: colors.textMuted,
                          fontSize: 13,
                          lineHeight: 1.5,
                          marginBottom: 10,
                        }}
                      >
                        {task.preview}
                      </div>
                    ) : null}

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 10px',
                        borderRadius: 999,
                        backgroundColor: status.bg,
                        color: status.color,
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(199, 221, 156, 0.22), transparent 28%), linear-gradient(180deg, #f3f5f1 0%, #edf1ea 100%)',
        fontFamily:
          '"IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif',
        color: colors.text,
      }}
    >
      <div style={containerStyle}>
        <div style={{ marginBottom: isMobile ? 20 : 28 }}>
          <div
            style={{
              fontSize: 13,
              color: colors.primary,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 10,
            }}
          >
            AI Operator
          </div>
          <h1 style={{ margin: 0, fontSize: isMobile ? 28 : 38, lineHeight: 1.05 }}>AI Task Inbox</h1>
          <p style={{ margin: '12px 0 0', color: colors.textMuted, fontSize: isMobile ? 14 : 16 }}>
            Each workflow step now keeps its own structured recommendations, not just the final summary.
          </p>
        </div>

        {error ? (
          <div
            style={{
              marginBottom: 18,
              padding: isMobile ? '12px 14px' : '14px 16px',
              backgroundColor: colors.dangerBg,
              color: colors.danger,
              border: `1px solid #fda29b`,
              borderRadius: 14,
            }}
          >
            {error}
          </div>
        ) : null}

        {isMobile ? (
          <div style={{ display: 'grid', gap: 12 }}>
            <section
              style={{
                backgroundColor: colors.panelBg,
                border: `1px solid ${colors.border}`,
                borderRadius: 18,
                boxShadow: colors.shadow,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                style={{
                  width: '100%',
                  border: 'none',
                  backgroundColor: mobileMenuOpen ? '#eef4ef' : colors.panelBg,
                  padding: '14px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: colors.text,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                }}
              >
                <span>Tasks ({tasks.length})</span>
                <span style={{ color: colors.textMuted, fontSize: 13 }}>
                  {mobileMenuOpen ? 'Close' : selectedTask ? 'Open' : 'Open Tasks'}
                </span>
              </button>

              {mobileMenuOpen ? (
                <div
                  style={{
                    padding: '0 14px 14px',
                    borderTop: `1px solid ${colors.border}`,
                    backgroundColor: '#fcfcf9',
                  }}
                >
                  {renderTaskListPanel(true)}
                </div>
              ) : selectedTask ? (
                <div
                  style={{
                    padding: '0 14px 14px',
                    borderTop: `1px solid ${colors.border}`,
                    color: colors.textMuted,
                    fontSize: 13,
                    lineHeight: 1.5,
                    backgroundColor: '#fcfcf9',
                  }}
                >
                  Viewing: <span style={{ color: colors.text, fontWeight: 700 }}>{selectedTask.title}</span>
                </div>
              ) : null}
            </section>

            <main style={mainStyle}>
              {!selectedTask ? (
                <div
                  style={{
                    padding: '18px 6px 6px',
                    color: colors.textMuted,
                    lineHeight: 1.6,
                  }}
                >
                  Open Tasks to add or select a task.
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                      marginBottom: 18,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 12,
                          color: colors.primary,
                          fontWeight: 700,
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginBottom: 8,
                        }}
                      >
                        Task detail
                      </div>
                      <h2 style={{ margin: 0, fontSize: 24, lineHeight: 1.15 }}>
                        {selectedTask.title}
                      </h2>
                      <div
                        style={{
                          marginTop: 10,
                          display: 'flex',
                          gap: 8,
                          alignItems: 'center',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '6px 10px',
                            borderRadius: 999,
                            backgroundColor: getStatusMeta(selectedTask.status).bg,
                            color: getStatusMeta(selectedTask.status).color,
                            fontWeight: 700,
                            fontSize: 12,
                          }}
                        >
                          {getStatusMeta(selectedTask.status).label}
                        </span>
                        {selectedTask.revisions && selectedTask.revisions.length > 0 && (
                          <button
                            onClick={() =>
                              setShowHistory((prev) => ({
                                ...prev,
                                [selectedTask.id]: !prev[selectedTask.id],
                              }))
                            }
                            style={{
                              padding: '6px 10px',
                              borderRadius: 999,
                              backgroundColor: 'transparent',
                              color: colors.primary,
                              border: `1px solid ${colors.primary}`,
                              fontWeight: 600,
                              fontSize: 12,
                              cursor: 'pointer',
                            }}
                          >
                            {showHistory[selectedTask.id] ? 'Hide history' : 'View history'}
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gap: 10 }}>
                      {(selectedTask.status === 'queued' || selectedTask.status === 'failed') ? (
                        <button
                          onClick={() => processTask(selectedTask.id)}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 16px',
                            backgroundColor: colors.primary,
                            color: '#fff',
                            fontWeight: 800,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Run this task
                        </button>
                      ) : null}

                      {selectedTask.status === 'ready' ? (
                        <button
                          onClick={() => setShowCustomizeModal(true)}
                          style={{
                            border: '1px solid #d1d5db',
                            borderRadius: 12,
                            padding: '12px 16px',
                            backgroundColor: '#fff',
                            color: colors.primary,
                            fontWeight: 800,
                            cursor: 'pointer',
                            width: '100%',
                          }}
                        >
                          Customize
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {selectedTask.status === 'queued' ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        padding: 14,
                        backgroundColor: colors.panelMuted,
                        color: colors.textMuted,
                      }}
                    >
                      This task is queued. Open Tasks or use “Run this task”.
                    </div>
                  ) : selectedTask.status === 'analyzing' ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        padding: 14,
                        backgroundColor: colors.panelMuted,
                        color: colors.textMuted,
                      }}
                    >
                      AI is planning the work for this task.
                    </div>
                  ) : selectedTask.status === 'failed' ? (
                    <div
                      style={{
                        border: `1px solid ${colors.border}`,
                        borderRadius: 16,
                        padding: 14,
                        backgroundColor: colors.panelMuted,
                        color: colors.textMuted,
                      }}
                    >
                      This task failed. Try running it again.
                    </div>
                  ) : (
                    <>
                      {showHistory[selectedTask.id] && renderTaskHistory(selectedTask)}
                      {renderTaskResult(selectedTask.result, selectedTask.id)}

                      <div
                        style={{
                          borderTop: `1px solid ${colors.border}`,
                          paddingTop: 18,
                          marginTop: 18,
                        }}
                      >
                        <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Ask a follow-up</h3>

                        <div
                          style={{
                            display: 'grid',
                            gap: 10,
                            maxHeight: 260,
                            overflowY: 'auto',
                            padding: 12,
                            borderRadius: 14,
                            backgroundColor: colors.panelMuted,
                            border: `1px solid ${colors.border}`,
                            marginBottom: 12,
                          }}
                        >
                          {(selectedTask.messages || []).length === 0 ? (
                            <div style={{ color: colors.textMuted }}>No messages yet.</div>
                          ) : (
                            selectedTask.messages.map((message, index) => (
                              <div
                                key={index}
                                style={{
                                  display: 'flex',
                                  justifyContent:
                                    message.role === 'user' ? 'flex-end' : 'flex-start',
                                }}
                              >
                                <div
                                  style={{
                                    maxWidth: '88%',
                                    padding: '10px 12px',
                                    borderRadius:
                                      message.role === 'user'
                                        ? '14px 14px 4px 14px'
                                        : '14px 14px 14px 4px',
                                    backgroundColor:
                                      message.role === 'user' ? '#e6f2ed' : '#ffffff',
                                    border: `1px solid ${colors.border}`,
                                    lineHeight: 1.5,
                                    fontSize: 14,
                                    whiteSpace: 'pre-wrap',
                                  }}
                                >
                                  {message.content}
                                </div>
                              </div>
                            ))
                          )}
                        </div>

                        <form onSubmit={handleSendChat} style={{ display: 'grid', gap: 10 }}>
                          <input
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            placeholder="Ask a specific follow-up question..."
                            style={{
                              width: '100%',
                              padding: '12px 14px',
                              borderRadius: 12,
                              border: `1px solid ${colors.border}`,
                              outline: 'none',
                              fontSize: 14,
                            }}
                          />
                          <button
                            type="submit"
                            disabled={!chatInput.trim()}
                            style={{
                              border: 'none',
                              borderRadius: 12,
                              padding: '12px 16px',
                              backgroundColor: chatInput.trim() ? colors.primary : '#cbd5c8',
                              color: '#fff',
                              fontWeight: 800,
                              cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                              width: '100%',
                            }}
                          >
                            Send
                          </button>
                        </form>
                      </div>
                    </>
                  )}

                  {showCustomizeModal && (
                    <div
                      style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 50,
                        padding: 12,
                      }}
                      onClick={() => setShowCustomizeModal(false)}
                    >
                      <div
                        style={{
                          width: '100%',
                          maxWidth: 580,
                          backgroundColor: '#fff',
                          borderRadius: 16,
                          padding: 18,
                          boxShadow: colors.shadow,
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>Customize results</h3>
                        <p style={{ margin: '0 0 14px', color: colors.textMuted }}>
                          Choose one of the quick actions or type a custom instruction.
                        </p>

                        {[
                          'Make it cheaper',
                          'Better reviews',
                          'More special',
                          'Better location',
                          'Shorter travel',
                          'More food options',
                        ].map((label) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              applyCustomization(label);
                              setShowCustomizeModal(false);
                            }}
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              marginBottom: 8,
                              padding: '10px 12px',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              backgroundColor: '#f9fafb',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            {label}
                          </button>
                        ))}

                        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                          <input
                            id="customize-input"
                            placeholder="Custom instruction..."
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            style={{
                              width: '100%',
                              padding: '10px',
                              borderRadius: 8,
                              border: `1px solid ${colors.border}`,
                              outline: 'none',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (chatInput.trim()) {
                                applyCustomization(chatInput.trim());
                                setShowCustomizeModal(false);
                                setChatInput('');
                              }
                            }}
                            style={{
                              padding: '10px 14px',
                              backgroundColor: colors.primary,
                              color: '#fff',
                              border: 'none',
                              borderRadius: 8,
                              cursor: 'pointer',
                              fontWeight: 700,
                              width: '100%',
                            }}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </main>
          </div>
        ) : (
          <div style={layoutStyle}>
            <aside style={sidebarStyle}>{renderTaskListPanel(false)}</aside>

            <main style={mainStyle}>
            {!selectedTask ? (
              <div
                style={{
                  height: '100%',
                  minHeight: isMobile ? 260 : isLargeDesktop ? 320 : isMediumDesktop ? 300 : 280,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  color: colors.textMuted,
                }}
              >
                Select a task from the left to review results and customize it.
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                    marginBottom: 22,
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.primary,
                        fontWeight: 700,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: 8,
                      }}
                    >
                      Task detail
                    </div>
                    <h2 style={{ margin: 0, fontSize: 30, lineHeight: 1.15 }}>
                      {selectedTask.title}
                    </h2>
                    <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '6px 10px',
                          borderRadius: 999,
                          backgroundColor: getStatusMeta(selectedTask.status).bg,
                          color: getStatusMeta(selectedTask.status).color,
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        {getStatusMeta(selectedTask.status).label}
                      </span>
                      {selectedTask.revisions && selectedTask.revisions.length > 0 && (
                        <button
                          onClick={() =>
                            setShowHistory((prev) => ({
                              ...prev,
                              [selectedTask.id]: !prev[selectedTask.id],
                            }))
                          }
                          style={{
                            padding: '6px 10px',
                            borderRadius: 999,
                            backgroundColor: 'transparent',
                            color: colors.primary,
                            border: `1px solid ${colors.primary}`,
                            fontWeight: 600,
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          {showHistory[selectedTask.id] ? 'Hide history' : 'View history'}
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedTask.status === 'queued' || selectedTask.status === 'failed' ? (
                    <button
                      onClick={() => processTask(selectedTask.id)}
                      style={{
                        border: 'none',
                        borderRadius: 12,
                        padding: '12px 16px',
                        backgroundColor: colors.primary,
                        color: '#fff',
                        fontWeight: 800,
                        cursor: 'pointer',
                        width: isMobile ? '100%' : 'auto',
                      }}
                    >
                      Run this task
                    </button>
                  ) : null}

                  {selectedTask.status === 'ready' ? (
                    <button
                      onClick={() => setShowCustomizeModal(true)}
                      style={{
                        border: '1px solid #d1d5db',
                        borderRadius: 12,
                        padding: '12px 16px',
                        backgroundColor: '#fff',
                        color: colors.primary,
                        fontWeight: 800,
                        cursor: 'pointer',
                        width: isMobile ? '100%' : 'auto',
                      }}
                    >
                      Customize
                    </button>
                  ) : null}
                </div>

                {selectedTask.status === 'queued' ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 18,
                      padding: isMobile ? 14 : 18,
                      backgroundColor: colors.panelMuted,
                      color: colors.textMuted,
                    }}
                  >
                    This task is queued. Run it from the left panel or use “Run this task”.
                  </div>
                ) : selectedTask.status === 'analyzing' ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 18,
                      padding: isMobile ? 14 : 18,
                      backgroundColor: colors.panelMuted,
                      color: colors.textMuted,
                    }}
                  >
                    AI is planning the work for this task.
                  </div>
                ) : selectedTask.status === 'failed' ? (
                  <div
                    style={{
                      border: `1px solid ${colors.border}`,
                      borderRadius: 18,
                      padding: isMobile ? 14 : 18,
                      backgroundColor: colors.panelMuted,
                      color: colors.textMuted,
                    }}
                  >
                    This task failed. Try running it again.
                  </div>
                ) : (
                  <>
                    {showHistory[selectedTask.id] && renderTaskHistory(selectedTask)}
                    {renderTaskResult(selectedTask.result, selectedTask.id)}

                    <div
                      style={{
                        borderTop: `1px solid ${colors.border}`,
                        paddingTop: 22,
                        marginTop: 22,
                      }}
                    >
                      <h3 style={{ margin: '0 0 12px', fontSize: 18 }}>Ask a follow-up</h3>

                      <div
                        style={{
                          display: 'grid',
                          gap: 10,
                          maxHeight: 260,
                          overflowY: 'auto',
                          padding: 14,
                          borderRadius: 16,
                          backgroundColor: colors.panelMuted,
                          border: `1px solid ${colors.border}`,
                          marginBottom: 12,
                        }}
                      >
                        {(selectedTask.messages || []).length === 0 ? (
                          <div style={{ color: colors.textMuted }}>No messages yet.</div>
                        ) : (
                          selectedTask.messages.map((message, index) => (
                            <div
                              key={index}
                              style={{
                                display: 'flex',
                                justifyContent:
                                  message.role === 'user' ? 'flex-end' : 'flex-start',
                              }}
                            >
                              <div
                                style={{
                                  maxWidth: '78%',
                                  padding: '10px 12px',
                                  borderRadius:
                                    message.role === 'user'
                                      ? '14px 14px 4px 14px'
                                      : '14px 14px 14px 4px',
                                  backgroundColor:
                                    message.role === 'user' ? '#e6f2ed' : '#ffffff',
                                  border: `1px solid ${colors.border}`,
                                  lineHeight: 1.5,
                                  fontSize: 14,
                                  whiteSpace: 'pre-wrap',
                                }}
                              >
                                {message.content}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <form onSubmit={handleSendChat} style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 10 }}>
                        <input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Ask a specific follow-up question..."
                          style={{
                            flex: 1,
                            padding: '12px 14px',
                            borderRadius: 12,
                            border: `1px solid ${colors.border}`,
                            outline: 'none',
                            fontSize: 14,
                          }}
                        />
                        <button
                          type="submit"
                          disabled={!chatInput.trim()}
                          style={{
                            border: 'none',
                            borderRadius: 12,
                            padding: '12px 16px',
                            backgroundColor: chatInput.trim() ? colors.primary : '#cbd5c8',
                            color: '#fff',
                            fontWeight: 800,
                            cursor: chatInput.trim() ? 'pointer' : 'not-allowed',
                            width: isMobile ? '100%' : 'auto',
                          }}
                        >
                          Send
                        </button>
                      </form>
                    </div>
                  </>
                )}

                {showCustomizeModal && (
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      backgroundColor: 'rgba(0,0,0,0.4)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 50,
                    }}
                    onClick={() => setShowCustomizeModal(false)}
                  >
                    <div
                      style={{
                        minWidth: 320,
                        maxWidth: 580,
                        backgroundColor: '#fff',
                        borderRadius: 16,
                        padding: 20,
                        boxShadow: colors.shadow,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <h3 style={{ margin: '0 0 12px', fontSize: 20 }}>Customize results</h3>
                      <p style={{ margin: '0 0 14px', color: colors.textMuted }}>
                        Choose one of the quick actions or type a custom instruction.
                      </p>

                      {[
                        'Make it cheaper',
                        'Better reviews',
                        'More special',
                        'Better location',
                        'Shorter travel',
                        'More food options',
                      ].map((label) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => {
                            applyCustomization(label);
                            setShowCustomizeModal(false);
                          }}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            marginBottom: 8,
                            padding: '10px 12px',
                            borderRadius: 10,
                            border: `1px solid ${colors.border}`,
                            backgroundColor: '#f9fafb',
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          {label}
                        </button>
                      ))}

                      <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                        <input
                          id="customize-input"
                          placeholder="Custom instruction..."
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          style={{
                            flex: 1,
                            padding: '10px',
                            borderRadius: 8,
                            border: `1px solid ${colors.border}`,
                            outline: 'none',
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (chatInput.trim()) {
                              applyCustomization(chatInput.trim());
                              setShowCustomizeModal(false);
                              setChatInput('');
                            }
                          }}
                          style={{
                            padding: '10px 14px',
                            backgroundColor: colors.primary,
                            color: '#fff',
                            border: 'none',
                            borderRadius: 8,
                            cursor: 'pointer',
                            fontWeight: 700,
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            </main>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
