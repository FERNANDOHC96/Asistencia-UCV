import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { useAuth } from './AuthContext';
import { getSupabaseClient, isSupabaseConfigured } from '../lib/supabase';
import {
  fetchNotifications,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  enrichSingleNotification,
} from '../services/notificationService';
import {
  fetchTeacherLiveRiskData,
  dismissTeacherSectionAlert,
  persistTeacherAlertReadState,
} from '../services/riskAlertService';
import {
  AppNotification,
  LiveSectionRiskAlert,
  TeacherRiskDetails,
} from '../types';

const POLL_INTERVAL_MS = 120_000;

interface NotificationsContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  hasError: boolean;
  liveRiskAlerts: LiveSectionRiskAlert[];
  liveRiskUnreadCount: number;
  liveRiskLoading: boolean;
  liveRiskRefreshing: boolean;
  liveRiskError: string | null;
  lastRiskUpdatedAt: string | null;
  selectedTeacherAlert: LiveSectionRiskAlert | null;
  selectedNotification: AppNotification | null;
  refreshNotifications: (silent?: boolean) => Promise<void>;
  refreshTeacherRiskAlerts: (silent?: boolean) => Promise<void>;
  markAsRead: (notification: AppNotification) => void;
  markAsUnread: (notification: AppNotification) => void;
  markAllAsRead: () => void;
  markLiveAlertRead: (alert: LiveSectionRiskAlert) => void;
  markLiveAlertUnread: (alert: LiveSectionRiskAlert) => void;
  markAllLiveAlertsRead: () => void;
  dismissNotification: (notification: AppNotification) => Promise<void>;
  dismissLiveRiskAlert: (alert: LiveSectionRiskAlert) => Promise<void>;
  openTeacherAlert: (alert: LiveSectionRiskAlert) => void;
  openTeacherAlertFromNotification: (notification: AppNotification) => void;
  closeTeacherAlert: () => void;
  openNotificationDetail: (notification: AppNotification) => void;
  closeNotificationDetail: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

function mergeUniqueNotifications(
  existing: AppNotification[],
  incoming: AppNotification[],
  limit = 50
): AppNotification[] {
  const byId = new Map<string, AppNotification>();
  for (const item of existing) {
    byId.set(item.id, item);
  }
  for (const item of incoming) {
    const prev = byId.get(item.id);
    byId.set(item.id, {
      ...prev,
      ...item,
      courseRef: item.courseRef ?? prev?.courseRef ?? null,
      teacherRisk: item.teacherRisk ?? prev?.teacherRisk ?? null,
    });
  }
  return Array.from(byId.values())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit);
}

