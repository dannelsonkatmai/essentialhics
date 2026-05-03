import { Fragment } from 'react';
import { Bell, X, CheckCheck, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Link } from 'react-router-dom';
import { useNotifications } from '../../hooks/useNotifications';
import { Notification } from '../../api/notifications.api';

const TYPE_ICONS: Record<string, string> = {
  IAP_STATUS_CHANGE: '📋',
  POSITION_ASSIGNED: '👤',
  REVIEW_REQUESTED: '🔍',
  INCIDENT_CREATED: '🚨',
  PDF_READY: '📄',
  SYSTEM: 'ℹ️',
};

interface Props {
  onClose: () => void;
}

export default function NotificationsPanel({ onClose }: Props) {
  const { notifications, unreadCount, isLoading, markRead, markAllRead } = useNotifications();

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-96 bg-white shadow-2xl flex flex-col h-full border-l border-gray-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-700" />
            <h2 className="font-bold text-gray-900">Notifications</h2>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-900"
                title="Mark all as read"
              >
                <CheckCheck className="w-4 h-4" />
                Mark all read
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Notification list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-5 h-5 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Bell className="w-10 h-10 mb-3 opacity-30" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((n: Notification) => (
                <div
                  key={n.id}
                  onClick={() => { if (!n.readAt) markRead(n.id); }}
                  className={`px-5 py-4 cursor-pointer transition-colors hover:bg-gray-50 ${
                    !n.readAt ? 'bg-red-50/40' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0">{TYPE_ICONS[n.type] ?? 'ℹ️'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm font-medium truncate ${!n.readAt ? 'text-gray-900' : 'text-gray-700'}`}>
                          {n.title}
                        </p>
                        {!n.readAt && (
                          <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                      {n.actionUrl && (
                        <Link
                          to={n.actionUrl}
                          onClick={onClose}
                          className="inline-flex items-center gap-1 text-xs text-red-600 font-medium hover:underline mt-1"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
