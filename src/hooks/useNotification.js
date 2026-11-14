import { useNotification as useNotificationContext } from '../context/NotificationContext';

/**
 * Custom hook to access global toast notifications
 */
export const useNotification = () => {
  return useNotificationContext();
};

export default useNotification;
