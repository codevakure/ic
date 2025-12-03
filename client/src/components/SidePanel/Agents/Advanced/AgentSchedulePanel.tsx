/**
 * AgentSchedulePanel
 *
 * A panel for managing agent schedules within the agent builder.
 * Allows creating, viewing, and managing scheduled triggers for agents.
 */

import React, { useState } from 'react';
import { Clock, Plus, Trash2, Play, Pause, ChevronDown, ChevronUp, History } from 'lucide-react';
import { useWatch, useFormContext } from 'react-hook-form';
import { Button, useToastContext } from '@librechat/client';
import type { AgentForm } from '~/common';
import type { AgentSchedule, ScheduleConfig } from 'librechat-data-provider';
import { ExecutionsTable } from '../Executions';
import {
  useAgentSchedulesQuery,
  useCreateScheduleMutation,
  useDeleteScheduleMutation,
  useToggleScheduleMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';

const labelClass = 'mb-2 text-token-text-primary block font-medium';
const inputClass =
  'flex w-full px-3 py-2 border border-border-light rounded-md bg-surface-secondary focus:ring-2 focus:ring-ring-primary text-sm';
const selectClass =
  'flex w-full px-3 py-2 border border-border-light rounded-md bg-surface-secondary focus:ring-2 focus:ring-ring-primary text-sm';

interface ScheduleFormData {
  mode: 'interval' | 'cron';
  intervalValue: number;
  intervalUnit: 'seconds' | 'minutes' | 'hours' | 'days';
  cronExpression: string;
  prompt: string;
  enabled: boolean;
}

const defaultScheduleForm: ScheduleFormData = {
  mode: 'interval',
  intervalValue: 5,
  intervalUnit: 'seconds',
  cronExpression: '0 9 * * *',
  prompt: '',
  enabled: true,
};

/** Format schedule for display */
function formatSchedule(schedule: ScheduleConfig): string {
  if (schedule.mode === 'cron') {
    return `Cron: ${schedule.expression}`;
  }
  return `Every ${schedule.value} ${schedule.unit}`;
}

/** Format date for display */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) {
    return 'Never';
  }
  return new Date(dateStr).toLocaleString();
}

/** Single schedule item component */
function ScheduleItem({
  schedule,
  agentId,
  onToggle,
  onDelete,
}: {
  schedule: AgentSchedule;
  agentId: string;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-text-tertiary" />
          <span className="text-sm font-medium">{formatSchedule(schedule.schedule)}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-xs',
              schedule.enabled
                ? 'bg-green-500/20 text-green-500'
                : 'bg-gray-500/20 text-gray-500',
            )}
          >
            {schedule.enabled ? 'Active' : 'Paused'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onToggle(!schedule.enabled)}
            className="rounded p-1 hover:bg-surface-hover"
            title={schedule.enabled ? 'Pause schedule' : 'Resume schedule'}
          >
            {schedule.enabled ? (
              <Pause className="h-4 w-4 text-text-tertiary" />
            ) : (
              <Play className="h-4 w-4 text-text-tertiary" />
            )}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-1 hover:bg-surface-hover"
            title="Delete schedule"
          >
            <Trash2 className="h-4 w-4 text-red-500" />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded p-1 hover:bg-surface-hover"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 text-text-tertiary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-tertiary" />
            )}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border-light pt-3 text-xs text-text-secondary">
          <div>
            <span className="font-medium">Prompt:</span> {schedule.prompt || 'No prompt set'}
          </div>
          <div className="flex gap-4">
            <div>
              <span className="font-medium">Runs:</span> {schedule.runCount}
              {schedule.maxRuns ? ` / ${schedule.maxRuns}` : ''}
            </div>
            <div>
              <span className="font-medium">Success:</span> {schedule.successCount}
            </div>
            <div>
              <span className="font-medium">Failed:</span> {schedule.failCount}
            </div>
          </div>
          <div>
            <span className="font-medium">Last Run:</span> {formatDate(schedule.lastRun)}
          </div>
          <div>
            <span className="font-medium">Next Run:</span> {formatDate(schedule.nextRun)}
          </div>
        </div>
      )}
    </div>
  );
}

/** New schedule form component */
function NewScheduleForm({
  onSubmit,
  onCancel,
  isLoading,
}: {
  onSubmit: (data: ScheduleFormData) => void;
  onCancel: () => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<ScheduleFormData>(defaultScheduleForm);

  const handleSubmit = () => {
    if (formData.prompt.trim()) {
      onSubmit(formData);
    }
  };

  return (
    <div className="space-y-4 rounded-lg border border-border-light bg-surface-secondary p-4">
      <div className="text-sm font-medium">New Schedule</div>

      {/* Mode selection */}
      <div>
        <label className={labelClass}>Schedule Type</label>
        <select
          className={selectClass}
          value={formData.mode}
          onChange={(e) =>
            setFormData({ ...formData, mode: e.target.value as 'interval' | 'cron' })
          }
        >
          <option value="interval">Interval</option>
          <option value="cron">Cron Expression</option>
        </select>
      </div>

      {/* Interval mode */}
      {formData.mode === 'interval' && (
        <div className="flex gap-2">
          <div className="flex-1">
            <label className={labelClass}>Every</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={formData.intervalValue}
              onChange={(e) =>
                setFormData({ ...formData, intervalValue: parseInt(e.target.value) || 1 })
              }
            />
          </div>
          <div className="flex-1">
            <label className={labelClass}>Unit</label>
            <select
              className={selectClass}
              value={formData.intervalUnit}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  intervalUnit: e.target.value as 'seconds' | 'minutes' | 'hours' | 'days',
                })
              }
            >
              <option value="seconds">Seconds</option>
              <option value="minutes">Minutes</option>
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>
      )}

      {/* Cron mode */}
      {formData.mode === 'cron' && (
        <div>
          <label className={labelClass}>Cron Expression</label>
          <input
            type="text"
            className={inputClass}
            placeholder="0 9 * * * (every day at 9 AM)"
            value={formData.cronExpression}
            onChange={(e) => setFormData({ ...formData, cronExpression: e.target.value })}
          />
          <p className="mt-1 text-xs text-text-tertiary">
            Format: minute hour day month weekday
          </p>
        </div>
      )}

      {/* Prompt */}
      <div>
        <label className={labelClass}>Prompt</label>
        <textarea
          className={cn(inputClass, 'min-h-[80px] resize-none')}
          placeholder="The message to send to the agent when triggered..."
          value={formData.prompt}
          onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
          required
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancel
        </Button>
        <Button type="button" onClick={handleSubmit} disabled={isLoading || !formData.prompt.trim()}>
          {isLoading ? 'Creating...' : 'Create Schedule'}
        </Button>
      </div>
    </div>
  );
}