export const NotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  const [liveRiskAlerts, setLiveRiskAlerts] = useState<LiveSectionRiskAlert[]>([]);
  const [sectionDetailsMap, setSectionDetailsMap] = useState<Record<string, TeacherRiskDetails>>({});
  const [liveRiskLoading, setLiveRiskLoading] = useState<boolean>(false);
  const [liveRiskRefreshing, setLiveRiskRefreshing] = useState<boolean>(false);
  const [liveRiskError, setLiveRiskError] = useState<string | null>(null);
  const [lastRiskUpdatedAt, setLastRiskUpdatedAt] = useState<string | null>(null);

  const [selectedTeacherAlert, setSelectedTeacherAlert] = useState<LiveSectionRiskAlert | null>(null);
  const [selectedNotification, setSelectedNotification] = useState<AppNotification | null>(null);

  const hasLoadedOnceRef = useRef<boolean>(false);
  const hasLoadedRiskOnceRef = useRef<boolean>(false);
  const notificationsRef = useRef<AppNotification[]>([]);
  notificationsRef.current = notifications;
  const riskDebounceTimerRef = useRef<number | null>(null);

  const fetchLimit = 50;

  const recalculateTeacherRisks = useCallback(
    async (sourceNotifications: AppNotification[], silent = false) => {
      if (!profile || profile.role !== 'profesor') {
        setLiveRiskAlerts([]);
        setSectionDetailsMap({});
        return;
      }

      if (!silent && !hasLoadedRiskOnceRef.current) {
        setLiveRiskLoading(true);
      } else {
        setLiveRiskRefreshing(true);
      }
      setLiveRiskError(null);

      try {
        const result = await fetchTeacherLiveRiskData(profile.id, sourceNotifications);
        setLiveRiskAlerts(result.alerts);
        setSectionDetailsMap(result.sectionDetailsMap);
        setLastRiskUpdatedAt(new Date().toISOString());
        hasLoadedRiskOnceRef.current = true;

        setSelectedTeacherAlert((prev) => {
          if (!prev) return null;
          const updated =
            result.alerts.find((a) => a.id === prev.id || a.sectionId === prev.sectionId) || null;
          return updated || prev;
        });
      } catch (err) {
        console.error('Error recalculando alertas de riesgo:', err);
        setLiveRiskError('No se pudieron recalcular las alertas con los registros actuales.');
      } finally {
        setLiveRiskLoading(false);
        setLiveRiskRefreshing(false);
      }
    },
    [profile]
  );

  const refreshNotifications = useCallback(
    async (silent = false) => {
      if (!profile) return;

      if (!silent && !hasLoadedOnceRef.current) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setHasError(false);

      try {
        const items = await fetchNotifications(fetchLimit, profile.id);
        setNotifications((prev) => {
          const prevMap = new Map(prev.map((p) => [p.id, p]));
          return items.map((item) => ({
            ...item,
            courseRef: item.courseRef ?? prevMap.get(item.id)?.courseRef ?? null,
            teacherRisk: item.teacherRisk ?? prevMap.get(item.id)?.teacherRisk ?? null,
          }));
        });
        hasLoadedOnceRef.current = true;

        if (profile.role === 'profesor') {
          await recalculateTeacherRisks(items, silent);
        }
      } catch (err) {
        console.error('Error al cargar notificaciones:', err);
        setHasError(true);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profile, recalculateTeacherRisks]
  );

  const refreshTeacherRiskAlerts = useCallback(
    async (silent = false) => {
      if (!profile || profile.role !== 'profesor') return;
      if (!silent) {
        setLiveRiskRefreshing(true);
      }
      setLiveRiskError(null);
      try {
        const freshNotifs = await fetchNotifications(fetchLimit, profile.id);
        setNotifications(freshNotifs);
        hasLoadedOnceRef.current = true;
        await recalculateTeacherRisks(freshNotifs, silent);
      } catch (err) {
        console.error('Error actualizando alertas docentes:', err);
        setLiveRiskError('No se pudieron actualizar las alertas desde Supabase.');
        setLiveRiskRefreshing(false);
      }
    },
    [profile, recalculateTeacherRisks]
  );

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      setLiveRiskAlerts([]);
      setSectionDetailsMap({});
      setSelectedTeacherAlert(null);
      setSelectedNotification(null);
      setLastRiskUpdatedAt(null);
      setLiveRiskError(null);
      hasLoadedOnceRef.current = false;
      hasLoadedRiskOnceRef.current = false;
      setLoading(false);
      setRefreshing(false);
      setHasError(false);
      return;
    }

    let isMounted = true;
    hasLoadedOnceRef.current = false;
    hasLoadedRiskOnceRef.current = false;
    refreshNotifications(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshNotifications(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshNotifications(true);
      }
    }, POLL_INTERVAL_MS);

    const scheduleTeacherRiskRefresh = () => {
      if (profile.role !== 'profesor' || !isMounted) return;
      if (riskDebounceTimerRef.current) {
        window.clearTimeout(riskDebounceTimerRef.current);
      }
      riskDebounceTimerRef.current = window.setTimeout(() => {
        if (isMounted) {
          recalculateTeacherRisks(notificationsRef.current, true);
        }
      }, 900);
    };

    let realtimeChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;
    let teacherDataChannel: ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null = null;

    if (isSupabaseConfigured()) {
      const supabase = getSupabaseClient();
      realtimeChannel = supabase
        .channel(`notifications-user-${profile.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          async (payload) => {
            const raw = payload.new as AppNotification | undefined;
            if (!raw || raw.user_id !== profile.id) return;
            const enriched = await enrichSingleNotification(raw);
            if (!isMounted) return;
            const nextList = mergeUniqueNotifications(notificationsRef.current, [enriched], fetchLimit);
            setNotifications(nextList);
            if (profile.role === 'profesor' && raw.kind === 'riesgo_asistencia_profesor') {
              recalculateTeacherRisks(nextList, true);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          async (payload) => {
            const updated = payload.new as AppNotification | undefined;
            if (!updated || updated.user_id !== profile.id || !isMounted) return;
            const enriched = await enrichSingleNotification(updated);
            if (!isMounted) return;
            const nextList = mergeUniqueNotifications(notificationsRef.current, [enriched], fetchLimit);
            setNotifications(nextList);
            if (profile.role === 'profesor' && updated.kind === 'riesgo_asistencia_profesor') {
              recalculateTeacherRisks(nextList, true);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${profile.id}`,
          },
          (payload) => {
            const oldRow = payload.old as { id?: string } | undefined;
            if (!oldRow?.id || !isMounted) return;
            const nextList = notificationsRef.current.filter((item) => item.id !== oldRow.id);
            setNotifications(nextList);
            if (profile.role === 'profesor') {
              recalculateTeacherRisks(nextList, true);
            }
          }
        )
        .subscribe();

      if (profile.role === 'profesor') {
        teacherDataChannel = supabase
          .channel(`teacher-risk-live-${profile.id}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'attendance_records' },
            scheduleTeacherRiskRefresh
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'class_sessions' },
            scheduleTeacherRiskRefresh
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'student_section_blocks' },
            scheduleTeacherRiskRefresh
          )
          .subscribe();
      }
    }

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
      if (riskDebounceTimerRef.current) {
        window.clearTimeout(riskDebounceTimerRef.current);
      }
      if (realtimeChannel && isSupabaseConfigured()) {
        getSupabaseClient().removeChannel(realtimeChannel);
      }
      if (teacherDataChannel && isSupabaseConfigured()) {
        getSupabaseClient().removeChannel(teacherDataChannel);
      }
    };
  }, [profile, refreshNotifications, recalculateTeacherRisks]);

  const markAsRead = useCallback(
    (notification: AppNotification) => {
      if (!profile || notification.read_at) return;

      const nowIso = new Date().toISOString();
      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read_at: nowIso } : item
        )
      );
      setLiveRiskAlerts((prev) =>
        prev.map((a) => (a.notificationId === notification.id ? { ...a, readAt: nowIso } : a))
      );
      setSelectedNotification((prev) =>
        prev && prev.id === notification.id ? { ...prev, read_at: nowIso } : prev
      );
      setSelectedTeacherAlert((prev) =>
        prev && prev.notificationId === notification.id ? { ...prev, readAt: nowIso } : prev
      );

      markNotificationRead(notification.id, profile.id).catch((err) => {
        console.error('Error al marcar notificación como leída:', err);
      });
    },
    [profile]
  );

  const markAsUnread = useCallback(
    (notification: AppNotification) => {
      if (!profile || !notification.read_at) return;

      setNotifications((prev) =>
        prev.map((item) =>
          item.id === notification.id ? { ...item, read_at: null } : item
        )
      );
      setLiveRiskAlerts((prev) =>
        prev.map((a) => (a.notificationId === notification.id ? { ...a, readAt: null } : a))
      );
      setSelectedNotification((prev) =>
        prev && prev.id === notification.id ? { ...prev, read_at: null } : prev
      );
      setSelectedTeacherAlert((prev) =>
        prev && prev.notificationId === notification.id ? { ...prev, readAt: null } : prev
      );

      markNotificationUnread(notification.id, profile.id).catch((err) => {
        console.error('Error al marcar notificación como no leída:', err);
      });
    },
    [profile]
  );

  const markAllAsRead = useCallback(() => {
    if (!profile) return;

    const nowIso = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((item) => (item.read_at ? item : { ...item, read_at: nowIso }))
    );
    setLiveRiskAlerts((prev) =>
      prev.map((a) => (a.notificationId ? { ...a, readAt: a.readAt || nowIso } : a))
    );

    markAllNotificationsRead(profile.id).catch((err) => {
      console.error('Error al marcar todas las notificaciones como leídas:', err);
    });
  }, [profile]);

  const markLiveAlertRead = useCallback(
    (alert: LiveSectionRiskAlert) => {
      if (!profile || alert.readAt) return;
      const nowIso = new Date().toISOString();

      setLiveRiskAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, readAt: nowIso } : a))
      );
      setSelectedTeacherAlert((prev) =>
        prev && prev.id === alert.id ? { ...prev, readAt: nowIso } : prev
      );

      if (alert.notificationId) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === alert.notificationId ? { ...item, read_at: nowIso } : item
          )
        );
        markNotificationRead(alert.notificationId, profile.id).catch((err) => {
          console.error('Error al marcar alerta como leída:', err);
        });
      }

      persistTeacherAlertReadState({
        teacherId: profile.id,
        sectionId: alert.sectionId,
        riskSignature: alert.details.riskSignature || 'no_risk',
        readAt: nowIso,
      }).catch((err) => {
        console.error('Error al persistir lectura de alerta:', err);
      });
    },
    [profile]
  );

  const markLiveAlertUnread = useCallback(
    (alert: LiveSectionRiskAlert) => {
      if (!profile || !alert.readAt) return;

      setLiveRiskAlerts((prev) =>
        prev.map((a) => (a.id === alert.id ? { ...a, readAt: null } : a))
      );
      setSelectedTeacherAlert((prev) =>
        prev && prev.id === alert.id ? { ...prev, readAt: null } : prev
      );

      if (alert.notificationId) {
        setNotifications((prev) =>
          prev.map((item) =>
            item.id === alert.notificationId ? { ...item, read_at: null } : item
          )
        );
        markNotificationUnread(alert.notificationId, profile.id).catch((err) => {
          console.error('Error al marcar alerta como no leída:', err);
        });
      }

      persistTeacherAlertReadState({
        teacherId: profile.id,
        sectionId: alert.sectionId,
        riskSignature: alert.details.riskSignature || 'no_risk',
        readAt: null,
      }).catch((err) => {
        console.error('Error al revertir lectura de alerta:', err);
      });
    },
    [profile]
  );

  const markAllLiveAlertsRead = useCallback(() => {
    if (!profile) return;
    const nowIso = new Date().toISOString();

    setLiveRiskAlerts((prev) => {
      for (const alert of prev) {
        if (!alert.readAt) {
          persistTeacherAlertReadState({
            teacherId: profile.id,
            sectionId: alert.sectionId,
            riskSignature: alert.details.riskSignature || 'no_risk',
            readAt: nowIso,
          }).catch(() => {});
        }
      }
      return prev.map((a) => (a.readAt ? a : { ...a, readAt: nowIso }));
    });

    setNotifications((prev) =>
      prev.map((item) =>
        item.kind === 'riesgo_asistencia_profesor' && !item.read_at
          ? { ...item, read_at: nowIso }
          : item
      )
    );

    markAllNotificationsRead(profile.id, 'riesgo_asistencia_profesor').catch((err) => {
      console.error('Error al marcar alertas como leídas:', err);
    });
  }, [profile]);

  const dismissLiveRiskAlert = useCallback(
    async (alert: LiveSectionRiskAlert) => {
      if (!profile) return;

      setLiveRiskAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      if (alert.notificationId) {
        setNotifications((prev) => prev.filter((n) => n.id !== alert.notificationId));
      }
      setSelectedTeacherAlert((prev) => (prev && prev.id === alert.id ? null : prev));

      await dismissTeacherSectionAlert({
        teacherId: profile.id,
        sectionId: alert.sectionId,
        notificationId: alert.notificationId,
        riskSignature: alert.details.riskSignature || 'no_risk',
      });
    },
    [profile]
  );

  const dismissNotification = useCallback(
    async (notification: AppNotification) => {
      if (!profile) return;

      const matchingAlert =
        profile.role === 'profesor' && notification.kind === 'riesgo_asistencia_profesor'
          ? liveRiskAlerts.find(
              (a) =>
                a.notificationId === notification.id ||
                a.sectionId === (notification.courseRef?.sectionId || notification.ref_id)
            )
          : undefined;

      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      setSelectedNotification((prev) => (prev && prev.id === notification.id ? null : prev));

      if (matchingAlert) {
        await dismissLiveRiskAlert(matchingAlert);
        return;
      }

      if (profile.role === 'profesor' && notification.kind === 'riesgo_asistencia_profesor') {
        const secId = notification.courseRef?.sectionId || notification.ref_id;
        if (secId) {
          const secDetails = sectionDetailsMap[secId];
          await dismissTeacherSectionAlert({
            teacherId: profile.id,
            sectionId: secId,
            notificationId: notification.id,
            riskSignature: secDetails?.riskSignature || 'no_risk',
          });
          return;
        }
      }

      await deleteNotification(notification.id, profile.id);
    },
    [profile, liveRiskAlerts, sectionDetailsMap, dismissLiveRiskAlert]
  );

  const openTeacherAlert = useCallback(
    (alert: LiveSectionRiskAlert) => {
      markLiveAlertRead(alert);
      setSelectedTeacherAlert({
        ...alert,
        readAt: alert.readAt || new Date().toISOString(),
      });
    },
    [markLiveAlertRead]
  );

  const openTeacherAlertFromNotification = useCallback(
    (notification: AppNotification) => {
      markAsRead(notification);
      const secId = notification.courseRef?.sectionId || notification.ref_id || '';
      const matched =
        liveRiskAlerts.find((a) => a.notificationId === notification.id) ||
        (secId ? liveRiskAlerts.find((a) => a.sectionId === secId) : undefined);

      if (matched) {
        setSelectedTeacherAlert({
          ...matched,
          readAt: matched.readAt || notification.read_at || new Date().toISOString(),
        });
        return;
      }

      const liveDetails = secId ? sectionDetailsMap[secId] : undefined;
      const fallbackDetails: TeacherRiskDetails =
        liveDetails ||
        notification.teacherRisk || {
          riskLevel: null,
          absencesCount: null,
          absencePercentage: null,
          consecutiveAbsences: null,
          recommendation: null,
          students: [],
          formattedBody: notification.body,
        };

      setSelectedTeacherAlert({
        id: notification.id,
        notificationId: notification.id,
        notification,
        sectionId: secId,
        courseId: notification.courseRef?.courseId || '',
        courseCode: notification.courseRef?.courseCode || '',
        courseName: notification.courseRef?.courseName || 'Curso asignado',
        sectionName: notification.courseRef?.sectionName || '—',
        periodName: '',
        title: notification.title,
        createdAt: notification.created_at,
        readAt: notification.read_at || new Date().toISOString(),
        isLiveOnly: false,
        details: fallbackDetails,
      });
    },
    [markAsRead, liveRiskAlerts, sectionDetailsMap]
  );

  const closeTeacherAlert = useCallback(() => {
    setSelectedTeacherAlert(null);
  }, []);

  const openNotificationDetail = useCallback(
    (notification: AppNotification) => {
      markAsRead(notification);
      setSelectedNotification({
        ...notification,
        read_at: notification.read_at || new Date().toISOString(),
      });
    },
    [markAsRead]
  );

  const closeNotificationDetail = useCallback(() => {
    setSelectedNotification(null);
  }, []);

  const enrichedNotifications = notifications.map((item) => {
    if (profile?.role === 'profesor' && item.kind === 'riesgo_asistencia_profesor') {
      const secId = item.courseRef?.sectionId || item.ref_id || '';
      const liveDetails = secId ? sectionDetailsMap[secId] : undefined;
      if (liveDetails) {
        return {
          ...item,
          teacherRisk: liveDetails,
        };
      }
    }
    return item;
  });

  const unreadCount = enrichedNotifications.filter((item) => !item.read_at).length;
  const liveRiskUnreadCount = liveRiskAlerts.filter((item) => !item.readAt).length;

  return (
    <NotificationsContext.Provider
      value={{
        notifications: enrichedNotifications,
        unreadCount,
        loading,
        refreshing,
        hasError,
        liveRiskAlerts,
        liveRiskUnreadCount,
        liveRiskLoading,
        liveRiskRefreshing,
        liveRiskError,
        lastRiskUpdatedAt,
        selectedTeacherAlert,
        selectedNotification,
        refreshNotifications,
        refreshTeacherRiskAlerts,
        markAsRead,
        markAsUnread,
        markAllAsRead,
        markLiveAlertRead,
        markLiveAlertUnread,
        markAllLiveAlertsRead,
        dismissNotification,
        dismissLiveRiskAlert,
        openTeacherAlert,
        openTeacherAlertFromNotification,
        closeTeacherAlert,
        openNotificationDetail,
        closeNotificationDetail,
      }}
    >
      {children}
    </NotificationsContext.Provider>
  );
};

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within a NotificationsProvider');
  }
  return ctx;
}
