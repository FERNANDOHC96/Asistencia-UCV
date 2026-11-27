import React from 'react';
import { Archive } from 'lucide-react';
import { ActionButton, SectionIconBadge } from './ui';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  title: string;
  message?: string;
  loading?: boolean;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  title,
  message = 'Se ocultará de la web. Los datos se conservan en la base de datos.',
  loading = false,
  confirmLabel = 'Archivar',
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="ucv-card ucv-scale-in rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        <div className="h-1 ucv-topbar-split w-full" />
        <div className="p-6 text-center">
          <SectionIconBadge
            icon={Archive}
            variant="amber"
            size="lg"
            className="mx-auto mb-3.5"
          />
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-600 mt-2 leading-relaxed">{message}</p>

          <div className="mt-6 flex items-center justify-center gap-2.5">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={loading}
            >
              Cancelar
            </ActionButton>
            <ActionButton
              icon={Archive}
              variant="warning"
              size="sm"
              loading={loading}
              onClick={onConfirm}
              className="!bg-amber-600 hover:!bg-amber-700 !text-white !border-amber-600"
            >
              {confirmLabel}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
};