export default function AgentSchedulePanel() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const methods = useFormContext<AgentForm>();
  const agentId = useWatch({ control: methods.control, name: 'id' });

  const [showNewForm, setShowNewForm] = useState(false);

  // Queries and mutations
  const schedulesQuery = useAgentSchedulesQuery(agentId ?? '', {
    enabled: !!agentId,
  });
  const createMutation = useCreateScheduleMutation();
  const deleteMutation = useDeleteScheduleMutation();
  const toggleMutation = useToggleScheduleMutation();

  const schedules = schedulesQuery.data?.schedules ?? [];

  const handleCreateSchedule = async (formData: ScheduleFormData) => {
    if (!agentId) {
      console.log('[SchedulePanel] No agentId, cannot create schedule');
      return;
    }

    const scheduleConfig: ScheduleConfig =
      formData.mode === 'cron'
        ? { mode: 'cron', expression: formData.cronExpression }
        : { mode: 'interval', value: formData.intervalValue, unit: formData.intervalUnit };

    console.log('[SchedulePanel] Creating schedule:', {
      agentId,
      schedule: scheduleConfig,
      prompt: formData.prompt,
      enabled: formData.enabled,
    });

    try {
      const result = await createMutation.mutateAsync({
        agentId,
        data: {
          schedule: scheduleConfig,
          prompt: formData.prompt,
          enabled: formData.enabled,
        },
      });
      console.log('[SchedulePanel] Schedule created successfully:', result);
      setShowNewForm(false);
      showToast({ message: 'Schedule created successfully', status: 'success' });
    } catch (error) {
      console.error('[SchedulePanel] Failed to create schedule:', error);
      showToast({ message: 'Failed to create schedule', status: 'error' });
    }
  };

  const handleToggleSchedule = async (scheduleId: string, enabled: boolean) => {
    if (!agentId) {
      return;
    }

    try {
      await toggleMutation.mutateAsync({ agentId, scheduleId, enabled });
      showToast({
        message: enabled ? 'Schedule resumed' : 'Schedule paused',
        status: 'success',
      });
    } catch (error) {
      showToast({ message: 'Failed to update schedule', status: 'error' });
    }
  };

  const handleDeleteSchedule = async (scheduleId: string) => {
    if (!agentId) {
      return;
    }

    try {
      await deleteMutation.mutateAsync({ agentId, scheduleId });
      showToast({ message: 'Schedule deleted', status: 'success' });
    } catch (error) {
      showToast({ message: 'Failed to delete schedule', status: 'error' });
    }
  };

  if (!agentId) {
    return (
      <div className="rounded-lg border border-border-light bg-surface-tertiary p-4 text-center text-sm text-text-tertiary">
        Save the agent first to add schedules
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-text-secondary" />
          <h3 className="font-medium">Schedules</h3>
          <span className="text-xs text-text-tertiary">
            ({schedules.length} {schedules.length === 1 ? 'schedule' : 'schedules'})
          </span>
        </div>
        {!showNewForm && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowNewForm(true)}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        )}
      </div>

      {/* New schedule form */}
      {showNewForm && (
        <NewScheduleForm
          onSubmit={handleCreateSchedule}
          onCancel={() => setShowNewForm(false)}
          isLoading={createMutation.isLoading}
        />
      )}

      {/* Existing schedules */}
      {schedulesQuery.isLoading ? (
        <div className="text-center text-sm text-text-tertiary">Loading schedules...</div>
      ) : schedules.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-light p-6 text-center text-sm text-text-tertiary">
          No schedules configured. Click &quot;Add Schedule&quot; to create one.
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => (
            <ScheduleItem
              key={schedule._id}
              schedule={schedule}
              agentId={agentId}
              onToggle={(enabled) => handleToggleSchedule(schedule._id, enabled)}
              onDelete={() => handleDeleteSchedule(schedule._id)}
            />
          ))}
        </div>
      )}

      {/* Execution History Section */}
      {schedules.length > 0 && (
        <div className="mt-6 border-t border-border-light pt-4">
          <div className="mb-3 flex items-center gap-2">
            <History className="h-4 w-4 text-text-tertiary" />
            <h4 className="text-sm font-medium text-text-primary">Execution History</h4>
          </div>
          <ExecutionsTable agentId={agentId} />
        </div>
      )}

      {/* Note about production */}
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
        <strong>Note:</strong> For production deployments with multiple server instances,
        consider using a distributed job queue like BullMQ for reliable scheduling.
      </div>
    </div>
  );
}
