import type { SocialContentStatus } from '@prisma/client';
import { AppError } from '../lib/errors';

export type WorkflowState = {
  status: SocialContentStatus;
  edited: boolean;
  approved: boolean;
  readyToPublish: boolean;
  published: boolean;
  publishedAt: Date | null;
  scheduledAt: Date | null;
};

export type WorkflowPatch = Partial<{
  status: SocialContentStatus;
  edited: boolean;
  approved: boolean;
  readyToPublish: boolean;
  published: boolean;
  scheduledAt: Date | null;
}>;

export function applySocialWorkflow(current: WorkflowState, patch: WorkflowPatch): WorkflowState {
  const next: WorkflowState = { ...current };

  if (patch.edited !== undefined) next.edited = patch.edited;
  if (patch.scheduledAt !== undefined) next.scheduledAt = patch.scheduledAt;

  if (patch.approved === false) {
    if (next.readyToPublish || next.published) {
      throw new AppError(
        400,
        'WORKFLOW_INVALID',
        'Onay kaldırılmadan önce yayına hazır / yayınlandı kapatılmalı',
      );
    }
    next.approved = false;
  } else if (patch.approved === true) {
    next.approved = true;
  }

  if (patch.readyToPublish === false) {
    if (next.published) {
      throw new AppError(400, 'WORKFLOW_INVALID', 'Yayınlanmış içerikte yayına hazır kapatılamaz');
    }
    next.readyToPublish = false;
  } else if (patch.readyToPublish === true) {
    if (!next.approved) {
      throw new AppError(400, 'WORKFLOW_INVALID', 'Yayına hazır için önce onay gerekir');
    }
    next.readyToPublish = true;
  }

  if (patch.published === false) {
    next.published = false;
    next.publishedAt = null;
  } else if (patch.published === true) {
    if (!next.readyToPublish) {
      throw new AppError(400, 'WORKFLOW_INVALID', 'Yayınlamak için içerik yayına hazır olmalı');
    }
    if (!next.approved) {
      throw new AppError(400, 'WORKFLOW_INVALID', 'Yayınlamak için önce onay gerekir');
    }
    next.published = true;
    next.readyToPublish = true;
    next.approved = true;
    next.publishedAt = current.publishedAt ?? new Date();
  }

  if (patch.status !== undefined) {
    next.status = patch.status;
    if (patch.status === 'PUBLISHED') {
      if (!next.approved) next.approved = true;
      if (!next.readyToPublish) {
        throw new AppError(400, 'WORKFLOW_INVALID', 'Yayınlamak için içerik yayına hazır olmalı');
      }
      next.published = true;
      next.publishedAt = next.publishedAt ?? new Date();
    } else if (patch.status === 'CANCELLED') {
      next.published = false;
      next.readyToPublish = false;
      next.publishedAt = null;
    } else if (patch.status === 'SCHEDULED') {
      if (!next.approved) {
        throw new AppError(400, 'WORKFLOW_INVALID', 'Zamanlamak için önce onay gerekir');
      }
      next.readyToPublish = true;
      next.published = false;
      next.publishedAt = null;
    } else if (patch.status === 'APPROVED') {
      next.approved = true;
      if (!next.published) next.published = false;
    }
  }

  return normalizeSocialStatus(next);
}

export function normalizeSocialStatus(state: WorkflowState): WorkflowState {
  if (state.status === 'CANCELLED') return state;
  if (state.published) {
    return { ...state, status: 'PUBLISHED', approved: true, readyToPublish: true };
  }
  if (state.readyToPublish) {
    return {
      ...state,
      approved: true,
      status: state.scheduledAt ? 'SCHEDULED' : 'APPROVED',
    };
  }
  if (state.approved && (state.status === 'IDEA' || state.status === 'DRAFT' || state.status === 'IN_REVIEW')) {
    return { ...state, status: 'APPROVED' };
  }
  return state;
}

export function resetWorkflowOnDuplicate(base: {
  status?: SocialContentStatus;
}): Pick<
  WorkflowState,
  'status' | 'edited' | 'approved' | 'readyToPublish' | 'published' | 'publishedAt' | 'scheduledAt'
> {
  return {
    status: base.status === 'CANCELLED' ? 'DRAFT' : 'DRAFT',
    edited: false,
    approved: false,
    readyToPublish: false,
    published: false,
    publishedAt: null,
    scheduledAt: null,
  };
}
